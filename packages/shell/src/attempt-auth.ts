import { messageFor } from "@repo/contracts";

const CANNOT_REACH = "Can't reach the sign-in service. Try again in a moment.";

/**
 * One Better Auth call, with both ways it can fail turned into a sentence: it
 * rejects outright when the server is unreachable, and resolves with an `error`
 * when the server has an opinion.
 */
export async function attemptAuth<TData>(
  call: () => Promise<{ data?: TData | null; error?: unknown }>,
  rejection: string,
): Promise<{ code?: string; data?: TData | null; failure?: string }> {
  let result;
  try {
    result = await call();
  } catch {
    return { failure: CANNOT_REACH };
  }
  if (!result.error) return { data: result.data };

  const code = (result.error as { code?: unknown }).code;
  return {
    ...(typeof code === "string" ? { code } : {}),
    failure: messageFor(result.error, rejection),
  };
}

/**
 * The same call for react-query, which needs a failure to throw: the server's
 * sentence when it has one, `failure` otherwise, including when no answer came.
 */
export async function authCall<TData>(
  call: () => Promise<{ data?: TData | null; error?: unknown }>,
  failure: string,
): Promise<TData | null | undefined> {
  let result;
  try {
    result = await call();
  } catch {
    throw new Error(failure);
  }
  if (result.error) throw new Error(messageFor(result.error, failure));
  return result.data;
}
