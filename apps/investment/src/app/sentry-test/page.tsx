import { SentryTestConsole } from "@repo/common/components/sentry-test-console";
import { notFound } from "next/navigation";

export default function SentryTestPage() {
  if (process.env.NODE_ENV !== "development") {
    notFound();
  }
  return <SentryTestConsole />;
}
