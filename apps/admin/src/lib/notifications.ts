import type { Collection } from "@repo/contracts";
import {
  MESSAGE_SORT_FIELDS,
  MESSAGE_STATUSES,
  type MessageStatus,
  NOTIFICATION_CHANNELS,
  type NotificationChannel,
  SUPPRESSION_REASONS,
  SUPPRESSION_SORT_FIELDS,
  type SuppressionReason,
  type TemplateStatus,
} from "@repo/contracts/notifications";
import { queryOptions } from "@tanstack/react-query";

import {
  coreMutationDocument,
  coreReadCollection,
  coreReadCollectionPage,
  coreReadDocument,
} from "./admin";
import {
  type CollectionSearch,
  collectionRequest,
  facetSearch,
  parseCollectionSearch,
} from "./collection-search";

/**
 * The wording the workspace sends, and what became of each message.
 *
 * Unlike the rest of this surface, none of it goes through better-auth: the
 * notification module is ours, so these are plain fetches against
 * `servers/core` behind the same admin role.
 */

export type Channel = NotificationChannel;

export interface Template {
  id: string;
  key: string;
  channel: Channel;
  locale: string;
  version: number;
  /** One published per key/channel/locale. */
  status: TemplateStatus;
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
  status: MessageStatus;
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
  reason: SuppressionReason;
  createdAt: string | Date;
}

export interface DeliverySearch extends CollectionSearch {
  channel?: string[];
  status?: string[];
}

export interface SuppressionSearch extends CollectionSearch {
  channel?: string[];
  reason?: string[];
}

export const DELIVERY_FACETS = {
  channel: NOTIFICATION_CHANNELS,
  status: MESSAGE_STATUSES,
};

export const SUPPRESSION_FACETS = {
  channel: NOTIFICATION_CHANNELS,
  reason: SUPPRESSION_REASONS,
};

export const validateDeliverySearch = (
  search: Record<string, unknown>,
): DeliverySearch => ({
  ...parseCollectionSearch(search, MESSAGE_SORT_FIELDS),
  ...facetSearch(search, DELIVERY_FACETS),
});

export const validateSuppressionSearch = (
  search: Record<string, unknown>,
): SuppressionSearch => ({
  ...parseCollectionSearch(search, SUPPRESSION_SORT_FIELDS),
  ...facetSearch(search, SUPPRESSION_FACETS),
});

/** Every notification read sits under this key, so a write refreshes them all. */
export const NOTIFICATIONS_QUERY_KEY = ["admin", "notifications"] as const;

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
  queryKey: [...NOTIFICATIONS_QUERY_KEY, "templates"],
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
  queryKey: [...NOTIFICATIONS_QUERY_KEY, "overview"],
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

export const messagesQueryOptions = (search: DeliverySearch) => {
  const url = collectionRequest(
    "/api/notifications/messages",
    search,
    DELIVERY_FACETS,
  );
  return queryOptions({
    queryKey: [...NOTIFICATIONS_QUERY_KEY, "messages", url],
    queryFn: () =>
      coreReadCollectionPage<Message>(url, "Could not read the message log."),
    refetchInterval: 15_000,
  });
};

export const suppressionsQueryOptions = (search: SuppressionSearch) => {
  const url = collectionRequest(
    "/api/notifications/suppressions",
    search,
    SUPPRESSION_FACETS,
  );
  return queryOptions({
    queryKey: [...NOTIFICATIONS_QUERY_KEY, "suppressions", url],
    queryFn: () =>
      coreReadCollectionPage<Suppression>(
        url,
        "Could not read the suppression list.",
      ),
  });
};

/** Lifting one lets the workspace write to that destination again. */
export const liftSuppression = (id: string) =>
  coreMutationDocument<void>(
    `/api/notifications/suppressions/${id}`,
    "DELETE",
    undefined,
    "Could not lift that suppression.",
  );

export const createTemplate = (draft: TemplateDraft) =>
  coreMutationDocument<void>(
    "/api/notifications/templates",
    "POST",
    draft,
    "Could not save that wording.",
  );

export const editTemplate = (
  id: string,
  draft: TemplateDraft,
  updatedAt: string | Date,
) =>
  coreMutationDocument<void>(
    `/api/notifications/templates/${id}`,
    "PUT",
    { ...draft, expectedUpdatedAt: new Date(updatedAt).toISOString() },
    "Could not save that draft.",
  );

/** Publishing retires whichever version was published before it. */
export const publishTemplate = (id: string) =>
  coreMutationDocument<void>(
    `/api/notifications/templates/${id}/publish`,
    "POST",
    undefined,
    "Could not publish that version.",
  );

export const deleteTemplate = (id: string) =>
  coreMutationDocument<void>(
    `/api/notifications/templates/${id}`,
    "DELETE",
    undefined,
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
