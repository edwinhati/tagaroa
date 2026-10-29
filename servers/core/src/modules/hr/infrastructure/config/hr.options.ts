import type { FrappeOptions } from "../frappe/frappe";

export const HR_OPTIONS = Symbol("HR_OPTIONS");

/** Null until all four `FRAPPE_*` settings are set; the module is then inert. */
export type HrOptions = (FrappeOptions & { webhookSecret: string }) | null;
