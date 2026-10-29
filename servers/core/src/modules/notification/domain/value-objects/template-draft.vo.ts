import { BadRequestException } from "@nestjs/common";
import { asObject } from "@repo/contracts";

import {
  type NotificationChannel,
  NOTIFICATION_CHANNELS,
} from "./notification-channel.vo";

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

const string = (value: unknown, field: string): string => {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new BadRequestException(`${field} is required`);
  }
  return value.trim();
};

/**
 * A template as typed into the admin app, checked before it can exist.
 *
 * A value object rather than a validator returning a bag, so that a
 * `TemplateDraft` in hand is proof the checks ran. The failures worth catching
 * are the ones the database constraints cannot see: an email with no subject
 * line, or a WhatsApp row holding a sentence where Meta expects the name of a
 * template it has already approved. Both send perfectly happily and arrive
 * wrong.
 */
export class TemplateDraft {
  private constructor(private readonly props: TemplateDraftProps) {}

  static parse(input: unknown): TemplateDraft {
    const raw = asObject(input);
    if (!raw) throw new BadRequestException("A template is required");

    const key = string(raw.key, "key");
    if (!KEY.test(key)) {
      throw new BadRequestException("key must look like account.issued");
    }

    const channel = string(raw.channel, "channel");
    if (!(NOTIFICATION_CHANNELS as readonly string[]).includes(channel)) {
      throw new BadRequestException(
        `channel must be one of ${NOTIFICATION_CHANNELS.join(", ")}`,
      );
    }

    const body = string(raw.body, "body");
    if (channel === "whatsapp" && !WHATSAPP_TEMPLATE_NAME.test(body)) {
      throw new BadRequestException(
        "A WhatsApp body is the approved template's name: lowercase, digits and underscores",
      );
    }

    const variables = Array.isArray(raw.variables) ? raw.variables : [];
    if (variables.some((name) => typeof name !== "string")) {
      throw new BadRequestException("variables must be a list of names");
    }

    const secrets = Array.isArray(raw.secrets) ? raw.secrets : [];
    if (secrets.some((name) => typeof name !== "string")) {
      throw new BadRequestException("secrets must be a list of names");
    }
    // WhatsApp fills an approved template by position, so a secret would have
    // to travel as one of those parameters — where a placeholder means nothing
    // and the value would be written down after all.
    if (channel === "whatsapp" && secrets.length > 0) {
      throw new BadRequestException(
        "A WhatsApp template cannot carry a secret variable",
      );
    }
    const undeclared = (secrets as string[]).filter(
      (name) => !(variables as string[]).includes(name),
    );
    if (undeclared.length > 0) {
      throw new BadRequestException(
        `secrets must name variables this template declares: ${undeclared.join(", ")}`,
      );
    }

    return new TemplateDraft({
      body,
      channel: channel as NotificationChannel,
      key,
      locale: string(raw.locale, "locale"),
      secrets: secrets as string[],
      subject: channel === "email" ? string(raw.subject, "subject") : null,
      variables: variables as string[],
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
