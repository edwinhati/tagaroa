import type { IncomingMessage } from "node:http";

import {
  BadRequestException,
  Controller,
  Get,
  HttpCode,
  Inject,
  NotFoundException,
  Param,
  Post,
  Query,
  Req,
  UnauthorizedException,
} from "@nestjs/common";
import { asObject } from "@repo/contracts";
import { AllowAnonymous } from "@thallesp/nestjs-better-auth";

import { RecordReceiptsUseCase } from "../application/use-cases/record-receipts.use-case";
import {
  isProviderName,
  PROVIDER_CHANNELS,
  type ProviderName,
  type Receipt,
} from "../domain/value-objects/delivery-receipt.vo";
import {
  WEBHOOK_SECRETS,
  type WebhookSecrets,
} from "../infrastructure/config/notification.options";
import {
  verifyMetaSignature,
  verifySvixSignature,
  verifyTwilioSignature,
} from "../infrastructure/signatures/notification.signatures";
import {
  metaReceipts,
  resendReceipts,
  twilioReceipts,
} from "../infrastructure/webhooks/receipt.parsers";

/**
 * What Express leaves on the request. `@thallesp/nestjs-better-auth` parses
 * every route outside `/api/auth`, so the body arrives decoded — and, because
 * the module is configured with `bodyParser: { rawBody: true }`, the undecoded
 * JSON bytes arrive beside it.
 */
interface ParsedRequest extends IncomingMessage {
  body?: unknown;
  rawBody?: Buffer;
}

const header = (request: IncomingMessage, name: string): string => {
  const value = request.headers[name];
  return typeof value === "string" ? value : "";
};

/**
 * The bytes as sent. Resend's and Meta's signatures are over exactly these, so
 * re-serialising the parsed body would fail a request that is perfectly
 * genuine — a JSON object's key order and spacing are not preserved by a
 * round trip.
 */
const rawJson = (request: ParsedRequest): string => {
  if (!request.rawBody) {
    throw new BadRequestException("Body was not read");
  }
  return request.rawBody.toString("utf8");
};

/** Twilio posts a form, and signs the URL plus the fields, not the bytes. */
const formFields = (request: ParsedRequest): Record<string, string> =>
  Object.fromEntries(
    Object.entries(asObject(request.body) ?? {}).map(([name, value]) => [
      name,
      typeof value === "string" ? value : String(value ?? ""),
    ]),
  );

/**
 * Where the three providers report what happened to a message.
 *
 * Anonymous, because a provider holds no session — which is exactly why every
 * request is verified against a shared secret before a single row is touched.
 * An unconfigured secret is treated as a failed check rather than a skipped one:
 * a webhook nobody can authenticate is a way to mark anyone's address bounced.
 *
 * Authenticating the caller and reading its dialect are both transport, so both
 * stay here. What a receipt *means* — a closed message, and sometimes a
 * suppression — is `RecordReceiptsUseCase`.
 */
@Controller("notifications/webhooks")
export class NotificationWebhookController {
  constructor(
    private readonly recordReceipts: RecordReceiptsUseCase,
    @Inject(WEBHOOK_SECRETS) private readonly secrets: WebhookSecrets,
  ) {}

  /** Meta's one-off subscription check: echo the challenge, if the token matches. */
  @Get("meta")
  @AllowAnonymous()
  verifySubscription(
    @Query("hub.mode") mode: string,
    @Query("hub.verify_token") token: string,
    @Query("hub.challenge") challenge: string,
  ): string {
    const expected = this.secrets.metaVerifyToken;
    if (mode !== "subscribe" || !expected || token !== expected) {
      throw new UnauthorizedException();
    }
    return challenge;
  }

  @Post(":provider")
  @AllowAnonymous()
  @HttpCode(204)
  async receive(
    @Param("provider") provider: string,
    @Req() request: ParsedRequest,
  ): Promise<void> {
    if (
      !isProviderName(provider) ||
      !Object.hasOwn(PROVIDER_CHANNELS, provider)
    )
      throw new NotFoundException();

    await this.recordReceipts.execute(
      provider,
      this.receipts(provider, request),
    );
  }

  private receipts(provider: ProviderName, request: ParsedRequest): Receipt[] {
    if (provider === "resend") {
      const raw = rawJson(request);
      const verified =
        this.secrets.resendSecret !== undefined &&
        verifySvixSignature({
          id: header(request, "svix-id"),
          payload: raw,
          secret: this.secrets.resendSecret,
          signature: header(request, "svix-signature"),
          timestamp: header(request, "svix-timestamp"),
        });
      if (!verified) throw new UnauthorizedException();
      return resendReceipts(request.body);
    }

    if (provider === "twilio") {
      const params = formFields(request);
      const verified =
        this.secrets.twilioAuthToken !== undefined &&
        verifyTwilioSignature({
          authToken: this.secrets.twilioAuthToken,
          params,
          signature: header(request, "x-twilio-signature"),
          url: `${this.secrets.baseUrl}/twilio`,
        });
      if (!verified) throw new UnauthorizedException();
      return twilioReceipts(params);
    }

    const verified =
      this.secrets.metaAppSecret !== undefined &&
      verifyMetaSignature({
        appSecret: this.secrets.metaAppSecret,
        payload: rawJson(request),
        signature: header(request, "x-hub-signature-256"),
      });
    if (!verified) throw new UnauthorizedException();
    return metaReceipts(request.body);
  }
}
