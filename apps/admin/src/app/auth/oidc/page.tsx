import { redirect } from "next/navigation";
import { PostHogClient } from "@repo/posthog-config/posthog-client";
import { OIDCClientDataTable } from "@/components/oidc-client-data-table";

export default async function OIDCClientManagementPage() {
  const posthog = PostHogClient(
    process.env.NEXT_PUBLIC_POSTHOG_KEY!,
    process.env.NEXT_PUBLIC_POSTHOG_HOST!
  );

  const oidcAdministratorFlagEnabled = await posthog.getFeatureFlag(
    "oidc-administator",
    ""
  );

  if (!oidcAdministratorFlagEnabled) {
    redirect("/auth");
  }
  return <OIDCClientDataTable />;
}
