import type { NotificationChannel } from "../value-objects/notification-channel.vo";
import {
  renderTemplate,
  type RenderedMessage,
  type TemplateWording,
} from "../value-objects/rendered-payload.vo";

export interface TemplateProps {
  id: string;
  key: string;
  channel: NotificationChannel;
  locale: string;
  version: number;
  status: string;
  subject: string | null;
  body: string;
  variables: string[];
  secrets: string[];
  updatedAt: Date;
}

/**
 * Secrets the code owns, whatever the row says. Admins edit template rows, so a
 * row's own `secrets` is only ever added to: a new wording published with
 * `"secrets": []` must not write a temporary password into the message log an
 * admin can read (ADR 0001).
 */
const REQUIRED_SECRETS: ReadonlyMap<string, readonly string[]> = new Map([
  ["account.issued", ["password"]],
  ["account.password-reset", ["password"]],
]);

/** Never sent as a bare placeholder, whichever wording a message came from. */
export const CODE_OWNED_SECRETS: ReadonlySet<string> = new Set(
  [...REQUIRED_SECRETS.values()].flat(),
);

/**
 * The wording of one message, in one language, on one channel.
 *
 * Versioned and published rather than edited in place: a message already queued
 * was rendered from the row that was published when it was enqueued, so
 * correcting a typo never rewrites what someone has already received and the
 * log stays a record of what was actually sent.
 */
export class Template {
  private constructor(private readonly props: TemplateProps) {}

  static restore(props: TemplateProps): Template {
    return new Template(props);
  }

  get id(): string {
    return this.props.id;
  }

  get key(): string {
    return this.props.key;
  }

  get channel(): NotificationChannel {
    return this.props.channel;
  }

  get locale(): string {
    return this.props.locale;
  }

  get version(): number {
    return this.props.version;
  }

  get status(): string {
    return this.props.status;
  }

  get subject(): string | null {
    return this.props.subject;
  }

  get body(): string {
    return this.props.body;
  }

  get variables(): string[] {
    return [...this.props.variables];
  }

  /** The variables this wording refuses to have written down. */
  get secrets(): string[] {
    return [
      ...new Set([
        ...this.props.secrets,
        ...(REQUIRED_SECRETS.get(this.props.key) ?? []),
      ]),
    ];
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  get published(): boolean {
    return this.props.status === "published";
  }

  /** Only a draft may be edited; a published version is history. */
  get editable(): boolean {
    return this.props.status === "draft";
  }

  get wording(): TemplateWording {
    return {
      body: this.props.body,
      channel: this.props.channel,
      secrets: this.secrets,
      subject: this.props.subject,
      variables: [...this.props.variables],
    };
  }

  /**
   * The finished message. Refuses a missing variable rather than sending a
   * placeholder — see `renderTemplate`.
   */
  render(variables: Readonly<Record<string, string>> = {}): RenderedMessage {
    return renderTemplate(this.wording, variables);
  }
}
