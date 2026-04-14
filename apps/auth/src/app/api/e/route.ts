import { type NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const envelope = await request.text();
  const { searchParams } = new URL(request.url);
  const sentryUrl = `https://o${searchParams.get("o")}.ingest.${searchParams.get("r") || "us"}.sentry.io/api/${searchParams.get("p")}/envelope/`;

  const response = await fetch(sentryUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-sentry-envelope" },
    body: envelope,
  });

  return new NextResponse(await response.text(), {
    status: response.status,
    headers: {
      "Content-Type":
        response.headers.get("Content-Type") || "application/json",
    },
  });
}
