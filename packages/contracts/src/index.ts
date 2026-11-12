/**
 * The shapes that cross the boundary between the core service and the apps: the
 * envelope every endpoint answers in, and the guards for reading values
 * TypeScript cannot vouch for — request bodies, responses, and errors that
 * arrive as `unknown`. Both ends do this, so the agreement is written once.
 */

export type ObjectLike = Record<string, unknown>;

export interface ApiDocument<T> {
  data: T;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  offset: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

export interface PaginationLinks {
  self: string;
  first: string;
  last: string;
  previous?: string;
  next?: string;
}

export interface AggregationBucket {
  value: string;
  count: number;
}

export type Aggregations = Record<string, AggregationBucket[]>;

export interface Collection<T> {
  data: T[];
  meta: PaginationMeta & { aggregations?: Aggregations };
  links: PaginationLinks;
}

/**
 * A response type as the apps receive it. The types here are written as core
 * builds them, with `Date`s; JSON turns every one into an ISO string.
 */
export type Wire<T> = T extends Date
  ? string
  : T extends readonly (infer U)[]
    ? Wire<U>[]
    : T extends object
      ? { [K in keyof T]: Wire<T[K]> }
      : T;

/** The value as a plain object, or undefined when it is not one. */
export function asObject(value: unknown): ObjectLike | undefined {
  return typeof value === "object" && value !== null
    ? (value as ObjectLike)
    : undefined;
}

/**
 * The message the thrown value carries, when it has a useful one. Anything
 * else — a string, a bare object, a rejection with no message — gets the
 * sentence the caller owns.
 */
export function messageFor(error: unknown, fallback: string): string {
  const message = asObject(error)?.message;
  if (typeof message === "string" && message.length > 0) return message;
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

export const WORKING_DOMAINS = [
  { slug: "engineering", label: "Engineering" },
  { slug: "finance", label: "Finance" },
  { slug: "industry", label: "Industry" },
  { slug: "logistic", label: "Logistic" },
  { slug: "marketing", label: "Marketing" },
  { slug: "operation", label: "Operation" },
  { slug: "research", label: "Research" },
  { slug: "sales", label: "Sales" },
  { slug: "supply-chain", label: "Supply chain" },
] as const;
export type WorkingDomainSlug = (typeof WORKING_DOMAINS)[number]["slug"];
