import * as z from "zod";

import { objectBody } from "../../../platform/http/request-fields";

const NAME_REQUIRED = "Send the employee's name";

/**
 * Frappe's Employee webhook. Frappe posts whatever fields the webhook is set up
 * with; only `name` is read, because the record is re-read from Frappe. Other
 * keys are dropped rather than refused.
 */
export const frappeEmployeeWebhook = objectBody({
  name: z.string({ error: NAME_REQUIRED }).min(1, NAME_REQUIRED),
});
