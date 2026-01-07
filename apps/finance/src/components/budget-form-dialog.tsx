"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { budgetMutationOptions } from "@repo/common/lib/query/budget-query";
import {
  type Budget,
  type BudgetInput,
  budgetSchema,
} from "@repo/common/types/budget";
import { Button } from "@repo/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@repo/ui/components/dialog";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@repo/ui/components/field";
import { InputGroup, InputGroupInput } from "@repo/ui/components/input-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select";
import { useMutation } from "@tanstack/react-query";
import { PlusIcon } from "lucide-react";
import { useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { NumericFormat } from "react-number-format";
import { toast } from "sonner";

type BudgetFormDialogProps = Readonly<{
  initialData?: Budget;
  trigger?: React.ReactElement;
}>;

const currencies = [
  { value: "IDR", label: "Indonesian Rupiah (IDR)" },
  { value: "USD", label: "US Dollar (USD)" },
  { value: "SGD", label: "Singapore Dollar (SGD)" },
];

export function BudgetFormDialog({
  initialData,
  trigger,
}: BudgetFormDialogProps) {
  const [open, setOpen] = useState(false);

  const form = useForm<BudgetInput>({
    resolver: zodResolver(budgetSchema),
    defaultValues: initialData
      ? {
          id: initialData.id,
          month: initialData.month,
          year: initialData.year,
          amount: initialData.amount,
          currency: initialData.currency,
        }
      : {
          month: new Date().getMonth(),
          year: new Date().getFullYear(),
          amount: 0,
          currency: "IDR",
        },
  });

  const selectedCurrency = useWatch({
    control: form.control,
    name: "currency",
  });

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      form.reset();
    }
    setOpen(newOpen);
  };

  const { mutate, isPending } = useMutation({
    ...budgetMutationOptions(),
    onSuccess: () => {
      toast.success(initialData ? "Budget updated" : "Budget created");
      form.reset();
      setOpen(false);
    },
    onError: (err) => {
      toast.error("Failed to save budget", {
        description: err.message,
      });
    },
  });

  const onSubmit = async () => {
    mutate({
      id: initialData?.id,
      month: form.getValues("month"),
      year: form.getValues("year"),
      amount: form.getValues("amount"),
      currency: form.getValues("currency"),
    });
  };

  let submitLabel = "Add Budget";
  if (initialData) {
    submitLabel = "Update Budget";
  }
  if (isPending) {
    submitLabel = "Saving...";
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button className="ml-auto" size="sm">
            <PlusIcon
              className="-ms-1 opacity-60"
              size={16}
              aria-hidden="true"
            />
            Create budget
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="!max-w-2xl !w-full max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {initialData ? "Edit Budget" : "Add New Budget"}
          </DialogTitle>
          <DialogDescription>
            {initialData
              ? "Edit your budget details below."
              : "Set up a new monthly budget."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Controller
              control={form.control}
              name="month"
              render={({ field, fieldState }) => (
                <Field>
                  <FieldLabel>Month</FieldLabel>
                  <Select
                    onValueChange={(value) => field.onChange(Number(value))}
                    defaultValue={String(field.value)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select month" />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 12 }, (_, i) => i + 1).map(
                        (month) => (
                          <SelectItem key={month} value={String(month)}>
                            {new Date(2000, month - 1).toLocaleString(
                              "default",
                              { month: "long" },
                            )}
                          </SelectItem>
                        ),
                      )}
                    </SelectContent>
                  </Select>
                  <FieldDescription>
                    Select the month for this budget.
                  </FieldDescription>
                  {fieldState.invalid && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </Field>
              )}
            />
            <Controller
              control={form.control}
              name="year"
              render={({ field, fieldState }) => (
                <Field>
                  <FieldLabel>Year</FieldLabel>
                  <Select
                    onValueChange={(value) => field.onChange(Number(value))}
                    defaultValue={String(field.value)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select year" />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from(
                        { length: 10 },
                        (_, i) => new Date().getFullYear() - 2 + i,
                      ).map((year) => (
                        <SelectItem key={year} value={String(year)}>
                          {year}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FieldDescription>
                    Select the year for this budget.
                  </FieldDescription>
                  {fieldState.invalid && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </Field>
              )}
            />
            <Controller
              control={form.control}
              name="currency"
              render={({ field, fieldState }) => (
                <Field>
                  <FieldLabel>Currency</FieldLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select currency" />
                    </SelectTrigger>
                    <SelectContent>
                      {currencies.map((currency) => (
                        <SelectItem key={currency.value} value={currency.value}>
                          {currency.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FieldDescription>
                    Choose the currency in which this account operates.
                  </FieldDescription>
                  {fieldState.invalid && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </Field>
              )}
            />
            <Controller
              control={form.control}
              name="amount"
              render={({ field, fieldState }) => {
                const getCurrencyPrefix = (currency: string) => {
                  switch (currency) {
                    case "USD":
                      return "$ ";
                    case "SGD":
                      return "S$ ";
                    default:
                      return "Rp ";
                  }
                };

                const getCurrencyPlaceholder = (currency: string) => {
                  switch (currency) {
                    case "USD":
                      return "$ 0.00";
                    case "SGD":
                      return "S$ 0.00";
                    default:
                      return "Rp 0,00";
                  }
                };
                return (
                  <Field>
                    <FieldLabel>Budget Amount</FieldLabel>
                    <InputGroup>
                      <NumericFormat
                        customInput={InputGroupInput}
                        thousandSeparator="."
                        decimalSeparator=","
                        decimalScale={2}
                        fixedDecimalScale
                        prefix={getCurrencyPrefix(selectedCurrency)}
                        placeholder={getCurrencyPlaceholder(selectedCurrency)}
                        value={field.value}
                        onValueChange={(values) => {
                          field.onChange(values.floatValue ?? 0);
                        }}
                        onBlur={field.onBlur}
                        name={field.name}
                        getInputRef={field.ref}
                      />
                    </InputGroup>
                    <FieldDescription>
                      Enter the total budget amount for this month.
                    </FieldDescription>
                    {fieldState.invalid && (
                      <FieldError errors={[fieldState.error]} />
                    )}
                  </Field>
                );
              }}
            />
          </div>
          <div className="flex justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {submitLabel}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
