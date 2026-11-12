import { expect, test } from "bun:test";

import type { Suppression } from "../../domain/entities/suppression.entity";
import type {
  MessageRepository,
  ReceiptOutcome,
} from "../../domain/repositories/message.repository";
import type { SuppressionRepository } from "../../domain/repositories/suppression.repository";
import { RecordReceiptsUseCase } from "./record-receipts.use-case";

const bounce = {
  destination: "gone@example.com",
  providerId: "re_1",
  status: "bounced",
  suppress: "bounced",
} as const;

const suppressionsAfter = async (outcome: ReceiptOutcome) => {
  const raised: Suppression[] = [];
  await new RecordReceiptsUseCase(
    { applyReceipt: async () => outcome } as unknown as MessageRepository,
    {
      add: async (suppression: Suppression) => {
        raised.push(suppression);
      },
    } as unknown as SuppressionRepository,
  ).execute("resend", [bounce]);
  return raised.length;
};

test("a bounce blocks the address the first time it arrives", async () => {
  expect(await suppressionsAfter("applied")).toBe(1);
});

test("a bounce for a message not yet recorded as sent still blocks it", async () => {
  expect(await suppressionsAfter("unmatched")).toBe(1);
});

test("a retried bounce leaves an address an admin has cleared alone", async () => {
  expect(await suppressionsAfter("repeat")).toBe(0);
});
