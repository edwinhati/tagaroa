"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { currencies } from "@repo/common/lib/currencies";
import {
  liabilityTypesQueryOptions,
  useLiabilityMutationOptions,
} from "@repo/common/lib/query/liability-query";
import { type Liability, liabilitySchema } from "@repo/common/types/liability";
import { Button } from "@repo/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@repo/ui/components/dialog";
import { Field, FieldError, FieldLabel } from "@repo/ui/components/field";
import {
  InputGroup,
  InputGroupInput,
  InputGroupTextarea,
} from "@repo/ui/components/input-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select";
import { cn } from "@repo/ui/lib/utils";
import { IconLoader2, IconPlus } from "@tabler/icons-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { NumericFormat } from "react-number-format";
import { toast } from "sonner";

type LiabilityFormDialogProps = Readonly<{
  initialData?: Liability;
  trigger?: React.ReactElement;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}>;

export function LiabilityFormDialog({
  initialData,
  trigger,
  open: controlledOpen,
  onOpenChange,
}: LiabilityFormDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = (value: boolean) => {
    if (!isControlled) {
      setInternalOpen(value);
    }
    onOpenChange?.(value);
  };

  const form = useForm<Liability>({
    resolver: zodResolver(liabilitySchema),
    defaultValues: initialData ?? {
      name: "",
      type: "LOAN",
      amount: 0,
      currency: "IDR",
      notes: "",
      paidAt: null,
    },
  });

  const selectedCurrency = useWatch({
    control: form.control,
    name: "currency",
  });

  const liabilityMutationOpts = useLiabilityMutationOptions();
  const { mutate, isPending } = useMutation({
    ...liabilityMutationOpts,
    onSuccess: () => {
      toast.success(initialData ? "Liability updated" : "Liability created");
      form.reset();
      setOpen(false);
    },
    onError: (err) =>
      toast.error("Failed to save liability", { description: err.message }),
  });

  const { data: liabilityTypes } = useQuery(liabilityTypesQueryOptions());

  const onSubmit = () => mutate({ ...form.getValues(), id: initialData?.id });

  let submitButtonContent: React.ReactNode = "Add Liability";
  if (isPending) {
    submitButtonContent = (
      <>
        <IconLoader2 className="animate-spin mr-2 h-4 w-4" aria-hidden="true" />
        Saving...
      </>
    );
  } else if (initialData) {
    submitButtonContent = "Update Liability";
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) form.reset();
        setOpen(v);
      }}
    >
      {trigger && (
        <DialogTrigger
          nativeButton={true}
          render={
            trigger ?? (
              <Button className="ml-auto" size="sm">
                <IconPlus className="-ms-1 opacity-60" size={16} /> Add
                liability
              </Button>
            )
          }
        />
      )}
      <DialogContent className="!max-w-2xl !w-full max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {initialData ? "Edit Liability" : "Add New Liability"}
          </DialogTitle>
          <DialogDescription>
            {initialData
              ? "Edit your liability details below."
              : "Add a new liability to track your net worth."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <Field>
            <FieldLabel>Name</FieldLabel>
            <InputGroup>
              <InputGroupInput
                {...form.register("name")}
                placeholder="Liability name"
                autoFocus
                className={cn(
                  form.formState.errors.name &&
                    "border-destructive focus-visible:ring-destructive",
                )}
                aria-invalid={!!form.formState.errors.name}
              />
            </InputGroup>
            {form.formState.errors.name && (
              <FieldError>{form.formState.errors.name.message}</FieldError>
            )}
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field>
              <FieldLabel>Type</FieldLabel>
              <Controller
                name="type"
                control={form.control}
                render={({ field }) => (
                  <Select
                    value={field.value ?? ""}
                    onValueChange={field.onChange}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      {liabilityTypes?.map((type) => (
                        <SelectItem key={type} value={type}>
                          {type.replaceAll("_", " ")}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>
            <Field>
              <FieldLabel>Currency</FieldLabel>
              <Controller
                name="currency"
                control={form.control}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select currency" />
                    </SelectTrigger>
                    <SelectContent>
                      {currencies.map((c) => (
                        <SelectItem key={c.value} value={c.value}>
                          {c.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>
          </div>

          <Field>
            <FieldLabel>Amount</FieldLabel>
            <Controller
              name="amount"
              control={form.control}
              render={({ field }) => (
                <InputGroup>
                  <NumericFormat
                    customInput={InputGroupInput}
                    thousandSeparator={selectedCurrency === "IDR" ? "." : ","}
                    decimalSeparator={selectedCurrency === "IDR" ? "," : "."}
                    prefix={selectedCurrency === "IDR" ? "Rp " : "$ "}
                    value={field.value}
                    onValueChange={(v) => field.onChange(v.floatValue ?? 0)}
                  />
                </InputGroup>
              )}
            />
          </Field>

          <Field>
            <FieldLabel>Notes</FieldLabel>
            <InputGroup>
              <InputGroupTextarea
                {...form.register("notes")}
                placeholder="Optional notes"
              />
            </InputGroup>
          </Field>

          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isPending}
              aria-busy={isPending}
              className="flex-1"
            >
              {submitButtonContent}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
