import {
  Button,
  Field,
  FieldContent,
  FieldDescription,
  FieldLabel,
  FieldTitle,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  Switch,
} from "@repo/ui";

export const Open = () => (
  <Sheet defaultOpen modal={false}>
    <SheetContent side="right">
      <SheetHeader>
        <SheetTitle>Edit team assignment</SheetTitle>
        <SheetDescription>Bram de Vries · Engineering</SheetDescription>
      </SheetHeader>
      <div className="gap-4 px-4 flex flex-col">
        <FieldLabel htmlFor="sheet-notify">
          <Field orientation="horizontal">
            <FieldContent>
              <FieldTitle>Notify on change</FieldTitle>
              <FieldDescription>
                Email Bram when this assignment updates.
              </FieldDescription>
            </FieldContent>
            <Switch id="sheet-notify" defaultChecked />
          </Field>
        </FieldLabel>
      </div>
      <SheetFooter>
        <Button>Save assignment</Button>
        <Button variant="outline">Cancel</Button>
      </SheetFooter>
    </SheetContent>
  </Sheet>
);
