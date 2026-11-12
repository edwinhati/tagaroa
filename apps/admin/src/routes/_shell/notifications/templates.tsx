import { AppTrail, Page } from "@repo/shell/app-shell";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@repo/ui/components/dropdown-menu";
import { Skeleton } from "@repo/ui/components/skeleton";
import { relativeTime } from "@repo/ui/lib/relative-time";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { EllipsisIcon } from "lucide-react";
import { useState } from "react";

import { Failed, Nothing } from "../../../components/admin-surface";
import {
  ChannelName,
  channelLabel,
  exactTime,
  TemplateStatus,
} from "../../../components/notification-status";
import { TemplateDetail } from "../../../components/template-detail";
import { WordingEditor } from "../../../components/wording-editor";
import { announce } from "../../../lib/admin";
import {
  type Template,
  deleteTemplate,
  publishTemplate,
  templatesQueryOptions,
  NOTIFICATIONS_QUERY_KEY,
} from "../../../lib/notifications";

export const Route = createFileRoute("/_shell/notifications/templates")({
  component: TemplatesPage,
});

function TemplatesPage() {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<Template | "new" | null>(null);
  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_QUERY_KEY });

  return (
    <Page
      actions={
        <Button onClick={() => setEditing("new")} size="sm">
          Create template
        </Button>
      }
      breadcrumb={
        <AppTrail
          items={[
            { label: "Notifications", to: "/notifications" },
            { label: "Templates" },
          ]}
        />
      }
      description="Write, review, and publish messages people receive."
      title="Templates"
    >
      <TemplateList onChanged={refresh} onEdit={setEditing} />
      <WordingEditor
        editing={editing}
        onClose={() => setEditing(null)}
        onSaved={refresh}
      />
    </Page>
  );
}

function TemplateList({
  onChanged,
  onEdit,
}: {
  onChanged: () => Promise<unknown>;
  onEdit: (template: Template) => void;
}) {
  const templates = useQuery(templatesQueryOptions);
  const [reading, setReading] = useState<Template | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<{
    action: "publish" | "discard";
    template: Template;
  } | null>(null);

  const publish = useMutation({
    mutationFn: publishTemplate,
    onError: announce.failed,
    onSuccess: async () => {
      announce.done("Published");
      await onChanged();
    },
  });

  const discard = useMutation({
    mutationFn: deleteTemplate,
    onError: announce.failed,
    onSuccess: async () => {
      announce.done("Draft discarded");
      await onChanged();
    },
  });

  if (templates.isPending) return <Skeleton className="h-64 w-full" />;
  if (templates.isError)
    return (
      <Failed
        error={templates.error}
        onRetry={() => void templates.refetch()}
        what="templates"
      />
    );
  if (templates.data.length === 0) {
    return (
      <Nothing title="No templates yet">
        Create and publish a template before this workspace can send its first
        message.
      </Nothing>
    );
  }

  const selected =
    templates.data.find((template) => template.id === selectedId) ??
    templates.data[0];
  if (!selected) return null;

  return (
    <>
      <div className="template-split">
        <ul className="template-index">
          {templates.data.map((template) => (
            <li key={template.id}>
              <button
                aria-current={template.id === selected.id ? "true" : undefined}
                className="template-index-key"
                onClick={() => setSelectedId(template.id)}
                type="button"
              >
                <span className="template-index-name">{template.key}</span>
                <span className="template-index-meta">
                  {channelLabel(template.channel)} · {template.locale} · v
                  {template.version}
                </span>
              </button>
            </li>
          ))}
        </ul>
        <article className="template-read">
          <header className="template-read-meta">
            <ChannelName channel={selected.channel} />
            <TemplateStatus status={selected.status} />
            <span className="template-index-meta">
              {selected.locale} · v{selected.version}
            </span>
            <div className="template-read-side">
              <time
                className="template-when"
                dateTime={new Date(selected.updatedAt).toISOString()}
                title={exactTime(selected.updatedAt)}
              >
                {relativeTime(selected.updatedAt)}
              </time>
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button
                      aria-label={`Actions for ${selected.key} on ${selected.channel}`}
                      size="icon"
                      variant="ghost"
                    >
                      <EllipsisIcon aria-hidden="true" strokeWidth={1.5} />
                    </Button>
                  }
                />
                <DropdownMenuContent align="end">
                  <DropdownMenuGroup>
                    <DropdownMenuItem onClick={() => setReading(selected)}>
                      View template
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onEdit(selected)}>
                      {selected.status === "draft"
                        ? "Edit draft"
                        : "Draft a new version"}
                    </DropdownMenuItem>
                    {selected.status === "draft" ? (
                      <DropdownMenuItem
                        onClick={() =>
                          setConfirmation({
                            action: "publish",
                            template: selected,
                          })
                        }
                      >
                        Publish template
                      </DropdownMenuItem>
                    ) : null}
                  </DropdownMenuGroup>
                  {selected.status === "draft" ? (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuGroup>
                        <DropdownMenuItem
                          onClick={() =>
                            setConfirmation({
                              action: "discard",
                              template: selected,
                            })
                          }
                          variant="destructive"
                        >
                          Discard draft
                        </DropdownMenuItem>
                      </DropdownMenuGroup>
                    </>
                  ) : null}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </header>
          {selected.subject ? <h2>{selected.subject}</h2> : null}
          <p className="template-body">{selected.body}</p>
        </article>
      </div>
      <AlertDialog
        onOpenChange={(open) => {
          if (!open) setConfirmation(null);
        }}
        open={confirmation !== null}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmation?.action === "publish"
                ? "Publish this template?"
                : "Discard this draft?"}
            </AlertDialogTitle>
            <AlertDialogDescription className="break-words">
              {confirmation
                ? confirmation.action === "publish"
                  ? `${confirmation.template.key} · ${channelLabel(confirmation.template.channel)} · ${confirmation.template.locale} · v${confirmation.template.version} will become available for new messages. The currently published version will be retired.`
                  : `${confirmation.template.key} · ${channelLabel(confirmation.template.channel)} · ${confirmation.template.locale} · v${confirmation.template.version} will be permanently removed.`
                : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel size="sm">Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={publish.isPending || discard.isPending}
              onClick={() => {
                if (!confirmation) return;
                const mutation =
                  confirmation.action === "publish" ? publish : discard;
                mutation.mutate(confirmation.template.id, {
                  onSuccess: () => setConfirmation(null),
                });
              }}
              size="sm"
              variant={
                confirmation?.action === "discard" ? "destructive" : "default"
              }
            >
              {confirmation?.action === "publish"
                ? "Publish template"
                : "Discard draft"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <TemplateDetail onClose={() => setReading(null)} template={reading} />
    </>
  );
}
