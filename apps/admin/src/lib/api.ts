import {
  type ApiDocument,
  asObject,
  type Collection,
  messageFor,
} from "@repo/contracts";
import { REFUSAL_CODES } from "@repo/contracts/identity";
import { authClient } from "@repo/shell/auth-client";
import { AUTH_URL, CORE_URL } from "@repo/shell/urls";
import { toast } from "@repo/ui/components/toast";

/**
 * better-auth resolves with `{ data, error }` rather than rejecting, so a failed
 * write looks exactly like a successful one to react-query. Every mutation on
 * this surface goes through here, or it will report success it did not have.
 */
export async function write<T>(
  call: () => Promise<{
    data?: T;
    error?: { code?: string; message?: string; status?: number } | null;
  }>,
  failure: string,
): Promise<T | undefined> {
  const { data, error } = await call();
  if (error)
    throw new AdminApiError(
      error.message || failure,
      error.code,
      error.status ?? 0,
    );
  return data;
}

/**
 * Team writes are resolved against the session's active organization, not the
 * team's own — an admin who has not "entered" a subsidiary gets
 * NO_ACTIVE_ORGANIZATION. Setting it first makes the call mean what it reads
 * like.
 */
export async function inSubsidiary<T>(
  organizationId: string,
  call: () => Promise<{ data?: T; error?: { message?: string } | null }>,
  failure: string,
): Promise<T | undefined> {
  await write(
    () => authClient.organization.setActive({ organizationId }),
    "Could not switch to that subsidiary.",
  );
  return write(call, failure);
}

export class AdminApiError extends Error {
  constructor(
    message: string,
    readonly code: string | undefined,
    readonly status: number,
  ) {
    super(message);
    this.name = "AdminApiError";
  }
}

type Method = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";

/**
 * One request to the core service. A refusal is an `AdminApiError` carrying
 * the server's code and status: a write says what the server said, a read says
 * what could not be loaded.
 */
async function core<T>(
  path: string,
  {
    body,
    failure,
    method = "GET",
    signal,
  }: { body?: unknown; failure: string; method?: Method; signal?: AbortSignal },
): Promise<T> {
  const response = await fetch(`${CORE_URL}${path}`, {
    ...(body === undefined
      ? {}
      : {
          body: JSON.stringify(body),
          headers: { "content-type": "application/json" },
        }),
    credentials: "include",
    method,
    signal,
  });
  const said: unknown =
    response.status === 204 ? null : await response.json().catch(() => null);
  if (!response.ok) {
    const code = asObject(said)?.code;
    throw new AdminApiError(
      method === "GET" ? failure : messageFor(said, failure),
      typeof code === "string" ? code : undefined,
      response.status,
    );
  }
  return said as T;
}

export async function coreReadDocument<T>(
  path: string,
  failure: string,
  signal?: AbortSignal,
): Promise<T> {
  return (await core<ApiDocument<T>>(path, { failure, signal })).data;
}

export async function coreMutationDocument<T>(
  path: string,
  method: Exclude<Method, "GET">,
  body: object | undefined,
  failure: string,
): Promise<T> {
  return (await core<ApiDocument<T> | null>(path, { body, failure, method }))
    ?.data as T;
}

export function reauthenticateForCurrentPage(): void {
  const target = new URL("/reauth", AUTH_URL);
  target.searchParams.set("redirect", window.location.href);
  window.location.assign(target);
}

export async function coreReadCollection<T>(
  path: string,
  failure: string,
): Promise<Collection<T>> {
  let page = await core<Collection<T>>(path, { failure });
  const data = [...page.data];
  const seen = new Set<string>();
  while (page.links.next && !seen.has(page.links.next)) {
    seen.add(page.links.next);
    page = await core<Collection<T>>(page.links.next, { failure });
    data.push(...page.data);
  }
  return { ...page, data, meta: { ...page.meta, total: data.length } };
}

export const coreReadCollectionPage = <T>(path: string, failure: string) =>
  core<Collection<T>>(path, { failure });

export async function exhaustNested<TDocument, T>(
  initial: TDocument,
  select: (document: TDocument) => Collection<T>,
  failure: string,
  signal?: AbortSignal,
): Promise<T[]> {
  let page = select(initial);
  const data = [...page.data];
  const seen = new Set<string>();
  while (page.links.next && !seen.has(page.links.next)) {
    seen.add(page.links.next);
    const document = await coreReadDocument<TDocument>(
      page.links.next,
      failure,
      signal,
    );
    page = select(document);
    data.push(...page.data);
  }
  return data;
}

/**
 * What a mutation says when it lands. Both branches, always: a silent success is
 * indistinguishable from a silent failure, and every action on this surface
 * changes what someone else can reach.
 */
export const announce = {
  done: (title: string) => toast.add({ title, type: "success" }),
  /** A stale sign-in goes to re-authenticate; anything else is announced. */
  failed: (error: Error) => {
    if (
      error instanceof AdminApiError &&
      error.code === REFUSAL_CODES.sessionNotFresh
    )
      return reauthenticateForCurrentPage();
    toast.add({
      description: error.message,
      title: "That did not happen",
      type: "error",
    });
  },
};
