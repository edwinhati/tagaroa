import { expect, test } from "bun:test";
import { createHmac } from "node:crypto";

import {
  verifyMetaSignature,
  verifySvixSignature,
  verifyTwilioSignature,
} from "./notification.signatures";

const SVIX_SECRET = `whsec_${Buffer.from("a-signing-secret").toString("base64")}`;

const svixHeader = (id: string, timestamp: string, payload: string): string =>
  `v1,${createHmac(
    "sha256",
    Buffer.from(SVIX_SECRET.replace(/^whsec_/, ""), "base64"),
  )
    .update(`${id}.${timestamp}.${payload}`)
    .digest("base64")}`;

const now = new Date("2026-01-01T00:00:00Z");
const stamp = String(Math.floor(now.getTime() / 1000));

test("accepts a Resend signature, and a second key alongside it", () => {
  const payload = '{"type":"email.delivered"}';
  const valid = svixHeader("msg_1", stamp, payload);

  expect(
    verifySvixSignature({
      id: "msg_1",
      now,
      payload,
      secret: SVIX_SECRET,
      signature: `v1,AAAA ${valid}`,
      timestamp: stamp,
    }),
  ).toBe(true);
});

test("rejects a Resend body that was altered after signing", () => {
  const signature = svixHeader("msg_1", stamp, '{"type":"email.delivered"}');

  expect(
    verifySvixSignature({
      id: "msg_1",
      now,
      payload: '{"type":"email.bounced"}',
      secret: SVIX_SECRET,
      signature,
      timestamp: stamp,
    }),
  ).toBe(false);
});

test("rejects a replayed Resend request", () => {
  const old = String(Math.floor(now.getTime() / 1000) - 3600);
  const payload = '{"type":"email.delivered"}';

  expect(
    verifySvixSignature({
      id: "msg_1",
      now,
      payload,
      secret: SVIX_SECRET,
      signature: svixHeader("msg_1", old, payload),
      timestamp: old,
    }),
  ).toBe(false);
});

test("accepts Twilio's URL-and-sorted-fields signature", () => {
  const url = "https://api.example.com/api/notifications/webhooks/twilio";
  const params = { MessageSid: "SM1", MessageStatus: "delivered" };
  const signature = createHmac("sha1", "token")
    .update(`${url}MessageSidSM1MessageStatusdelivered`, "utf8")
    .digest("base64");

  expect(
    verifyTwilioSignature({ authToken: "token", params, signature, url }),
  ).toBe(true);
  expect(
    verifyTwilioSignature({
      authToken: "token",
      params: { ...params, MessageStatus: "failed" },
      signature,
      url,
    }),
  ).toBe(false);
});

test("accepts Meta's sha256 body signature and rejects a wrong secret", () => {
  const payload = '{"entry":[]}';
  const signature = `sha256=${createHmac("sha256", "app-secret").update(payload).digest("hex")}`;

  expect(
    verifyMetaSignature({ appSecret: "app-secret", payload, signature }),
  ).toBe(true);
  expect(verifyMetaSignature({ appSecret: "other", payload, signature })).toBe(
    false,
  );
});

test("refuses every provider's signature under an empty key, which anyone can forge", () => {
  const payload = '{"type":"email.bounced"}';
  const emptyKey = Buffer.alloc(0);
  const svix = `v1,${createHmac("sha256", emptyKey)
    .update(`msg_1.${stamp}.${payload}`)
    .digest("base64")}`;

  // An empty setting, and `whsec_` with nothing after it, both decode to no key.
  for (const secret of ["", "whsec_"]) {
    expect(
      verifySvixSignature({
        id: "msg_1",
        now,
        payload,
        secret,
        signature: svix,
        timestamp: stamp,
      }),
    ).toBe(false);
  }

  const url = "https://core.example/api/notifications/webhooks/twilio";
  expect(
    verifyTwilioSignature({
      authToken: "",
      params: {},
      signature: createHmac("sha1", emptyKey).update(url).digest("base64"),
      url,
    }),
  ).toBe(false);

  expect(
    verifyMetaSignature({
      appSecret: "",
      payload,
      signature: `sha256=${createHmac("sha256", emptyKey).update(payload).digest("hex")}`,
    }),
  ).toBe(false);
});
