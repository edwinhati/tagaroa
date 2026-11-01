import { expect, mock, test } from "bun:test";
import { createHmac } from "node:crypto";

import {
  BadRequestException,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";

import { RecordReceiptsUseCase } from "../application/use-cases/record-receipts.use-case";
import type { MessageRepository } from "../domain/repositories/message.repository";
import type { SuppressionRepository } from "../domain/repositories/suppression.repository";
import {
  replaceableBy,
  type ProviderName,
  type Receipt,
} from "../domain/value-objects/delivery-receipt.vo";
import type { WebhookSecrets } from "../infrastructure/config/notification.options";
import { NotificationWebhookController } from "./notification.webhook.controller";

type Request = Parameters<NotificationWebhookController["receive"]>[1];
const secrets: WebhookSecrets = {
  baseUrl: "https://api.example.test/api/notifications/webhooks",
  resendSecret: `whsec_${Buffer.from("test-svix-key").toString("base64")}`,
  twilioAuthToken: "test-twilio-token",
  metaAppSecret: "test-meta-secret",
  metaVerifyToken: "test-verify-token",
};

const setup = (options = secrets) => {
  const execute = mock(
    async (_provider: ProviderName, _receipts: readonly Receipt[]) => {},
  );
  return {
    execute,
    controller: new NotificationWebhookController(
      { execute } as unknown as RecordReceiptsUseCase,
      options,
    ),
  };
};

const resend = (type = "email.delivered"): Request => {
  const body = {
    type,
    data: { email_id: "email-1", to: ["ada@example.test"] },
  };
  // Whitespace is signed too; serializing the parsed object must not replace these bytes.
  const raw = JSON.stringify(body, null, 2);
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = createHmac("sha256", Buffer.from("test-svix-key"))
    .update(`event-1.${timestamp}.${raw}`)
    .digest("base64");
  return {
    body,
    rawBody: Buffer.from(raw),
    headers: {
      "svix-id": "event-1",
      "svix-timestamp": timestamp,
      "svix-signature": `v1,${signature}`,
    },
  } as unknown as Request;
};

const twilio = (): Request => {
  const body = {
    MessageSid: "sms-1",
    MessageStatus: "delivered",
    To: "+15555550100",
  };
  const signature = createHmac("sha1", secrets.twilioAuthToken!)
    .update(
      `${secrets.baseUrl}/twilioMessageSidsms-1MessageStatusdeliveredTo+15555550100`,
    )
    .digest("base64");
  return {
    body,
    headers: { "x-twilio-signature": signature },
  } as unknown as Request;
};

const meta = (): Request => {
  const body = {
    entry: [
      {
        changes: [
          {
            value: {
              statuses: [
                { id: "wa-1", status: "read", recipient_id: "15555550100" },
              ],
            },
          },
        ],
      },
    ],
  };
  const raw = JSON.stringify(body, null, 2);
  const signature = createHmac("sha256", secrets.metaAppSecret!)
    .update(raw)
    .digest("hex");
  return {
    body,
    rawBody: Buffer.from(raw),
    headers: { "x-hub-signature-256": `sha256=${signature}` },
  } as unknown as Request;
};

const providers = [
  {
    provider: "resend" as const,
    request: resend,
    providerId: "email-1",
    destination: "ada@example.test",
  },
  {
    provider: "twilio" as const,
    request: twilio,
    providerId: "sms-1",
    destination: "+15555550100",
  },
  {
    provider: "meta" as const,
    request: meta,
    providerId: "wa-1",
    destination: "15555550100",
  },
];

for (const { provider, request, providerId, destination } of providers) {
  test(`${provider}: a valid signature records parsed receipts`, async () => {
    const { controller, execute } = setup();
    await controller.receive(provider, request());
    expect(execute).toHaveBeenCalledTimes(1);
    expect(execute).toHaveBeenCalledWith(provider, [
      { providerId, destination, status: "delivered", suppress: null },
    ]);
  });

  test(`${provider}: a modified signed payload is rejected before recording`, async () => {
    const { controller, execute } = setup();
    const altered = request();
    if (altered.rawBody) {
      altered.rawBody = Buffer.from(
        altered.rawBody.toString().replace(providerId, "forged-id"),
      );
      altered.body = JSON.parse(altered.rawBody.toString());
    } else {
      altered.body = {
        ...(altered.body as Record<string, string>),
        MessageSid: "forged-id",
      };
    }
    await expect(controller.receive(provider, altered)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(execute).not.toHaveBeenCalled();
  });

  test(`${provider}: an unconfigured secret fails closed`, async () => {
    const { controller, execute } = setup({ baseUrl: secrets.baseUrl });
    await expect(
      controller.receive(provider, request()),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(execute).not.toHaveBeenCalled();
  });
}

test.each(["unknown", "constructor", "toString", "__proto__"])(
  "unknown provider %s is rejected before reading the request",
  async (provider) => {
    const { controller, execute } = setup();
    await expect(
      controller.receive(provider, { headers: {} } as Request),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(execute).not.toHaveBeenCalled();
  },
);

test.each(["resend", "meta"] as const)(
  "%s: missing raw bytes fail before recording",
  async (provider) => {
    const { controller, execute } = setup();
    await expect(
      controller.receive(provider, { body: {}, headers: {} } as Request),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(execute).not.toHaveBeenCalled();
  },
);

test("a late sent receipt does not move a delivered message back to sent", async () => {
  // The real use case over a store that applies the same rule as the Drizzle one.
  const status = new Map([["email-1", "sent"]]);
  const messages = {
    applyReceipt: async (receipt: Receipt) => {
      const current = status.get(receipt.providerId);
      if (current && replaceableBy(receipt.status).includes(current))
        status.set(receipt.providerId, receipt.status);
    },
  } as unknown as MessageRepository;
  const suppressions = {
    add: async () => {},
  } as unknown as SuppressionRepository;
  const controller = new NotificationWebhookController(
    new RecordReceiptsUseCase(messages, suppressions),
    secrets,
  );

  await controller.receive("resend", resend("email.delivered"));
  await controller.receive("resend", resend("email.sent"));
  await controller.receive("resend", resend("email.delivery_delayed"));
  expect(status.get("email-1")).toBe("delivered");

  await controller.receive("resend", resend("email.bounced"));
  expect(status.get("email-1")).toBe("bounced");
});

test("receipt storage failures propagate so the provider can retry", async () => {
  const { controller, execute } = setup();
  execute.mockRejectedValueOnce(new Error("storage unavailable"));
  await expect(controller.receive("resend", resend())).rejects.toThrow(
    "storage unavailable",
  );
});

test("Meta subscription verification requires the configured token and subscribe mode", () => {
  const { controller } = setup();
  expect(
    controller.verifySubscription(
      "subscribe",
      secrets.metaVerifyToken!,
      "challenge",
    ),
  ).toBe("challenge");
  expect(() =>
    controller.verifySubscription("subscribe", "wrong", "challenge"),
  ).toThrow(UnauthorizedException);
  expect(() =>
    controller.verifySubscription(
      "other",
      secrets.metaVerifyToken!,
      "challenge",
    ),
  ).toThrow(UnauthorizedException);
  expect(() =>
    setup({ baseUrl: secrets.baseUrl }).controller.verifySubscription(
      "subscribe",
      "",
      "challenge",
    ),
  ).toThrow(UnauthorizedException);
});
