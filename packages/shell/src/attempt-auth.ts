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
