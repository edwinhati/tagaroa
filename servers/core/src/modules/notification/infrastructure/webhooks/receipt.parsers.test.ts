import { expect, test } from "bun:test";

import {
  metaReceipts,
  resendReceipts,
  twilioReceipts,
} from "./receipt.parsers";

test("a Resend bounce suppresses the address", () => {
  expect(
    resendReceipts({
      data: { email_id: "re_1", to: ["ada@example.com"] },
      type: "email.bounced",
    }),
  ).toEqual([
    {
      destination: "ada@example.com",
      providerId: "re_1",
      status: "bounced",
      suppress: "bounced",
    },
  ]);
});

test("a Resend delivery suppresses nothing, and junk is ignored", () => {
  expect(
    resendReceipts({ data: { email_id: "re_1" }, type: "email.delivered" })[0]
      ?.suppress,
  ).toBeNull();
  expect(resendReceipts({ type: "email.delivered" })).toEqual([]);
  expect(resendReceipts("nonsense")).toEqual([]);
});

test("a Twilio STOP is an opt-out, an ordinary failure is not", () => {
  expect(
    twilioReceipts({
      ErrorCode: "21610",
      MessageSid: "SM1",
      MessageStatus: "failed",
      To: "+15550100",
    })[0]?.suppress,
  ).toBe("opted-out");

  expect(
    twilioReceipts({ MessageSid: "SM2", MessageStatus: "undelivered" })[0],
  ).toEqual({
    destination: null,
    providerId: "SM2",
    status: "bounced",
    suppress: null,
  });
});

test("Twilio's in-flight statuses report nothing", () => {
  expect(
    twilioReceipts({ MessageSid: "SM1", MessageStatus: "queued" }),
  ).toEqual([]);
});

test("reads WhatsApp statuses out of Meta's nesting", () => {
  expect(
    metaReceipts({
      entry: [
        {
          changes: [
            {
              value: {
                statuses: [
                  { id: "wamid.1", recipient_id: "628110", status: "read" },
                  {
                    errors: [{ code: 131050 }],
                    id: "wamid.2",
                    recipient_id: "628111",
                    status: "failed",
                  },
                ],
              },
            },
          ],
        },
      ],
    }),
  ).toEqual([
    {
      destination: "628110",
      providerId: "wamid.1",
      status: "delivered",
      suppress: null,
    },
    {
      destination: "628111",
      providerId: "wamid.2",
      status: "bounced",
      suppress: "opted-out",
    },
  ]);
});
