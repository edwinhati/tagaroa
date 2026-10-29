import { WORKING_DOMAINS } from "@repo/contracts";

export interface Domain {
  slug: string;
  label: string;
  live: boolean;
}

// Keep deployment paths and ports in apps/workspace/microfrontends.json in step.
export const domains: Domain[] = WORKING_DOMAINS.map((domain) => ({
  ...domain,
  live: domain.slug === "engineering",
}));

/** Slugs come from server-owned team bindings, never from display names. */
export function domainsForSlugs(slugs: readonly string[]): Domain[] {
  const mine = new Set(slugs);
  return domains.filter((domain) => mine.has(domain.slug));
}
