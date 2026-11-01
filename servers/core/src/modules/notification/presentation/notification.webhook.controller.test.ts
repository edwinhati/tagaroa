import { beforeEach, describe, expect, mock, test } from "bun:test";
import { createHmac } from "node:crypto";

import { BadRequestException, UnauthorizedException } from "@nestjs/common";

import type { RecordReceiptsUseCase } from "../application/use-cases/record-receipts.use-case";
import { NotificationWebhookController } from "./notification.webhook.controller";

const RESEND_KEY = "a-signing-secret";
const secrets = {
  baseUrl: "https://api.tagaroa.example/api/notifications/webhooks",
  metaAppSecret: "meta-app-secret",
  resendSecret: `whsec_${Buffer.from(RESEND_KEY).toString("base64")}`,
  twilioAuthToken: "twilio-auth-token",
};

const execute = mock(async () => {});
const controller = new NotificationWebhookController(
  { execute } as unknown as RecordReceiptsUseCase,
  secrets,
);

beforeEach(() => execute.mockClear());

type Request = Parameters<NotificationWebhookController["receive"]>[1];
const request = (
  headers: Record<string, string>,
  body: unknown,
  raw = JSON.stringify(body),
) => ({ body, headers, rawBody: Buffer.from(raw) }) as unknown as Request;

const receipts = () => (execute.mock.calls[0] as unknown[] | undefined)?.[1];

describe("resend", () => {
  const signed = (body: unknown, raw = JSON.stringify(body)) => {
    const timestamp = String(Math.floor(Date.now() / 1000));
    const signature = createHmac("sha256", Buffer.from(RESEND_KEY))
      .update(`msg_1.${timestamp}.${JSON.stringify(body)}`)
      .digest("base64");
    return request(
      {
        "svix-id": "msg_1",
        "svix-signature": `v1,${signature}`,
        "svix-timestamp": timestamp,
      },
      body,
      raw,
    );
  };
  const event = {
    created_at: "2026-11-01T00:00:00Z",
    data: { email_id: "em_1", subject: "Hi", to: ["grace@home.example"] },
    type: "email.bounced",
  };

  test("records a valid event and tolerates fields it does not read", async () => {
    await controller.receive("resend", signed(event));
    expect(receipts()).toEqual([
      {
        destination: "grace@home.example",
        providerId: "em_1",
        status: "bounced",
        suppress: "bounced",
      },
    ]);
  });

  test("acknowledges an event it does not act on", async () => {
    await controller.receive(
      "resend",
      signed({ data: { id: "ct_1" }, type: "contact.created" }),
    );
    expect(receipts()).toEqual([]);
  });

  test("refuses a signed event missing what the parser reads", async () => {
    for (const body of [
      { ...event, data: { to: event.data.to } },
      { ...event, data: { ...event.data, email_id: 1 } },
      { data: event.data },
      [],
    ])
      await expect(controller.receive("resend", signed(body))).rejects.toThrow(
        BadRequestException,
      );
    expect(execute).not.toHaveBeenCalled();
  });

  test("refuses an unsigned or altered body before parsing it", async () => {
    await expect(
      controller.receive("resend", request({}, event)),
    ).rejects.toThrow(UnauthorizedException);
    const malformed = { type: "email.bounced" };
    await expect(
      controller.receive("resend", signed(event, JSON.stringify(malformed))),
    ).rejects.toThrow(UnauthorizedException);
    expect(execute).not.toHaveBeenCalled();
  });
});

describe("twilio", () => {
  const signed = (params: Record<string, string>, signedParams = params) =>
    request(
      {
        "x-twilio-signature": createHmac("sha1", secrets.twilioAuthToken)
          .update(
            Object.keys(signedParams)
              .sort()
              .reduce(
                (url, name) => url + name + signedParams[name],
                `${secrets.baseUrl}/twilio`,
              ),
          )
          .digest("base64"),
      },
      params,
    );
  const callback = {
    AccountSid: "AC1",
    ErrorCode: "21610",
    MessageSid: "SM1",
    MessageStatus: "undelivered",
    To: "+15550100",
  };

  test("records a valid callback and tolerates fields it does not read", async () => {
    await controller.receive("twilio", signed(callback));
    expect(receipts()).toEqual([
      {
        destination: "+15550100",
        providerId: "SM1",
        status: "bounced",
        suppress: "opted-out",
      },
    ]);
  });

  test("refuses a signed callback without a sid or a status", async () => {
    const { MessageSid: _sid, ...noSid } = callback;
    const { MessageStatus: _status, ...noStatus } = callback;
    for (const params of [noSid, noStatus])
      await expect(
        controller.receive("twilio", signed(params)),
      ).rejects.toThrow(BadRequestException);
    expect(execute).not.toHaveBeenCalled();
  });

  test("refuses an unsigned or altered callback before parsing it", async () => {
    await expect(
      controller.receive("twilio", request({}, callback)),
    ).rejects.toThrow(UnauthorizedException);
    const { MessageSid: _sid, ...malformed } = callback;
    await expect(
      controller.receive("twilio", signed(malformed, callback)),
    ).rejects.toThrow(UnauthorizedException);
    expect(execute).not.toHaveBeenCalled();
  });
});

describe("meta", () => {
  const signed = (body: unknown, raw = JSON.stringify(body)) =>
    request(
      {
        "x-hub-signature-256": `sha256=${createHmac(
          "sha256",
          secrets.metaAppSecret,
        )
          .update(JSON.stringify(body))
          .digest("hex")}`,
      },
      body,
      raw,
    );
  const notification = (value: unknown) => ({
    entry: [{ changes: [{ field: "messages", value }], id: "WABA_1" }],
    object: "whatsapp_business_account",
  });
  const failed = {
    errors: [{ code: 131050, title: "User stopped marketing messages" }],
    id: "wamid.1",
    recipient_id: "15550100",
    status: "failed",
    timestamp: "1730419200",
  };

  test("records a valid notification and tolerates fields it does not read", async () => {
    await controller.receive(
      "meta",
      signed(
        notification({ messaging_product: "whatsapp", statuses: [failed] }),
      ),
    );
    expect(receipts()).toEqual([
      {
        destination: "15550100",
        providerId: "wamid.1",
        status: "bounced",
        suppress: "opted-out",
      },
    ]);
  });

  test("acknowledges a change with no statuses", async () => {
    await controller.receive(
      "meta",
      signed(notification({ messages: [{ id: "wamid.in" }] })),
    );
    expect(receipts()).toEqual([]);
  });

  test("refuses a signed notification missing or mistyping what the parser reads", async () => {
    for (const body of [
      { object: "whatsapp_business_account" },
      notification({ statuses: [{ ...failed, id: undefined }] }),
      notification({ statuses: [{ ...failed, errors: [{ code: "131050" }] }] }),
      notification({ statuses: "failed" }),
    ])
      await expect(controller.receive("meta", signed(body))).rejects.toThrow(
        BadRequestException,
      );
    expect(execute).not.toHaveBeenCalled();
  });

  test("refuses an unsigned or altered notification before parsing it", async () => {
    const valid = notification({ statuses: [failed] });
    await expect(
      controller.receive("meta", request({}, valid)),
    ).rejects.toThrow(UnauthorizedException);
    await expect(
      controller.receive("meta", signed(valid, JSON.stringify({ entry: 1 }))),
    ).rejects.toThrow(UnauthorizedException);
    expect(execute).not.toHaveBeenCalled();
  });
});
