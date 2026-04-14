import { type NextRequest, NextResponse } from "next/server";

function extractDsnFromEnvelope(
  envelope: string,
): { host: string; projectId: string } | null {
  const firstLine = envelope.split("\n")[0];
  if (!firstLine) return null;
  try {
    const header = JSON.parse(firstLine);
    const dsn = header.dsn;
    if (!dsn) return null;
    const match = dsn.match(/^https:\/\/([^@]+)@([^/]+)\/(\d+)$/);
    if (!match) return null;
    return { host: match[2], projectId: match[3] };
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    const envelope = await request.text();
    const dsnInfo = extractDsnFromEnvelope(envelope);
    if (!dsnInfo) {
      return NextResponse.json(
        { error: "Invalid envelope: missing DSN" },
        { status: 400 },
      );
    }
    const sentryUrl = `https://${dsnInfo.host}/api/${dsnInfo.projectId}/envelope/`;
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
  } catch (error) {
    console.error("[Sentry Tunnel] Error:", error);
    return NextResponse.json(
      { error: "Failed to forward to Sentry" },
      { status: 500 },
    );
  }
}
