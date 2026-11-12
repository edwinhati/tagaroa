import {
  Controller,
  HttpCode,
  Inject,
  Post,
  Req,
  UnauthorizedException,
} from "@nestjs/common";
import { AllowAnonymous } from "@thallesp/nestjs-better-auth";

import { parseWith } from "../../../platform/http/schema-validation";
import type { SignedRequest } from "../../../platform/http/signed-webhook";
import { SyncEmployeeUseCase } from "../application/use-cases/sync-employee.use-case";
import {
  HR_OPTIONS,
  type HrOptions,
} from "../infrastructure/config/hr.options";
import { verifyFrappeSignature } from "../infrastructure/frappe/frappe";
import { frappeEmployeeWebhook } from "./hr-webhook.schemas";

/**
 * Frappe HR's webhook on Employee. Anonymous, so it is verified against the
 * shared secret first; an unconfigured secret refuses everything. The body only
 * has to name the employee: the record is re-read from Frappe.
 */
@Controller("hr/webhooks")
export class HrWebhookController {
  constructor(
    private readonly sync: SyncEmployeeUseCase,
    @Inject(HR_OPTIONS) private readonly options: HrOptions,
  ) {}

  @Post("frappe")
  @AllowAnonymous()
  @HttpCode(204)
  async frappe(@Req() request: SignedRequest): Promise<void> {
    const signature = request.headers["x-frappe-webhook-signature"];
    if (
      !this.options ||
      !request.rawBody ||
      typeof signature !== "string" ||
      !verifyFrappeSignature(
        this.options.webhookSecret,
        request.rawBody.toString("utf8"),
        signature,
      )
    )
      throw new UnauthorizedException();

    // Parsed only now, after the signature: an unsigned body is never read.
    const { name } = await parseWith(frappeEmployeeWebhook, request.body);
    await this.sync.execute(name);
  }
}
