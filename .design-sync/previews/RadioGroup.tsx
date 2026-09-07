import {
  Field,
  FieldContent,
  FieldDescription,
  FieldLabel,
  FieldSet,
  FieldTitle,
  RadioGroup,
  RadioGroupItem,
} from "@repo/ui";

export const Options = () => (
  <FieldSet className="max-w-sm">
    <RadioGroup defaultValue="member">
      <FieldLabel htmlFor="role-member">
        <Field orientation="horizontal">
          <RadioGroupItem value="member" id="role-member" />
          <FieldContent>
            <FieldTitle>Member</FieldTitle>
            <FieldDescription>
              Can view records within their own team.
            </FieldDescription>
          </FieldContent>
        </Field>
      </FieldLabel>
      <FieldLabel htmlFor="role-manager">
        <Field orientation="horizontal">
          <RadioGroupItem value="manager" id="role-manager" />
          <FieldContent>
            <FieldTitle>Manager</FieldTitle>
            <FieldDescription>
              Can also approve time off and edit team records.
            </FieldDescription>
          </FieldContent>
        </Field>
      </FieldLabel>
      <FieldLabel htmlFor="role-admin">
        <Field orientation="horizontal">
          <RadioGroupItem value="admin" id="role-admin" disabled />
          <FieldContent>
            <FieldTitle>Domain administrator</FieldTitle>
            <FieldDescription>Requires MFA to assign.</FieldDescription>
          </FieldContent>
        </Field>
      </FieldLabel>
    </RadioGroup>
  </FieldSet>
);
