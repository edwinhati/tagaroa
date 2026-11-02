/** An Employee row as Frappe HR's REST API returns it. */
export interface FrappeEmployee {
  name: string;
  employee_name: string;
  status: "Active" | "Inactive" | "Suspended" | "Left";
  company_email: string | null;
  personal_email: string | null;
  relieving_date: string | null;
}

/**
 * Frappe HR's REST API, as far as the `hr` connector reads it: one Employee by
 * id at Frappe 16's trailing-slash route, and the paginated Employee list. A
 * record removed from `employees` is a deleted one and answers 404.
 */
export const fakeFrappe = (credentials: { key: string; secret: string }) => {
  const employees = new Map<string, FrappeEmployee>();
  let lists = 0;
  let held: { reached: () => void; released: Promise<void> } | undefined;

  const server = Bun.serve({
    port: 0,
    async fetch(request) {
      if (
        request.headers.get("authorization") !==
        `token ${credentials.key}:${credentials.secret}`
      )
        return new Response(null, { status: 403 });
      const url = new URL(request.url);
      const one = /^\/api\/resource\/Employee\/([^/]+)\/$/.exec(url.pathname);
      if (one) {
        const employee = employees.get(decodeURIComponent(one[1]!));
        return employee
          ? Response.json({ data: employee })
          : Response.json({ exc_type: "DoesNotExistError" }, { status: 404 });
      }
      if (url.pathname !== "/api/resource/Employee")
        return new Response(null, { status: 404 });

      lists += 1;
      if (held) {
        held.reached();
        await held.released;
      }
      const start = Number(url.searchParams.get("limit_start") ?? 0);
      const length = Number(url.searchParams.get("limit_page_length") ?? 20);
      const rows = [...employees.values()]
        .sort((a, b) => a.name.localeCompare(b.name))
        .slice(start, start + length);
      return Response.json({ data: rows });
    },
  });

  return {
    employees,
    url: server.url.origin,
    /** How many times the Employee list has been read. */
    lists: () => lists,
    /**
     * Holds every list read until released, so a reconciliation pass can be
     * kept inside its advisory lock. `reached` resolves on the first one held.
     */
    hold() {
      const reached = Promise.withResolvers<void>();
      const released = Promise.withResolvers<void>();
      held = { reached: reached.resolve, released: released.promise };
      return {
        reached: reached.promise,
        release() {
          held = undefined;
          released.resolve();
        },
      };
    },
    stop: () => server.stop(true),
  };
};
