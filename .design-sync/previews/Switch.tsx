import {
  Field,
  FieldContent,
  FieldDescription,
  FieldLabel,
  FieldTitle,
  Switch,
} from "@repo/ui";

export const Sizes = () => (
  <div className="gap-6 flex items-center">
    <div className="gap-2 flex items-center">
      <Switch size="sm" defaultChecked />
      <span className="text-sm text-muted-foreground">sm</span>
    </div>
    <div className="gap-2 flex items-center">
      <Switch size="default" defaultChecked />
      <span className="text-sm text-muted-foreground">default</span>
    </div>
  </div>
);

export const States = () => (
  <div className="max-w-sm gap-3 flex flex-col">
    <FieldLabel htmlFor="switch-mfa">
      <Field orientation="horizontal">
        <FieldContent>
          <FieldTitle>Require MFA for admins</FieldTitle>
          <FieldDescription>
            Enforced for domain administrator and super-admin roles.
          </FieldDescription>
        </FieldContent>
        <Switch id="switch-mfa" defaultChecked />
      </Field>
    </FieldLabel>
    <FieldLabel htmlFor="switch-notify">
      <Field orientation="horizontal">
        <FieldContent>
          <FieldTitle>Email notifications</FieldTitle>
          <FieldDescription>
            Weekly digest of directory changes.
          </FieldDescription>
        </FieldContent>
        <Switch id="switch-notify" />
      </Field>
    </FieldLabel>
    <FieldLabel htmlFor="switch-disabled" data-disabled="true">
      <Field orientation="horizontal">
        <FieldContent>
          <FieldTitle>SCIM provisioning</FieldTitle>
          <FieldDescription>Managed by the identity provider.</FieldDescription>
        </FieldContent>
        <Switch id="switch-disabled" defaultChecked disabled />
      </Field>
    </FieldLabel>
  </div>
);
