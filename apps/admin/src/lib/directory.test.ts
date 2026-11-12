import { expect, spyOn, test } from "bun:test";

import { isCancelledError, QueryClient } from "@tanstack/react-query";

import { directoryQueryOptions } from "./directory";

test("cancelling a paginated directory read aborts the active request", async () => {
  const client = new QueryClient();
  let started!: () => void;
  const secondPage = new Promise<void>((resolve) => {
    started = resolve;
  });
  let signal: AbortSignal | null | undefined;
  const fetcher = spyOn(globalThis, "fetch").mockImplementation(
    Object.assign(
      async (
        _url: Parameters<typeof fetch>[0],
        options?: Parameters<typeof fetch>[1],
      ) => {
        if (fetcher.mock.calls.length === 1) {
          return Response.json({
            data: {
              positions: { data: [], links: {} },
              subsidiaries: { data: [], links: {} },
              teams: {
                data: [],
                links: { next: "/api/directory?teamsPage=2" },
              },
            },
          });
        }
        signal = options?.signal;
        started();
        return new Promise<Response>((_resolve, reject) => {
          signal?.addEventListener(
            "abort",
            () =>
              reject(
                new DOMException("Cancelled directory fixture", "AbortError"),
              ),
            { once: true },
          );
        });
      },
      { preconnect: globalThis.fetch.preconnect },
    ),
  );
  try {
    const result = client
      .fetchQuery({ ...directoryQueryOptions, retry: false })
      .catch((error: unknown) => error);
    await secondPage;
    await client.cancelQueries({ queryKey: directoryQueryOptions.queryKey });
    expect(isCancelledError(await result)).toBe(true);
    expect(signal?.aborted).toBe(true);
    expect(fetcher).toHaveBeenCalledTimes(2);
  } finally {
    client.clear();
    fetcher.mockRestore();
  }
});
