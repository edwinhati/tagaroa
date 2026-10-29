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
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@repo/ui/components/field";
import { Input } from "@repo/ui/components/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select";
import { Spinner } from "@repo/ui/components/spinner";
import { useForm } from "@tanstack/react-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import * as z from "zod";

import { onboardingOutcome, write } from "../lib/admin";
import type { OnboardingOutcome } from "../lib/admin";
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
    role: z.enum([
      "user",
      "access-reviewer",
      "helpdesk",
      "admin",
      "super-admin",
    ]),
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

const accountRoles = [
  { label: "Employee", value: "user" },
  { label: "Access reviewer", value: "access-reviewer" },
  { label: "Helpdesk", value: "helpdesk" },
  { label: "Identity administrator", value: "admin" },
  { label: "Super administrator", value: "super-admin" },
] as const satisfies ReadonlyArray<{
  label: string;
  value: IssueAccountValues["role"];
}>;

function IssueForm({
  canAssignPrivileged,
  onDone,
}: {
  canAssignPrivileged: boolean;
  onDone: () => void;
}) {
  const queryClient = useQueryClient();
  const [issued, setIssued] = useState<{
    onboarding: OnboardingOutcome | null;
    password: string;
    personalEmail: string;
  } | null>(null);

  const issue = useMutation({
    mutationFn: async (values: IssueAccountValues) => {
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
      void queryClient.invalidateQueries({ queryKey: ["admin", "people"] });
      void queryClient.invalidateQueries({ queryKey: ["admin", "dashboard"] });
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

  if (issued) {
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
          {(field) => {
            const isInvalid =
              field.state.meta.isTouched && !field.state.meta.isValid;

            return (
              <Field data-invalid={isInvalid}>
                <FieldLabel htmlFor={field.name}>Work email</FieldLabel>
                <Input
                  aria-invalid={isInvalid}
                  autoComplete="off"
                  id={field.name}
                  name={field.name}
                  onBlur={field.handleBlur}
                  onChange={(event) => field.handleChange(event.target.value)}
                  placeholder="name@tagaroa.com"
                  required
                  type="email"
                  value={field.state.value}
                />
                {isInvalid ? (
                  <FieldError errors={field.state.meta.errors} />
                ) : null}
              </Field>
            );
          }}
        </form.Field>
        <form.Field name="personalEmail">
          {(field) => {
            const isInvalid =
              field.state.meta.isTouched && !field.state.meta.isValid;

            return (
              <Field data-invalid={isInvalid}>
                <FieldLabel htmlFor={field.name}>Personal email</FieldLabel>
                <Input
                  aria-invalid={isInvalid}
                  autoComplete="off"
                  id={field.name}
                  name={field.name}
                  onBlur={field.handleBlur}
                  onChange={(event) => field.handleChange(event.target.value)}
                  placeholder="name@example.com"
                  required
                  type="email"
                  value={field.state.value}
                />
                <FieldDescription>
                  Receives the onboarding message and password recovery
                  messages.
                </FieldDescription>
                {isInvalid ? (
                  <FieldError errors={field.state.meta.errors} />
                ) : null}
              </Field>
            );
          }}
        </form.Field>
        <form.Field name="name">
          {(field) => {
            const isInvalid =
              field.state.meta.isTouched && !field.state.meta.isValid;

            return (
              <Field data-invalid={isInvalid}>
                <FieldLabel htmlFor={field.name}>Name</FieldLabel>
                <Input
                  aria-invalid={isInvalid}
                  autoComplete="off"
                  id={field.name}
                  name={field.name}
                  onBlur={field.handleBlur}
                  onChange={(event) => field.handleChange(event.target.value)}
                  value={field.state.value}
                />
                <FieldDescription>
                  Optional. The work email is used when the name is blank.
                </FieldDescription>
                {isInvalid ? (
                  <FieldError errors={field.state.meta.errors} />
                ) : null}
              </Field>
            );
          }}
        </form.Field>
        <form.Field name="role">
          {(field) => {
            const isInvalid =
              field.state.meta.isTouched && !field.state.meta.isValid;

            return (
              <Field data-invalid={isInvalid}>
                <FieldLabel htmlFor={field.name}>Role</FieldLabel>
                <Select
                  items={accountRoles.filter(
                    (role) => canAssignPrivileged || role.value === "user",
                  )}
                  name={field.name}
                  onValueChange={(value) => {
                    if (value) field.handleChange(value);
                  }}
                  value={field.state.value}
                >
                  <SelectTrigger
                    aria-invalid={isInvalid}
                    className="w-full"
                    id={field.name}
                    size="sm"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {accountRoles
                        .filter(
                          (role) =>
                            canAssignPrivileged || role.value === "user",
                        )
                        .map((role) => (
                          <SelectItem key={role.value} value={role.value}>
                            {role.label}
                          </SelectItem>
                        ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
                <FieldDescription>
                  This role applies across Tagaroa. Team membership controls
                  domain access.
                </FieldDescription>
                {isInvalid ? (
                  <FieldError errors={field.state.meta.errors} />
                ) : null}
              </Field>
            );
          }}
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
