import { IDENTITY_ROLES, type IdentityRoleId } from "@repo/contracts/identity";
import {
  Field,
  FieldDescription,
  FieldError,
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
import type { AnyFieldApi } from "@tanstack/react-form";
import type { ReactNode } from "react";

/** Sign-in roles an operator can give an account, in the order offered. */
export const accountRoles = IDENTITY_ROLES.map(({ id, label }) => ({
  label,
  value: id,
}));

export type AccountRole = IdentityRoleId;

const isInvalid = (field: AnyFieldApi) =>
  field.state.meta.isTouched && !field.state.meta.isValid;

export function AccountTextField({
  description,
  field,
  label,
  placeholder,
  required,
  type,
}: {
  description?: ReactNode;
  field: AnyFieldApi;
  label: string;
  placeholder?: string;
  required?: boolean;
  type?: "email";
}) {
  const invalid = isInvalid(field);
  return (
    <Field data-invalid={invalid}>
      <FieldLabel htmlFor={field.name}>{label}</FieldLabel>
      <Input
        aria-invalid={invalid}
        autoComplete="off"
        id={field.name}
        name={field.name}
        onBlur={field.handleBlur}
        onChange={(event) => field.handleChange(event.target.value)}
        placeholder={placeholder}
        required={required}
        type={type}
        value={field.state.value}
      />
      {description ? <FieldDescription>{description}</FieldDescription> : null}
      {invalid ? <FieldError errors={field.state.meta.errors} /> : null}
    </Field>
  );
}

export function AccountRoleField({
  description,
  disabled,
  field,
  roles,
}: {
  description: ReactNode;
  disabled?: boolean;
  field: AnyFieldApi;
  roles: ReadonlyArray<(typeof accountRoles)[number]>;
}) {
  const invalid = isInvalid(field);
  return (
    <Field data-disabled={disabled} data-invalid={invalid}>
      <FieldLabel htmlFor={field.name}>Role</FieldLabel>
      <Select
        disabled={disabled}
        items={roles}
        name={field.name}
        onValueChange={(value) => {
          if (value) field.handleChange(value);
        }}
        value={field.state.value}
      >
        <SelectTrigger
          aria-invalid={invalid}
          className="w-full"
          id={field.name}
          size="sm"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {roles.map((role) => (
              <SelectItem key={role.value} value={role.value}>
                {role.label}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
      <FieldDescription>{description}</FieldDescription>
      {invalid ? <FieldError errors={field.state.meta.errors} /> : null}
    </Field>
  );
}
