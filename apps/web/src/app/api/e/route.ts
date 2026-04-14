import { handleSentryEnvelope } from "@repo/common/lib/sentry-tunnel";
import type { NextRequest } from "next/server";

export async function POST(request: NextRequest) {
  return handleSentryEnvelope(request);
}
