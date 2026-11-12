import { IDENTITY_ROLE_IDS, primaryRole } from "@repo/contracts/identity";
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
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@repo/ui/components/field";
import { Spinner } from "@repo/ui/components/spinner";
import { Textarea } from "@repo/ui/components/textarea";
import { useForm } from "@tanstack/react-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as z from "zod";

import type { Person } from "../lib/admin";
import {
  announce,
  onboardingOutcome,
  personalEmailQueryOptions,
  refreshPeople,
  write,
} from "../lib/admin";
import {
  AccountRoleField,
  AccountTextField,
  accountRoles,
} from "./account-fields";
import {
  createTemporaryPassword,
  TemporaryPassword,
} from "./temporary-password";

const accountSchema = z.object({
  email: z.string().trim().pipe(z.email("Enter a valid email address.")),
  name: z.string().trim().min(1, "Enter the person's name."),
  // Blank is allowed here and nowhere else: an account issued before personal
  // addresses were recorded has none, and editing their name should not force
  // an admin to invent one.
  personalEmail: z
    .string()
    .trim()
    .refine(
      (value) => value === "" || z.email().safeParse(value).success,
      "Enter a valid personal email.",
    ),
  role: z.enum(IDENTITY_ROLE_IDS),
});

type AccountValues = z.infer<typeof accountSchema>;

export function EditPersonDialog({
  canAssignSuperAdmin,
  canChangeRole,
  onOpenChange,
  open,
  person,
}: {
  canAssignSuperAdmin: boolean;
  canChangeRole: boolean;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  person: Person;
}) {
  // Read before the form exists: the address is `returned: false` on the
  // account, so it arrives from `directory` rather than with the person.
  const personalEmail = useQuery({
    ...personalEmailQueryOptions(person.id),
    enabled: open,
  });

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="sm:max-w-md">
        {personalEmail.isPending ? (
          <div className="py-5 flex justify-center">
            <Spinner />
          </div>
        ) : (
          <EditPersonForm
            canAssignSuperAdmin={canAssignSuperAdmin}
            canChangeRole={canChangeRole}
            key={`${person.id}:${person.email}:${person.name}:${person.role}:${personalEmail.data ?? ""}`}
            onDone={() => onOpenChange(false)}
            person={person}
            personalEmail={personalEmail.data ?? ""}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function EditPersonForm({
  canAssignSuperAdmin,
  canChangeRole,
  onDone,
  person,
  personalEmail,
}: {
  canAssignSuperAdmin: boolean;
  canChangeRole: boolean;
  onDone: () => void;
  person: Person;
  personalEmail: string;
}) {
  const queryClient = useQueryClient();
  const currentRole = primaryRole(person.role);
  const availableRoles = canAssignSuperAdmin
    ? accountRoles
    : accountRoles.filter((role) => role.value !== "super-admin");

  const update = useMutation({
    mutationFn: async (values: AccountValues) => {
      const email = values.email.trim().toLowerCase();
      const name = values.name.trim();
      const data: Record<string, string> = {};

      const personal = values.personalEmail.trim();

      if (email !== person.email.toLowerCase()) data.email = email;
      if (name !== person.name) data.name = name;
      // Only when it changed to something: the server refuses a blank, and
      // blank here means "leave the one on file alone".
      if (personal !== "" && personal !== personalEmail) {
        data.personalEmail = personal;
      }
      if (canChangeRole && values.role !== currentRole) data.role = values.role;
      if (Object.keys(data).length === 0) return false;

      await write(
        () => authClient.admin.updateUser({ data, userId: person.id }),
        "The account details were not updated.",
      );
      return true;
    },
    onError: announce.failed,
    onSuccess: (changed) => {
      if (changed) {
        announce.done(`Updated account details for ${person.email}`);
        void refreshPeople(queryClient);
      }
      onDone();
    },
  });

  const form = useForm({
    defaultValues: {
      email: person.email,
      name: person.name,
      personalEmail,
      role: currentRole,
    } satisfies AccountValues,
    validators: { onSubmit: accountSchema },
    onSubmit: async ({ value }) => {
      try {
        await update.mutateAsync(value);
      } catch {
        // React Query exposes the server error below the fields.
      }
    },
  });

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit();
      }}
    >
      <DialogHeader>
        <DialogTitle>Edit account</DialogTitle>
        <DialogDescription>
          Change the identity Better Auth uses for {person.email}.
        </DialogDescription>
      </DialogHeader>

      <FieldGroup className="my-4">
        <form.Field name="name">
          {(field) => <AccountTextField field={field} label="Name" required />}
        </form.Field>

        <form.Field name="email">
          {(field) => (
            <AccountTextField
              description="The email address they use to sign in."
              field={field}
              label="Work email"
              required
              type="email"
            />
          )}
        </form.Field>

        <form.Field name="personalEmail">
          {(field) => (
            <AccountTextField
              description="Receives onboarding and password recovery messages. Without one, these messages cannot be delivered."
              field={field}
              label="Personal email"
              placeholder="name@example.com"
              type="email"
            />
          )}
        </form.Field>

        <form.Field name="role">
          {(field) => (
            <AccountRoleField
              description={
                canChangeRole
                  ? "Identity administrators manage group identity. Super administrators can impersonate other administrators."
                  : canAssignSuperAdmin
                    ? "You cannot change your own role."
                    : "Only a super administrator can change identity roles."
              }
              disabled={!canChangeRole}
              field={field}
              roles={availableRoles}
            />
          )}
        </form.Field>

        {update.error ? <FieldError>{update.error.message}</FieldError> : null}
      </FieldGroup>

      <DialogFooter>
        <DialogClose render={<Button size="sm" variant="ghost" />}>
          Cancel
        </DialogClose>
        <form.Subscribe selector={(state) => state.isSubmitting}>
          {(isSubmitting) => (
            <Button disabled={isSubmitting} size="sm" type="submit">
              {isSubmitting ? <Spinner data-icon="inline-start" /> : null}
              {isSubmitting ? "Saving…" : "Save changes"}
            </Button>
          )}
        </form.Subscribe>
      </DialogFooter>
    </form>
  );
}

export function ResetPasswordDialog({
  onOpenChange,
  open,
  person,
}: {
  onOpenChange: (open: boolean) => void;
  open: boolean;
  person: Person;
}) {
  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="sm:max-w-md">
        <ResetPasswordContent
          key={`${person.id}:${open}`}
          onDone={() => onOpenChange(false)}
          open={open}
          person={person}
        />
      </DialogContent>
    </Dialog>
  );
}

function ResetPasswordContent({
  onDone,
  open,
  person,
}: {
  onDone: () => void;
  open: boolean;
  person: Person;
}) {
  const queryClient = useQueryClient();
  // Shown before the act, not after: an admin about to strand somebody should
  // see where the message is going while they can still stop.
  const destination = useQuery({
    ...personalEmailQueryOptions(person.id),
    enabled: open,
  });
  const reset = useMutation({
    mutationFn: async () => {
      const password = createTemporaryPassword();
      const reissue = await write(
        () =>
          authClient.admin.setUserPassword({
            newPassword: password,
            userId: person.id,
          }),
        "A new password was not issued.",
      );

      // A reissue means they were locked out or someone else got in. The
      // `mustChangePassword` flag already stops a stale session reaching the
      // workspace, but that leaves one interceptor as the only thing between a
      // stolen session and the product — so end them outright as well.
      //
      // Never fatal: the password has already been changed by this point, and
      // failing here would take the only copy of it off the screen. The panel
      // says what did not happen instead, so the admin can revoke by hand.
      let sessionsRevoked = true;
      try {
        await write(
          () => authClient.admin.revokeUserSessions({ userId: person.id }),
          "Their sessions were not revoked.",
        );
      } catch {
        sessionsRevoked = false;
      }

      return {
        onboarding: onboardingOutcome(reissue),
        password,
        sessionsRevoked,
      };
    },
    onError: announce.failed,
    onSuccess: () => {
      announce.done(`Issued a new password to ${person.email}`);
      void refreshPeople(queryClient);
    },
  });

  if (reset.data) {
    return (
      <>
        <DialogHeader>
          <DialogTitle>New password issued</DialogTitle>
          <DialogDescription>
            {reset.data.onboarding?.queued
              ? `A recovery message has been queued to ${reset.data.onboarding.destination}.`
              : `No recovery message was sent${reset.data.onboarding?.reason ? `: ${reset.data.onboarding.reason.toLowerCase()}` : ""}. Share the temporary password through your usual trusted channel.`}{" "}
            It is shown once.{" "}
            {reset.data.sessionsRevoked
              ? "Every session they held has been revoked."
              : "Their sessions could not be revoked — end them from Person details."}
          </DialogDescription>
        </DialogHeader>
        <TemporaryPassword password={reset.data.password} />
        <DialogFooter>
          <Button onClick={onDone} size="sm">
            Done
          </Button>
        </DialogFooter>
      </>
    );
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Issue a new password?</DialogTitle>
        <DialogDescription>
          The credential for {person.email} is replaced and every session they
          hold is ended. They must choose a private password before returning to
          the workspace.
          {destination.data
            ? ` The new password is sent to ${destination.data}.`
            : " No personal email is on file. Share the temporary password through your usual trusted channel."}
        </DialogDescription>
      </DialogHeader>
      {reset.error ? <FieldError>{reset.error.message}</FieldError> : null}
      <DialogFooter>
        <DialogClose render={<Button size="sm" variant="ghost" />}>
          Cancel
        </DialogClose>
        <Button
          disabled={reset.isPending}
          onClick={() => reset.mutate()}
          size="sm"
        >
          {reset.isPending ? <Spinner data-icon="inline-start" /> : null}
          {reset.isPending ? "Issuing…" : "Issue new password"}
        </Button>
      </DialogFooter>
    </>
  );
}

/**
 * Suspending is not moderation, so it is not timed.
 *
 * Better Auth offers `banExpiresIn`, and a timed ban is the right shape for a
 * forum cooling someone off. Access here ends because somebody left, is under
 * investigation, or lost a device — none of which resolve on a schedule. Leaving
 * the field out means an account stays closed until an operator decides
 * otherwise, and `banExpires` is never set, so "suspended" never quietly stops
 * being true while the table still says it is.
 */
const suspendSchema = z.object({
  reason: z.string().trim().max(240, "Keep the reason under 240 characters."),
});

type SuspendValues = z.infer<typeof suspendSchema>;

const suspendDefaults: SuspendValues = { reason: "" };

export function SuspendPersonDialog({
  onOpenChange,
  open,
  person,
}: {
  onOpenChange: (open: boolean) => void;
  open: boolean;
  person: Person;
}) {
  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="sm:max-w-md">
        <SuspendPersonForm
          key={`${person.id}:${open}`}
          onDone={() => onOpenChange(false)}
          person={person}
        />
      </DialogContent>
    </Dialog>
  );
}

function SuspendPersonForm({
  onDone,
  person,
}: {
  onDone: () => void;
  person: Person;
}) {
  const queryClient = useQueryClient();
  const suspend = useMutation({
    mutationFn: (values: SuspendValues) =>
      write(
        () =>
          authClient.admin.banUser({
            banReason: values.reason.trim() || undefined,
            userId: person.id,
          }),
        "Their access was not suspended.",
      ),
    onError: announce.failed,
    onSuccess: () => {
      announce.done(`${person.email} can no longer sign in`);
      void refreshPeople(queryClient);
      onDone();
    },
  });

  const form = useForm({
    defaultValues: suspendDefaults,
    validators: { onSubmit: suspendSchema },
    onSubmit: async ({ value }) => {
      try {
        await suspend.mutateAsync(value);
      } catch {
        // React Query exposes the server error below the fields.
      }
    },
  });

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit();
      }}
    >
      <DialogHeader>
        <DialogTitle>Suspend this person's access?</DialogTitle>
        <DialogDescription>
          {person.email} will be signed out and unable to return until an admin
          restores their access. Nothing is deleted.
        </DialogDescription>
      </DialogHeader>

      <FieldGroup className="my-4">
        <form.Field name="reason">
          {(field) => {
            const isInvalid =
              field.state.meta.isTouched && !field.state.meta.isValid;
            return (
              <Field data-invalid={isInvalid}>
                <FieldLabel htmlFor={field.name}>Reason</FieldLabel>
                <Textarea
                  aria-invalid={isInvalid}
                  id={field.name}
                  name={field.name}
                  onBlur={field.handleBlur}
                  onChange={(event) => field.handleChange(event.target.value)}
                  placeholder="Left the company, 14 March"
                  rows={3}
                  value={field.state.value}
                />
                <FieldDescription>
                  Recorded on the account and in the trail. The person never
                  sees it.
                </FieldDescription>
                {isInvalid ? (
                  <FieldError errors={field.state.meta.errors} />
                ) : null}
              </Field>
            );
          }}
        </form.Field>

        {suspend.error ? (
          <FieldError>{suspend.error.message}</FieldError>
        ) : null}
      </FieldGroup>

      <DialogFooter>
        <DialogClose render={<Button size="sm" variant="ghost" />}>
          Cancel
        </DialogClose>
        <form.Subscribe selector={(state) => state.isSubmitting}>
          {(isSubmitting) => (
            <Button
              disabled={isSubmitting}
              size="sm"
              type="submit"
              variant="destructive"
            >
              {isSubmitting ? <Spinner data-icon="inline-start" /> : null}
              {isSubmitting ? "Suspending…" : "Suspend access"}
            </Button>
          )}
        </form.Subscribe>
      </DialogFooter>
    </form>
  );
}
