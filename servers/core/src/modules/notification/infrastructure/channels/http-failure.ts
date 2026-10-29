import { ChannelError } from "../../domain/errors/channel.error";

/** 4xx is the caller's fault and will not fix itself; 408 and 429 will. */
const isPermanent = (status: number): boolean =>
  status >= 400 && status < 500 && status !== 408 && status !== 429;

/**
 * One provider's HTTP refusal, as the domain understands failure.
 *
 * The translation lives with the adapters rather than in `ChannelError` itself,
 * because "permanent" is a fact about Resend's and Twilio's status codes and
 * the domain should not have to learn them.
 */
export const failed = async (
  provider: string,
  response: Response,
): Promise<never> => {
  const body = await response.text().catch(() => "");
  throw new ChannelError(
    `${provider} refused the message (${response.status}): ${body.slice(0, 500)}`,
    isPermanent(response.status),
  );
};

/**
 * How long one provider call may take, response body included.
 *
 * Without it a provider that stops answering holds the dispatcher's pass open,
 * and every channel waits behind it. Well inside the five-minute reclaim
 * window, so a stalled send fails and retries before another drainer can take
 * the row. The abort is not a `ChannelError`, so the retry policy treats it as
 * transient.
 */
export const deadline = (): AbortSignal => AbortSignal.timeout(10_000);
