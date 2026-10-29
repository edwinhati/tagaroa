import type { Collection } from "@repo/contracts";
import { queryOptions } from "@tanstack/react-query";

import {
  CORE_URL,
  coreReadCollection,
  coreReadCollectionPage,
  coreReadDocument,
} from "./admin";

/**
 * The wording the workspace sends, and what became of each message.
 *
 * Unlike the rest of this surface, none of it goes through better-auth: the
 * notification module is ours, so these are plain fetches against
 * `servers/core` behind the same admin role.
 */

export type Channel = "email" | "sms" | "whatsapp";

export interface Template {
  id: string;
  key: string;
  channel: Channel;
  locale: string;
  version: number;
  /** `draft`, `published`, or `archived` — one published per key/channel/locale. */
  status: string;
  subject: string | null;
  body: string;
  variables: string[];
  /**
   * The values this wording keeps out of the message log — `password` on the
   * two account templates. Read back and sent again on every edit, so a new
   * version of an existing wording cannot silently lose the declaration.
   */
  secrets: string[];
  updatedAt: string | Date;
}

export interface Message {
  id: string;
  key: string;
  channel: Channel;
  locale: string;
  destination: string;
  /** `pending`, `sending`, `sent`, `delivered`, `bounced`, `failed`, `suppressed`. */
  status: string;
  attempts: number;
  error: string | null;
  /** The provider's own id — what its webhook reports against. */
  providerId: string | null;
  subject: string | null;
  body: string;
  createdAt: string | Date;
  sentAt: string | Date | null;
  completedAt: string | Date | null;
}

export interface ChannelHealth {
  channel: Channel;
  provider: string;
  configured: boolean;
  queued: number;
  sent: number;
  delivered: number;
  failed: number;
  suppressed: number;
}

export interface Overview {
  /** False outside production, where every channel writes to the log instead. */
  live: boolean;
  channels: ChannelHealth[];
  totals: {
    queued: number;
    sent: number;
    delivered: number;
    failed: number;
    suppressed: number;
  };
  series: { day: string; sent: number; failed: number }[];
}

type OverviewDocument = Omit<Overview, "channels" | "series"> & {
  channels: Collection<ChannelHealth>;
  series: Collection<Overview["series"][number]>;
};

export interface Suppression {
  id: string;
  channel: Channel;
  destination: string;
  reason: string;
  createdAt: string | Date;
}

export interface LogFilter {
  status: string[];
  channel: string[];
  search: string;
  page?: number;
  limit?: number;
  sort?: string;
}

export interface TemplateDraft {
  key: string;
  channel: Channel;
  locale: string;
  subject: string | null;
  body: string;
  variables: string[];
  secrets: string[];
}

export const templatesQueryOptions = queryOptions({
  queryKey: ["admin", "notifications", "templates"],
  queryFn: () =>
    coreReadCollection<Template>(
      "/api/notifications/templates?limit=100",
      "Could not read the message wording.",
    ).then((collection) => collection.data),
});

/**
 * Delivery health. Polled, because a console that needs reloading to show a
 * failure is a console someone stops trusting.
 */
export const overviewQueryOptions = queryOptions({
  queryKey: ["admin", "notifications", "overview"],
  queryFn: () =>
    coreReadDocument<OverviewDocument>(
      "/api/notifications/overview?channelsLimit=100&seriesLimit=100",
      "Could not read delivery health.",
    ).then((document) => ({
      ...document,
      channels: document.channels.data,
      series: document.series.data,
    })),
  refetchInterval: 15_000,
});

export const messagesQueryOptions = (filter: LogFilter) => {
  const query = new URLSearchParams({
    limit: String(filter.limit ?? 25),
    page: String(filter.page ?? 1),
    sort: filter.sort || "-createdAt",
  });
  filter.status.forEach((value) => query.append("status", value));
  filter.channel.forEach((value) => query.append("channel", value));
  if (filter.search.trim()) query.set("q", filter.search.trim());

  return queryOptions({
    queryKey: ["admin", "notifications", "messages", filter],
    queryFn: () =>
      coreReadCollectionPage<Message>(
        `/api/notifications/messages?${query.toString()}`,
        "Could not read the message log.",
      ),
    refetchInterval: 15_000,
  });
};

export const suppressionsQueryOptions = (filter: LogFilter) => {
  const query = new URLSearchParams({
    limit: String(filter.limit ?? 25),
    page: String(filter.page ?? 1),
    sort: filter.sort || "-createdAt",
  });
  filter.channel.forEach((value) => query.append("channel", value));
  filter.status.forEach((value) => query.append("reason", value));
  if (filter.search.trim()) query.set("q", filter.search.trim());

  return queryOptions({
    queryKey: ["admin", "notifications", "suppressions", filter],
    queryFn: () =>
      coreReadCollectionPage<Suppression>(
        `/api/notifications/suppressions?${query.toString()}`,
        "Could not read the suppression list.",
      ),
  });
};

/** Lifting one lets the workspace write to that destination again. */
export const liftSuppression = (id: string) =>
  coreWrite(
    `/api/notifications/suppressions/${id}`,
    "DELETE",
    "Could not lift that suppression.",
  );

/**
 * The core service reads the body off the request stream — the Nest app runs
 * with `bodyParser: false` so Better Auth sees its own requests untouched — so
 * these send JSON and read the failure out of the response themselves.
 */
async function coreWrite(
  path: string,
  method: string,
  failure: string,
  body?: unknown,
): Promise<void> {
  const response = await fetch(`${CORE_URL}${path}`, {
    credentials: "include",
    ...(body === undefined
      ? {}
      : {
          body: JSON.stringify(body),
          headers: { "content-type": "application/json" },
        }),
    method,
  });
  if (response.ok) return;

  const said = await response.json().catch(() => null);
  throw new Error(
    (said && typeof said === "object" && "message" in said
      ? String((said as { message: unknown }).message)
      : "") || failure,
  );
}

export const createTemplate = (draft: TemplateDraft) =>
  coreWrite(
    "/api/notifications/templates",
    "POST",
    "Could not save that wording.",
    draft,
  );

export const editTemplate = (
  id: string,
  draft: TemplateDraft,
  updatedAt: string | Date,
) =>
  coreWrite(
    `/api/notifications/templates/${id}`,
    "PUT",
    "Could not save that draft.",
    { ...draft, expectedUpdatedAt: new Date(updatedAt).toISOString() },
  );

/** Publishing retires whichever version was published before it. */
export const publishTemplate = (id: string) =>
  coreWrite(
    `/api/notifications/templates/${id}/publish`,
    "POST",
    "Could not publish that version.",
  );

export const deleteTemplate = (id: string) =>
  coreWrite(
    `/api/notifications/templates/${id}`,
    "DELETE",
    "Could not discard that draft.",
  );

/** `{{name}}` — what the wording asks the sender to supply. */
export const placeholdersIn = (text: string): string[] => [
  ...new Set(
    [...text.matchAll(/\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g)].map(
      (match) => match[1]!,
    ),
  ),
];
