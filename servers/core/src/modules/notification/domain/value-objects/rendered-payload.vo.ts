import type { NotificationChannel } from "@repo/contracts/notifications";

import type { NotificationPayload } from "./notification-channel.vo";

/** `{{ name }}`, with or without the spaces. */
const VARIABLE = /\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g;

export interface TemplateWording {
  channel: NotificationChannel;
  subject: string | null;
  body: string;
  variables: string[];
  /**
   * The variables whose values must never be written down — `password`, today.
   * Named on the wording rather than guessed from the value, so that a template
   * declares its own hazard and a new one cannot be introduced by accident.
   */
  secrets: string[];
}

/**
 * A rendered message, split in two.
 *
 * `payload` is what is safe to keep: the finished text with every secret still
 * standing as its `{{name}}` placeholder. `secrets` is what finishes it, held
 * only until the message leaves. Storing them apart is what lets the row be a
 * permanent log of a message that carried a live credential.
 */
export interface RenderedMessage {
  payload: NotificationPayload;
  secrets: Record<string, string> | null;
}

/**
 * Substitution deliberately refuses a missing variable rather than leaving the
 * placeholder in place: an email that reads "Hello {{name}}" has already been
 * sent by the time anyone notices, whereas a throw here fails the caller's
 * transaction and the message is never queued.
 */
export const renderText = (
  text: string,
  variables: Readonly<Record<string, string>>,
): string =>
  text.replace(VARIABLE, (_match, name: string) => {
    const value = variables[name];
    if (value === undefined) {
      throw new Error(`Template variable "${name}" was not supplied`);
    }
    return value;
  });

/**
 * The send-time half: fills only secret placeholders. A variable's value that
 * contains `{{word}}` is someone's text, not syntax, so it is left as written.
 */
export const restoreSecrets = (
  text: string,
  secrets: Readonly<Record<string, string>>,
  required: ReadonlySet<string>,
): string =>
  text.replace(VARIABLE, (placeholder, name: string) => {
    const value = secrets[name];
    if (value !== undefined) return value;
    if (required.has(name)) {
      throw new Error(`Template variable "${name}" was not supplied`);
    }
    return placeholder;
  });

/**
 * WhatsApp fills a Meta-approved template by position, not by name, so the
 * template row carries the order and this puts the values in it.
 */
export const orderedVariables = (
  names: readonly string[],
  variables: Readonly<Record<string, string>>,
): string[] =>
  names.map((name) => {
    const value = variables[name];
    if (value === undefined) {
      throw new Error(`Template variable "${name}" was not supplied`);
    }
    return value;
  });

/**
 * A secret substitutes to its own placeholder, so the rendered text keeps the
 * shape of the message — "Temporary password: {{password}}" — while the value
 * goes nowhere near it. A reader of the log can see exactly where the
 * credential stood without being handed it.
 */
const withPlaceholders = (
  variables: Readonly<Record<string, string>>,
  secrets: readonly string[],
): Readonly<Record<string, string>> => {
  if (secrets.length === 0) return variables;

  const masked: Record<string, string> = { ...variables };
  for (const name of secrets) {
    if (name in masked) masked[name] = `{{${name}}}`;
  }
  return masked;
};

const secretValues = (
  variables: Readonly<Record<string, string>>,
  secrets: readonly string[],
): Record<string, string> | null => {
  const held: Record<string, string> = {};
  for (const name of secrets) {
    const value = variables[name];
    if (value !== undefined) held[name] = value;
  }
  return Object.keys(held).length > 0 ? held : null;
};

/**
 * What actually gets sent, worked out once at enqueue time and then kept, so
 * that editing the wording in the admin app never changes a queued message and
 * the message log shows what the recipient really received.
 *
 * A WhatsApp body is the approved template's name, so it is passed through
 * untouched — substituting into it would send Meta a name that does not exist.
 * Its parameters are positional and land in `variables`, where a placeholder
 * would be meaningless, so a WhatsApp template may not declare secrets at all.
 */
export const renderTemplate = (
  wording: TemplateWording,
  variables: Readonly<Record<string, string>> = {},
): RenderedMessage => {
  if (wording.channel === "whatsapp") {
    if (wording.secrets.length > 0) {
      throw new Error("A WhatsApp template cannot carry a secret variable");
    }
    return {
      payload: {
        subject: null,
        body: wording.body,
        variables: orderedVariables(wording.variables, variables),
      },
      secrets: null,
    };
  }

  const shown = withPlaceholders(variables, wording.secrets);

  return {
    payload: {
      subject:
        wording.channel === "email" && wording.subject !== null
          ? renderText(wording.subject, shown)
          : null,
      body: renderText(wording.body, shown),
      variables: [],
    },
    secrets: secretValues(variables, wording.secrets),
  };
};
