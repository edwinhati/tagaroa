import {
  type CreateSubsidiaryBody,
  type CreateTeamBody,
} from "@repo/contracts/requests/auth-management";
import { Button } from "@repo/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@repo/ui/components/dialog";
import { Input } from "@repo/ui/components/input";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { announce, coreMutationDocument } from "../lib/api";
import { refreshPeople } from "../lib/people";

export function CreateSubsidiary() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const create = useMutation({
    mutationFn: () =>
      coreMutationDocument(
        "/api/auth-management/subsidiaries",
        "POST",
        { name, slug } satisfies CreateSubsidiaryBody,
        "Could not create the subsidiary.",
      ),
    onError: announce.failed,
    onSuccess: () => {
      announce.done(`${name} created`);
      setOpen(false);
      setName("");
      setSlug("");
      void refreshPeople(queryClient);
    },
  });

  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <DialogTrigger
        render={
          <Button size="sm" variant="outline">
            New subsidiary
          </Button>
        }
      />
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>New subsidiary</DialogTitle>
          <DialogDescription>
            Create a subsidiary, then add the teams that control domain access.
          </DialogDescription>
        </DialogHeader>
        <form
          className="gap-4 grid"
          onSubmit={(event) => {
            event.preventDefault();
            create.mutate();
          }}
        >
          <label className="gap-1.5 text-xs grid">
            Name
            <Input
              autoFocus
              required
              value={name}
              onChange={(event) => {
                const next = event.target.value;
                setName(next);
                setSlug(
                  next
                    .trim()
                    .toLowerCase()
                    .replace(/[^a-z0-9]+/g, "-")
                    .replace(/^-|-$/g, ""),
                );
              }}
            />
          </label>
          <label className="gap-1.5 text-xs grid">
            Slug
            <Input
              required
              value={slug}
              onChange={(event) => setSlug(event.target.value)}
            />
          </label>
          <DialogFooter>
            <Button disabled={create.isPending} size="sm" type="submit">
              {create.isPending ? "Creating…" : "Create subsidiary"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function CreateTeam({ organizationId }: { organizationId: string }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const create = useMutation({
    mutationFn: () =>
      coreMutationDocument(
        `/api/auth-management/subsidiaries/${organizationId}/teams`,
        "POST",
        { name } satisfies CreateTeamBody,
        "Could not create the team.",
      ),
    onError: announce.failed,
    onSuccess: () => {
      announce.done(`${name} created`);
      setOpen(false);
      setName("");
      void refreshPeople(queryClient);
    },
  });

  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <DialogTrigger render={<Button size="sm">New team</Button>} />
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>New team</DialogTitle>
          <DialogDescription>
            After creating the team, link it to a domain to grant workspace
            admission.
          </DialogDescription>
        </DialogHeader>
        <form
          className="gap-4 grid"
          onSubmit={(event) => {
            event.preventDefault();
            create.mutate();
          }}
        >
          <label className="gap-1.5 text-xs grid">
            Team name
            <Input
              autoFocus
              required
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </label>
          <DialogFooter>
            <Button disabled={create.isPending} size="sm" type="submit">
              {create.isPending ? "Creating…" : "Create team"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
