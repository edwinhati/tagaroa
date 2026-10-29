import { render } from "@react-email/render";

import { Shell, type ShellProps } from "./shell.js";

export { brand } from "./brand.js";
export { paragraphs, Shell, type ShellProps } from "./shell.js";
export { tagaroaTheme } from "./theme-tagaroa.js";

/**
 * The rendered wording, wearing the shell.
 *
 * Called at send rather than at enqueue, so `notification.message.payload`
 * stays the small, greppable text it is today and a change to the shell never
 * rewrites a stored row. The trade is deliberate: the log records what was
 * said, not the bytes it was said in.
 *
 * The body arrives with its secrets already substituted back in — this is
 * downstream of `QueuedMessage.outgoingPayload` — so nothing here needs to
 * know that some of it was withheld.
 */
export const renderEmail = (payload: ShellProps): Promise<string> =>
  render(Shell(payload));
