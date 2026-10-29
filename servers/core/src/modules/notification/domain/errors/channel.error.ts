/**
 * A send that failed, and whether trying again could help.
 *
 * A rejected number or an unapproved template fails the same way on every
 * attempt, so retrying it only delays the failure showing up in the log — and,
 * on WhatsApp and SMS, costs money each time. The distinction is a domain fact
 * rather than an HTTP one, which is why it is stated here and translated from
 * each provider's status codes by its adapter.
 */
export class ChannelError extends Error {
  constructor(
    message: string,
    readonly permanent: boolean,
  ) {
    super(message);
    this.name = "ChannelError";
  }
}
