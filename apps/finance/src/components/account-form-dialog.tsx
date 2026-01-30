"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  accountMutationOptions,
  accountTypesQueryOptions,
} from "@repo/common/lib/query/account-query";
import { type Account, accountSchema } from "@repo/common/types/account";
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
import { useMutation, useQuery } from "@tanstack/react-query";
import { PlusIcon } from "lucide-react";
import { useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { NumericFormat } from "react-number-format";
import { toast } from "sonner";

const currencies = [
  { value: "IDR", label: "Indonesian Rupiah (IDR)" },
  { value: "USD", label: "US Dollar (USD)" },
  { value: "SGD", label: "Singapore Dollar (SGD)" },
];

type AccountFormDialogProps = Readonly<{
  initialData?: Account;
  trigger?: React.ReactElement;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}>;

export function AccountFormDialog({
  initialData,
  trigger,
  defaultOpen = false,
  onOpenChange: externalOnOpenChange,
}: AccountFormDialogProps) {
  const [internalOpen, setInternalOpen] = useState(defaultOpen);

  const form = useForm<Account>({
    resolver: zodResolver(accountSchema),
    defaultValues: initialData
      ? {
          id: initialData.id,
          name: initialData.name,
          type: initialData.type,
          balance: initialData.balance,
          currency: initialData.currency,
          notes: initialData.notes ?? "",
        }
      : {
          name: "",
          type: "BANK",
          balance: 0,
          currency: "IDR",
          notes: "",
        },
  });

  const selectedCurrency = useWatch({
    control: form.control,
    name: "currency",
  });

  const setOpen = (newOpen: boolean) => {
    setInternalOpen(newOpen);
    externalOnOpenChange?.(newOpen);
  };

  const open = internalOpen;

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      form.reset();
    }
    setOpen(newOpen);
  };

  const { mutate, isPending } = useMutation({
    ...accountMutationOptions(),
    onSuccess: () => {
      toast.success(initialData ? "Account updated" : "Account created");
      form.reset();
      setOpen(false);
    },
    onError: (err) => {
      toast.error("Failed to save account", {
        description: err.message,
      });
    },
  });

  const onSubmit = async () => {
    mutate({
      id: initialData?.id,
      name: form.getValues("name"),
      type: form.getValues("type"),
      balance: form.getValues("balance"),
      currency: form.getValues("currency"),
      notes: form.getValues("notes"),
    });
  };

  const { data: accountTypes } = useQuery(accountTypesQueryOptions());

  let submitLabel = "Add Account";
  if (initialData) {
    submitLabel = "Update Account";
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
            Add account
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="!max-w-2xl !w-full max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {initialData ? "Edit Account" : "Add New Account"}
          </DialogTitle>
          <DialogDescription>
            {initialData
              ? "Edit your account details below."
              : "Add a new account to your portfolio."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* Form Fields in 2-column Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Controller
              control={form.control}
              name="name"
              render={({ field, fieldState }) => (
                <Field>
                  <FieldLabel>Account Name</FieldLabel>
                  <InputGroup>
                    <InputGroupInput
                      {...field}
                      type="text"
                      placeholder="e.g., BCA, Gopay"
                    />
                  </InputGroup>
                  <FieldDescription>
                    Use a name that helps you easily recognize this account.
                  </FieldDescription>
                  {fieldState.invalid && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </Field>
              )}
            />

            <Controller
              control={form.control}
              name="type"
              render={({ field, fieldState }) => (
                <Field>
                  <FieldLabel>Account Type</FieldLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <SelectTrigger disabled={!!initialData} className="w-full">
                      <SelectValue placeholder="Select account type" />
                    </SelectTrigger>
                    <SelectContent>
                      {(accountTypes ?? []).map((type) => (
                        <SelectItem key={type} value={type}>
                          {type}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FieldDescription>
                    Specify the type of account, such as bank, cash, or
                    e-wallet.
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
              name="balance"
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
                    <FieldLabel>Current Balance</FieldLabel>
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
                      Enter the current or initial balance of this account.
                    </FieldDescription>
                    {fieldState.invalid && (
                      <FieldError errors={[fieldState.error]} />
                    )}
                  </Field>
                );
              }}
            />
          </div>

          {/* Notes Field - Full width */}
          <Controller
            control={form.control}
            name="notes"
            render={({ field, fieldState }) => (
              <Field>
                <FieldLabel>Notes (Optional)</FieldLabel>
                <InputGroup>
                  <InputGroupTextarea
                    {...field}
                    className="min-h-[80px]"
                    placeholder="Add any additional notes about this account..."
                  />
                </InputGroup>
                <FieldDescription>
                  Add any notes or details to describe this account (optional).
                </FieldDescription>
                {fieldState.invalid && (
                  <FieldError errors={[fieldState.error]} />
                )}
              </Field>
            )}
          />
          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending} className="flex-1">
              {submitLabel}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
