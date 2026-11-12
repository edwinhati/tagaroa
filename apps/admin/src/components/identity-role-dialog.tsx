import { type IdentityRole, isPrivilegedRole } from "@repo/contracts/identity";
import { authClient } from "@repo/shell/auth-client";
import { Button } from "@repo/ui/components/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/dialog";
import {
  NativeSelect,
  NativeSelectOption,
} from "@repo/ui/components/native-select";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { announce, write } from "../lib/api";
import { type Person, refreshPeople } from "../lib/people";

export function IdentityRoleDialog({
  currentUserId,
  onOpenChange,
  open,
  people,
  roles,
}: {
  currentUserId: string;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  people: Person[];
  roles: readonly IdentityRole[];
}) {
  const queryClient = useQueryClient();
  const [userId, setUserId] = useState("");
  const [role, setRole] = useState("");
  const assign = useMutation({
    mutationFn: () =>
      write(
        () => authClient.admin.updateUser({ data: { role }, userId }),
        "The identity role was not changed.",
      ),
    onError: announce.failed,
    onSuccess: () => {
      announce.done("Identity role changed");
      void refreshPeople(queryClient);
      onOpenChange(false);
    },
  });

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (!event.currentTarget.reportValidity()) return;
            assign.mutate();
          }}
        >
          <DialogHeader>
            <DialogTitle>Assign identity role</DialogTitle>
            <DialogDescription>
              Identity roles grant authority across the back office. Review the
              person before changing privileged access.
            </DialogDescription>
          </DialogHeader>
          <div className="gap-4 grid">
            <label className="gap-2 text-sm font-medium grid">
              Person
              <NativeSelect
                className="w-full"
                onChange={(event) => setUserId(event.target.value)}
                required
                value={userId}
              >
                <NativeSelectOption value="">
                  Choose a person
                </NativeSelectOption>
                {people
                  .filter((person) => person.id !== currentUserId)
                  .map((person) => (
                    <NativeSelectOption key={person.id} value={person.id}>
                      {person.name || person.email} · {person.email}
                    </NativeSelectOption>
                  ))}
              </NativeSelect>
            </label>
            <label className="gap-2 text-sm font-medium grid">
              Identity role
              <NativeSelect
                className="w-full"
                onChange={(event) => setRole(event.target.value)}
                required
                value={role}
              >
                <NativeSelectOption value="">Choose a role</NativeSelectOption>
                {roles.map((item) => (
                  <NativeSelectOption key={item.id} value={item.id}>
                    {item.label}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </label>
            {isPrivilegedRole(role) ? (
              <p className="text-xs text-muted-foreground">
                This role requires two-factor authentication. The person will be
                prompted to secure their account before returning to the
                workspace.
              </p>
            ) : null}
          </div>
          <DialogFooter>
            <Button disabled={assign.isPending} size="sm" type="submit">
              {assign.isPending ? "Assigning…" : "Assign identity role"}
            </Button>
            <DialogClose render={<Button size="sm" variant="outline" />}>
              Close
            </DialogClose>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
