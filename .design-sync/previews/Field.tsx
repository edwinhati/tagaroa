import {
  Checkbox,
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldTitle,
  Input,
} from "@repo/ui";

export const Valid = () => (
  <FieldGroup className="max-w-sm">
    <Field>
      <FieldLabel htmlFor="ds-field-name">Display name</FieldLabel>
      <Input defaultValue="Ada Okonkwo" id="ds-field-name" />
      <FieldDescription>
        Shown to teammates across every domain.
      </FieldDescription>
    </Field>
  </FieldGroup>
);

export const Invalid = () => (
  <FieldGroup className="max-w-sm">
    <Field data-invalid="true">
      <FieldLabel htmlFor="ds-field-email">Work email</FieldLabel>
      <Input aria-invalid defaultValue="ada.okonkwo" id="ds-field-email" />
      <FieldError>Enter a complete email address.</FieldError>
    </Field>
  </FieldGroup>
);

export const Horizontal = () => (
  <FieldGroup className="max-w-sm">
    <Field orientation="horizontal">
      <FieldContent>
        <FieldTitle>Require MFA</FieldTitle>
        <FieldDescription>
          Needed for any break-glass elevation.
        </FieldDescription>
      </FieldContent>
      <Checkbox aria-label="Require MFA" defaultChecked />
    </Field>
  </FieldGroup>
);
