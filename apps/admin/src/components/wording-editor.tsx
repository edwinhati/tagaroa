import { NOTIFICATION_CHANNELS } from "@repo/contracts/notifications";
import { renderEmail } from "@repo/email";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@repo/ui/components/alert-dialog";
import { Button } from "@repo/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/dialog";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@repo/ui/components/field";
import { Input } from "@repo/ui/components/input";
import { Skeleton } from "@repo/ui/components/skeleton";
import { Textarea } from "@repo/ui/components/textarea";
import { useMutation } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { announce } from "../lib/admin";
import {
  type Channel,
  type Template,
  type TemplateDraft,
  createTemplate,
  editTemplate,
  placeholdersIn,
} from "../lib/notifications";
import { CodeEditor } from "./code-editor";
import { ChannelName, MONO } from "./notification-status";

const CHANNELS = NOTIFICATION_CHANNELS;

/** GSM-7 segments. The second one costs the same as the first did. */
const SMS_SEGMENT = 160;

/**
 * Writing a message, with the thing it will become beside it.
 *
 * Editing a published version opens a new draft instead of changing it: the
 * published row is what queued messages were rendered from, and rewriting it
 * would quietly change the record of what people were sent.
 */
export function WordingEditor({
  editing,
  onClose,
  onSaved,
}: {
  editing: Template | "new" | null;
  onClose: () => void;
  onSaved: () => Promise<unknown>;
}) {
  const template = editing === "new" ? null : editing;
  const [dirty, setDirty] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  const requestClose = () => {
    if (dirty) setConfirmDiscard(true);
    else onClose();
  };

  return (
    <>
      <Dialog
        onOpenChange={(open) => {
          if (!open) requestClose();
        }}
        open={editing !== null}
      >
        <DialogContent className="gap-0 p-0 sm:max-w-[min(96vw,84rem)] max-h-[calc(100dvh-2rem)] overflow-hidden">
          {editing ? (
            <Form
              key={template?.id ?? "new"}
              onClose={requestClose}
              onDirty={() => setDirty(true)}
              onSaved={async () => {
                await onSaved();
                setDirty(false);
                onClose();
              }}
              template={template}
            />
          ) : null}
        </DialogContent>
      </Dialog>

      <AlertDialog onOpenChange={setConfirmDiscard} open={confirmDiscard}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard unsaved changes?</AlertDialogTitle>
            <AlertDialogDescription>
              Your edits have not been saved as a draft. Closing the editor will
              remove them.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel size="sm">Keep editing</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setDirty(false);
                setConfirmDiscard(false);
                onClose();
              }}
              size="sm"
              variant="destructive"
            >
              Discard changes
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function Form({
  onClose,
  onDirty,
  onSaved,
  template,
}: {
  onClose: () => void;
  onDirty: () => void;
  onSaved: () => Promise<unknown>;
  template: Template | null;
}) {
  const editable = template?.status === "draft";
  const [channel, setChannel] = useState<Channel>(template?.channel ?? "email");
  const [subject, setSubject] = useState(template?.subject ?? "");
  const [body, setBody] = useState(template?.body ?? "");
  const [variables, setVariables] = useState(
    (template?.variables ?? []).join(", "),
  );

  const declared = variables
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean);

  const save = useMutation({
    mutationFn: async (form: FormData) => {
      const draft: TemplateDraft = {
        body,
        channel,
        key: String(form.get("key") ?? "").trim(),
        locale: String(form.get("locale") ?? "").trim(),
        // Carried through untouched. The editor does not offer it, but an
        // edit must not be the thing that starts writing a password down.
        secrets: (template?.secrets ?? []).filter((name) =>
          declared.includes(name),
        ),
        subject: channel === "email" ? subject : null,
        variables: declared,
      };
      await (editable && template
        ? editTemplate(template.id, draft, template.updatedAt)
        : createTemplate(draft));
    },
    onError: announce.failed,
    onSuccess: async () => {
      announce.done(editable ? "Draft saved" : "Draft created");
      await onSaved();
    },
  });

  return (
    <form
      className="min-h-0 flex max-h-[calc(100dvh-2rem)] flex-col"
      onChange={onDirty}
      onSubmit={(event) => {
        event.preventDefault();
        save.mutate(new FormData(event.currentTarget));
      }}
    >
      <DialogHeader className="gap-1 px-5 py-4 border-b">
        <DialogTitle className="text-sm font-medium">
          {editable
            ? "Edit draft"
            : template
              ? `New version of ${template.key}`
              : "Create template"}
        </DialogTitle>
        <DialogDescription>
          A draft sends nothing. Publishing it retires whichever version is
          published now.
        </DialogDescription>
      </DialogHeader>

      <div className="min-h-0 gap-0 xl:grid-cols-[minmax(0,1fr)_44rem] xl:overflow-hidden grid overflow-y-auto overscroll-contain">
        <FieldGroup className="gap-4 px-5 py-5 xl:min-h-0 xl:overflow-y-auto xl:overscroll-contain">
          <div className="gap-4 sm:grid-cols-2 grid">
            <Field>
              <FieldLabel htmlFor="key">Template key</FieldLabel>
              <Input
                className={MONO}
                defaultValue={template?.key ?? ""}
                id="key"
                name="key"
                placeholder="account.issued"
                required
              />
              <FieldDescription>
                What happened, in dotted form.
              </FieldDescription>
            </Field>

            <Field>
              <FieldLabel htmlFor="locale">Language</FieldLabel>
              <Input
                className={MONO}
                defaultValue={template?.locale ?? "en"}
                id="locale"
                name="locale"
                required
              />
              <FieldDescription>
                {channel === "whatsapp"
                  ? "The code Meta approved the template under, often regional."
                  : "Falls back to the default language when a send asks for one you have not written."}
              </FieldDescription>
            </Field>
          </div>

          <Field>
            <FieldLabel>Channel</FieldLabel>
            <div className="gap-1.5 flex">
              {CHANNELS.map((option) => (
                <Button
                  aria-pressed={channel === option}
                  data-tone={channel === option ? undefined : "muted"}
                  key={option}
                  onClick={() => {
                    setChannel(option);
                    onDirty();
                  }}
                  size="sm"
                  type="button"
                  variant={channel === option ? "secondary" : "ghost"}
                >
                  <ChannelName active={channel === option} channel={option} />
                </Button>
              ))}
            </div>
          </Field>

          {channel === "email" ? (
            <Field>
              <FieldLabel htmlFor="subject">Subject</FieldLabel>
              <Input
                id="subject"
                onChange={(event) => setSubject(event.target.value)}
                required
                value={subject}
              />
            </Field>
          ) : null}

          <Field>
            <div className="gap-3 flex items-baseline justify-between">
              <FieldLabel htmlFor="body">
                {channel === "whatsapp" ? "Approved template name" : "Message"}
              </FieldLabel>
              {channel === "sms" ? (
                <span className={`${MONO} text-muted-foreground`}>
                  {body.length}/{SMS_SEGMENT} ·{" "}
                  {Math.max(1, Math.ceil(body.length / SMS_SEGMENT))} segment
                  {body.length > SMS_SEGMENT ? "s" : ""}
                </span>
              ) : null}
            </div>
            {channel === "whatsapp" ? (
              <Textarea
                className={MONO}
                id="body"
                onChange={(event) => setBody(event.target.value)}
                required
                rows={1}
                value={body}
              />
            ) : (
              // Monaco has no form value of its own, so `required` cannot
              // reach it; the submit button below is disabled on an empty
              // body instead.
              <CodeEditor
                ariaLabel="Message"
                id="body"
                onChange={(value) => {
                  setBody(value);
                  onDirty();
                }}
                rows={9}
                value={body}
              />
            )}
            <FieldDescription>
              {channel === "whatsapp"
                ? "WhatsApp refuses free text on a message you start. This is the name Meta approved; the values below fill its placeholders in order."
                : "Write a placeholder as {{name}}. A send that does not supply one is refused rather than sent with a gap in it."}
            </FieldDescription>
          </Field>

          <Field>
            <FieldLabel htmlFor="variables">Variables</FieldLabel>
            <Input
              className={MONO}
              id="variables"
              onChange={(event) => setVariables(event.target.value)}
              placeholder="name, email, password"
              value={variables}
            />
            <FieldDescription>
              Comma-separated, in the order WhatsApp fills them.
            </FieldDescription>
          </Field>
        </FieldGroup>

        <Preview
          body={body}
          channel={channel}
          declared={declared}
          subject={subject}
        />
      </div>

      <DialogFooter className="px-5 py-3 border-t">
        <Button onClick={onClose} size="sm" type="button" variant="ghost">
          Cancel
        </Button>
        <Button
          disabled={save.isPending || body.trim().length === 0}
          size="sm"
          type="submit"
        >
          {save.isPending ? "Saving" : "Save draft"}
        </Button>
      </DialogFooter>
    </form>
  );
}

/**
 * The wording with its placeholders standing in for values, and — more usefully
 * — the mismatch between what the text asks for and what the row declares.
 * WhatsApp fills by position, so an undeclared placeholder is not a small
 * mistake there: it silently shifts every value after it.
 */
function Preview({
  body,
  channel,
  declared,
  subject,
}: {
  body: string;
  channel: Channel;
  declared: string[];
  subject: string;
}) {
  const used = channel === "whatsapp" ? declared : placeholdersIn(body);
  const undeclaredList = used.filter((name) => !declared.includes(name));
  const unused = declared.filter((name) => !used.includes(name));

  const sample = (text: string) =>
    text.replaceAll(/\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g, (_match, name) =>
      name === "email"
        ? "ada@example.com"
        : name === "password"
          ? "temporary-password"
          : name === "name"
            ? "Ada Lovelace"
            : `[${String(name)}]`,
    );

  return (
    <aside className="gap-3 px-5 py-5 xl:border-l xl:border-t-0 xl:min-h-0 flex flex-col border-t bg-background">
      <h3 className="font-medium shrink-0 text-[11px] tracking-[0.06em] text-muted-foreground uppercase">
        Preview
      </h3>

      {channel === "whatsapp" ? (
        <p className="leading-relaxed shrink-0 text-[13px] text-muted-foreground">
          Meta renders the approved template{" "}
          <span className={MONO}>{body || "…"}</span> with{" "}
          {declared.length || "no"} value{declared.length === 1 ? "" : "s"}.
        </p>
      ) : channel === "email" ? (
        <EmailPreview body={sample(body)} subject={sample(subject)} />
      ) : (
        <div className="shrink-0 rounded-[var(--panel-radius)] border border-border bg-card shadow-none">
          <pre className="px-3 py-2.5 leading-relaxed text-[13px] whitespace-pre-wrap">
            {sample(body) || "Nothing written yet."}
          </pre>
        </div>
      )}

      {channel === "email" ? (
        <p className="leading-relaxed shrink-0 text-[12.5px] text-muted-foreground">
          Rendered by the same shell that sends it. The plain-text part carries
          the wording exactly as written above.
        </p>
      ) : null}

      {undeclaredList.length > 0 ? (
        <p className="leading-relaxed shrink-0 text-[12.5px] text-destructive">
          Not declared as values: {undeclaredList.join(", ")}. A send that does
          not supply them is refused.
        </p>
      ) : null}
      {unused.length > 0 ? (
        <p className="leading-relaxed shrink-0 text-[12.5px] text-muted-foreground">
          Declared but never used: {unused.join(", ")}.
        </p>
      ) : null}
    </aside>
  );
}

/**
 * The email as it will arrive, rendered by the shell that will send it.
 *
 * `@repo/email` is isomorphic, so this is the send path's own `renderEmail`
 * rather than a second implementation that can drift from it. The result goes
 * into an iframe with no `allow-scripts`: the wording is escaped on the way in,
 * and the sandbox is the second lock rather than the only one.
 */
function EmailPreview({ body, subject }: { body: string; subject: string }) {
  const [html, setHtml] = useState<string | null>(null);

  useEffect(() => {
    let current = true;

    const timer = setTimeout(() => {
      void renderEmail({ body: body || "Nothing written yet.", subject })
        .then((rendered) => {
          if (current) setHtml(rendered);
        })
        .catch(() => {
          if (current) setHtml(null);
        });
    }, 150);

    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [body, subject]);

  return (
    // The column is sized so the shell fits at 1:1 — `tagaroaTheme` is 600px
    // wide and pads either side of that. Scaling the frame down to fit a narrow
    // column rendered body copy at around seven pixels, which shows that an
    // email exists without showing the one about to be sent.
    <div className="xl:min-h-0 flex flex-1 flex-col overflow-hidden rounded-md border bg-background">
      <p className="px-3 py-2 font-medium truncate border-b text-[13px]">
        {subject || "No subject yet"}
      </p>
      {html === null ? (
        <Skeleton className="min-h-[26rem] flex-1 rounded-none" />
      ) : (
        <iframe
          className="bg-white min-h-[26rem] w-full flex-1 border-0"
          sandbox=""
          srcDoc={html}
          title="Email preview"
        />
      )}
    </div>
  );
}
