import { BadRequestException } from "@nestjs/common";
import type { NotificationChannel } from "@repo/contracts/notifications";

export interface TemplateDraftProps {
  key: string;
  channel: NotificationChannel;
  locale: string;
  subject: string | null;
  body: string;
  variables: string[];
  secrets: string[];
}

/** `account.issued`: what happened, in the wording the admin app lists by. */
const KEY = /^[a-z0-9]+(?:[.-][a-z0-9]+)+$/;

/** Meta's own naming rule for an approved template. */
const WHATSAPP_TEMPLATE_NAME = /^[a-z0-9_]+$/;

/**
 * A template as typed into the admin app, checked before it can exist.
 *
 * A value object rather than a validator returning a bag, so that a
 * `TemplateDraft` in hand is proof the checks ran. The request schema fixes the
 * shape; these are the rules the database constraints cannot see: an email with
 * no subject line, or a WhatsApp row holding a sentence where Meta expects the
 * name of a template it has already approved. Both send perfectly happily and
 * arrive wrong.
 */
export class TemplateDraft {
  private constructor(private readonly props: TemplateDraftProps) {}

  static create(input: TemplateDraftProps): TemplateDraft {
    const { body, channel, key, secrets, variables } = input;
    if (!KEY.test(key)) {
      throw new BadRequestException("key must look like account.issued");
    }
    if (channel === "whatsapp" && !WHATSAPP_TEMPLATE_NAME.test(body)) {
      throw new BadRequestException(
        "A WhatsApp body is the approved template's name: lowercase, digits and underscores",
      );
    }
    // WhatsApp fills an approved template by position, so a secret would have
    // to travel as one of those parameters — where a placeholder means nothing
    // and the value would be written down after all.
    if (channel === "whatsapp" && secrets.length > 0) {
      throw new BadRequestException(
        "A WhatsApp template cannot carry a secret variable",
      );
    }
    const undeclared = secrets.filter((name) => !variables.includes(name));
    if (undeclared.length > 0) {
      throw new BadRequestException(
        `secrets must name variables this template declares: ${undeclared.join(", ")}`,
      );
    }
    const subject = input.subject?.trim() || null;
    if (channel === "email" && !subject) {
      throw new BadRequestException("subject is required");
    }

    return new TemplateDraft({
      ...input,
      secrets: [...secrets],
      subject: channel === "email" ? subject : null,
      variables: [...variables],
    });
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

  get subject(): string | null {
    return this.props.subject;
  }

  get body(): string {
    return this.props.body;
  }

  get variables(): string[] {
    return [...this.props.variables];
  }

  /** Which of those variables must never be written into a message row. */
  get secrets(): string[] {
    return [...this.props.secrets];
  }

  /** The fields as a plain object, for a repository to write. */
  get fields(): TemplateDraftProps {
    return {
      ...this.props,
      secrets: [...this.props.secrets],
      variables: [...this.props.variables],
    };
  }
}
