import { IDENTITY_ROLE_IDS } from "@repo/contracts/identity";
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
  DialogTrigger,
} from "@repo/ui/components/dialog";
import { FieldError, FieldGroup } from "@repo/ui/components/field";
import { Spinner } from "@repo/ui/components/spinner";
import { useForm } from "@tanstack/react-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import * as z from "zod";

import { onboardingOutcome, refreshPeople, write } from "../lib/admin";
import type { OnboardingOutcome } from "../lib/admin";
import {
  AccountRoleField,
  AccountTextField,
  accountRoles,
} from "./account-fields";
import {
  createTemporaryPassword,
  TemporaryPassword,
} from "./temporary-password";

/**
 * The onboarding step, in one dialog. An account is issued with a temporary
 * password that the holder must replace on first sign-in, so the password is
 * generated here rather than chosen: an admin picking one is an admin who knows
 * a colleague's password.
 *
 * `servers/core` queues the onboarding message itself, from the wording
 * published under `account.issued`. The password is still shown here once,
 * because the core service stores only a hash and a message can fail to arrive:
 * an admin who closed this dialog on a bounced message would have to reissue.
 */
export function IssueAccount({
  canAssignPrivileged,
}: {
  canAssignPrivileged: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <DialogTrigger render={<Button size="sm">Issue an account</Button>} />
      <DialogContent className="sm:max-w-md">
        <IssueForm
          canAssignPrivileged={canAssignPrivileged}
          onDone={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

const issueAccountSchema = z
  .object({
    email: z.string().trim().pipe(z.email("Enter a valid email address.")),
    name: z.string(),
    personalEmail: z
      .string()
      .trim()
      .pipe(z.email("Enter a valid personal email.")),
    role: z.enum(IDENTITY_ROLE_IDS),
  })
  // The password must not go to the mailbox it unlocks; the server refuses it too.
  .refine(
    (values) =>
      values.personalEmail.toLowerCase() !== values.email.toLowerCase(),
    {
      message:
        "Use an address outside the workspace, not the one they sign in with.",
      path: ["personalEmail"],
    },
  );

type IssueAccountValues = z.infer<typeof issueAccountSchema>;

const issueAccountDefaults: IssueAccountValues = {
  email: "",
  name: "",
  personalEmail: "",
  role: "user",
};

type IssuedAccount = {
  onboarding: OnboardingOutcome | null;
  password: string;
  personalEmail: string;
};

function IssueForm({
  canAssignPrivileged,
  onDone,
}: {
  canAssignPrivileged: boolean;
  onDone: () => void;
}) {
  const queryClient = useQueryClient();
  const [issued, setIssued] = useState<IssuedAccount | null>(null);
  const roles = accountRoles.filter(
    (role) => canAssignPrivileged || role.value === "user",
  );

  const issue = useMutation({
    mutationFn: async (values: IssueAccountValues): Promise<IssuedAccount> => {
      const email = values.email.trim();
      const name = values.name.trim();
      const personalEmail = values.personalEmail.trim();
      const password = createTemporaryPassword();

      const created = await write(
        () =>
          authClient.admin.createUser({
            data: { personalEmail },
            email,
            name: name || email,
            password,
            role: values.role === "user" ? undefined : values.role,
          }),
        "The account was not created.",
      );

      return {
        onboarding: onboardingOutcome(created),
        password,
        personalEmail,
      };
    },
    onSuccess: (result) => {
      setIssued(result);
      void refreshPeople(queryClient);
    },
  });

  const form = useForm({
    defaultValues: issueAccountDefaults,
    validators: { onSubmit: issueAccountSchema },
    onSubmit: async ({ value }) => {
      try {
        await issue.mutateAsync(value);
      } catch {
        // React Query exposes the server error below the fields.
      }
    },
  });

  if (issued) return <AccountIssued issued={issued} onDone={onDone} />;

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit();
      }}
    >
      <DialogHeader>
        <DialogTitle>Issue an account</DialogTitle>
        <DialogDescription>
          A temporary password will be sent to the new hire’s personal email. It
          is also shown here once in case the message cannot be delivered.
        </DialogDescription>
      </DialogHeader>

      <FieldGroup className="my-4">
        <form.Field name="email">
          {(field) => (
            <AccountTextField
              field={field}
              label="Work email"
              placeholder="name@tagaroa.com"
              required
              type="email"
            />
          )}
        </form.Field>
        <form.Field name="personalEmail">
          {(field) => (
            <AccountTextField
              description="Receives the onboarding message and password recovery messages."
              field={field}
              label="Personal email"
              placeholder="name@example.com"
              required
              type="email"
            />
          )}
        </form.Field>
        <form.Field name="name">
          {(field) => (
            <AccountTextField
              description="Optional. The work email is used when the name is blank."
              field={field}
              label="Name"
            />
          )}
        </form.Field>
        <form.Field name="role">
          {(field) => (
            <AccountRoleField
              description="This role applies across Tagaroa. Team membership controls domain access."
              field={field}
              roles={roles}
            />
          )}
        </form.Field>
        {issue.error ? <FieldError>{issue.error.message}</FieldError> : null}
      </FieldGroup>

      <DialogFooter>
        <DialogClose render={<Button size="sm" variant="ghost" />}>
          Cancel
        </DialogClose>
        <form.Subscribe selector={(state) => state.isSubmitting}>
          {(isSubmitting) => (
            <Button disabled={isSubmitting} size="sm" type="submit">
              {isSubmitting ? <Spinner data-icon="inline-start" /> : null}
              {isSubmitting ? "Issuing…" : "Issue account"}
            </Button>
          )}
        </form.Subscribe>
      </DialogFooter>
    </form>
  );
}

function AccountIssued({
  issued,
  onDone,
}: {
  issued: IssuedAccount;
  onDone: () => void;
}) {
  return (
    <>
      <DialogHeader>
        <DialogTitle>Account issued</DialogTitle>
        <DialogDescription>
          {issued.onboarding && !issued.onboarding.queued
            ? `No onboarding message was sent${issued.onboarding.reason ? `: ${issued.onboarding.reason.toLowerCase()}` : ""}. Share the temporary password through your usual trusted channel.`
            : `An onboarding message with this temporary password was queued to ${issued.personalEmail}.`}{" "}
          This is the only time the password will be shown. The new hire must
          replace it at first sign-in.
        </DialogDescription>
      </DialogHeader>
      <TemporaryPassword password={issued.password} />
      <DialogFooter>
        <Button onClick={onDone} size="sm">
          Done
        </Button>
      </DialogFooter>
    </>
  );
}
