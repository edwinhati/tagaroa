"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { currencies } from "@repo/common/lib/currencies";
import {
  accountTypesQueryOptions,
  useAccountMutationOptions,
} from "@repo/common/lib/query/account-query";
import {
  type Account,
  type AccountFormData,
  accountSchema,
} from "@repo/common/types/account";
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
import { IconLoader2, IconPlus } from "@tabler/icons-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { NumericFormat } from "react-number-format";
import { toast } from "sonner";

type AccountFormDialogProps = Readonly<{
  initialData?: Account;
  trigger?: React.ReactElement | null;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  defaultType?: string;
}>;

const LIABILITY_TYPES = new Set(["CREDIT-CARD", "PAY-LATER"]);

export function AccountFormDialog({
  initialData,
  trigger,
  open: externalOpen,
  onOpenChange: externalOnOpenChange,
  defaultType = "BANK",
}: AccountFormDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);

  const form = useForm<AccountFormData>({
    resolver: zodResolver(accountSchema),
    defaultValues: initialData
      ? {
          id: initialData.id,
          name: initialData.name,
          type: initialData.type,
          balance: initialData.balance,
          currency: initialData.currency,
          notes: initialData.notes ?? "",
          creditLimit: (initialData.metadata as { creditLimit?: number })
            ?.creditLimit,
          billingCycleDay: (
            initialData.metadata as { billingCycleDay?: number }
          )?.billingCycleDay,
          accountNumber: (initialData.metadata as { accountNumber?: string })
            ?.accountNumber,
        }
      : {
          name: "",
          type: defaultType,
          balance: 0,
          currency: "IDR",
          notes: "",
          creditLimit: undefined,
          billingCycleDay: undefined,
          accountNumber: undefined,
        },
  });

  const selectedCurrency = useWatch({
    control: form.control,
    name: "currency",
  });

  const selectedType = useWatch({
    control: form.control,
    name: "type",
  });

  // Determine if this is a liability account based on type
  const isLiability = LIABILITY_TYPES.has(selectedType);

  // Update default type when prop changes
  useEffect(() => {
    if (!initialData && defaultType) {
      form.setValue("type", defaultType);
    }
  }, [defaultType, form, initialData]);

  // Reset form when initialData changes (for edit mode)
  useEffect(() => {
    if (initialData) {
      form.reset({
        id: initialData.id,
        name: initialData.name,
        type: initialData.type,
        balance: initialData.balance,
        currency: initialData.currency,
        notes: initialData.notes ?? "",
        creditLimit: (initialData.metadata as { creditLimit?: number })
          ?.creditLimit,
        billingCycleDay: (initialData.metadata as { billingCycleDay?: number })
          ?.billingCycleDay,
        accountNumber: (initialData.metadata as { accountNumber?: string })
          ?.accountNumber,
      });
    }
  }, [initialData, form]);

  const isControlled = externalOpen !== undefined;
  const open = isControlled ? externalOpen : internalOpen;

  const setOpen = (newOpen: boolean) => {
    if (!isControlled) {
      setInternalOpen(newOpen);
    }
    externalOnOpenChange?.(newOpen);
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      form.reset();
    }
    setOpen(newOpen);
  };

  const accountMutationOpts = useAccountMutationOptions();
  const { mutate, isPending } = useMutation({
    ...accountMutationOpts,
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

  const onSubmit = async (formData: AccountFormData) => {
    // Build metadata based on account kind
    const metadata: Record<string, unknown> = {};

    if (isLiability) {
      // Credit account metadata
      if (formData.creditLimit !== undefined && formData.creditLimit > 0) {
        metadata.creditLimit = formData.creditLimit;
      }
      if (
        formData.billingCycleDay !== undefined &&
        formData.billingCycleDay > 0
      ) {
        metadata.billingCycleDay = formData.billingCycleDay;
      }
    } else if (formData.accountNumber) {
      // Asset account metadata
      metadata.accountNumber = formData.accountNumber;
    }

    const accountData = {
      id: initialData?.id,
      name: formData.name,
      type: formData.type,
      balance: formData.balance,
      currency: formData.currency,
      notes: formData.notes,
      metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
    };

    mutate(accountData);
  };

  const { data: accountTypes } = useQuery(accountTypesQueryOptions());

  let submitLabel = "Add Account";
  if (initialData) {
    submitLabel = "Update Account";
  }
  if (isPending) {
    submitLabel = "Saving...";
  }

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
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {trigger !== null && (
        <DialogTrigger
          nativeButton={true}
          render={
            trigger ?? (
              <Button className="ml-auto" size="sm">
                <IconPlus
                  className="-ms-1 opacity-60"
                  size={16}
                  aria-hidden="true"
                />
                Add account
              </Button>
            )
          }
        />
      )}
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
                  <Select onValueChange={field.onChange} value={field.value}>
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
                  <Select onValueChange={field.onChange} value={field.value}>
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
              render={({ field, fieldState }) => (
                <Field>
                  <FieldLabel>Current Balance</FieldLabel>
                  <InputGroup>
                    <NumericFormat
                      customInput={InputGroupInput}
                      thousandSeparator="."
                      decimalSeparator=","
                      decimalScale={2}
                      fixedDecimalScale
                      allowNegative={isLiability}
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
              )}
            />

            {/* Account Number - only for asset accounts */}
            {!isLiability && (
              <Controller
                control={form.control}
                name="accountNumber"
                render={({ field, fieldState }) => (
                  <Field>
                    <FieldLabel>
                      Account Number{" "}
                      <span className="text-muted-foreground">(Optional)</span>
                    </FieldLabel>
                    <InputGroup>
                      <InputGroupInput
                        {...field}
                        type="text"
                        maxLength={4}
                        placeholder="1234"
                        value={field.value ?? ""}
                      />
                    </InputGroup>
                    <FieldDescription>
                      Only the last 4 digits are stored for security
                    </FieldDescription>
                    {fieldState.invalid && (
                      <FieldError errors={[fieldState.error]} />
                    )}
                  </Field>
                )}
              />
            )}
          </div>

          {/* Credit Account Specific Fields */}
          {isLiability && (
            <div className="rounded-lg border p-4 space-y-4">
              <h4 className="font-medium flex items-center gap-2">
                Credit Account Details
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Controller
                  control={form.control}
                  name="creditLimit"
                  render={({ field, fieldState }) => (
                    <Field>
                      <FieldLabel>Credit Limit</FieldLabel>
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
                            field.onChange(values.floatValue ?? undefined);
                          }}
                          onBlur={field.onBlur}
                          name={field.name}
                          getInputRef={field.ref}
                        />
                      </InputGroup>
                      <FieldDescription>
                        Maximum credit available
                      </FieldDescription>
                      {fieldState.invalid && (
                        <FieldError errors={[fieldState.error]} />
                      )}
                    </Field>
                  )}
                />

                <Controller
                  control={form.control}
                  name="billingCycleDay"
                  render={({ field, fieldState }) => (
                    <Field>
                      <FieldLabel>Billing Cycle Day</FieldLabel>
                      <InputGroup>
                        <InputGroupInput
                          {...field}
                          type="number"
                          min={1}
                          max={31}
                          placeholder="e.g., 15"
                          value={field.value ?? ""}
                          onChange={(e) =>
                            field.onChange(
                              e.target.value
                                ? Number.parseInt(e.target.value, 10)
                                : undefined,
                            )
                          }
                        />
                      </InputGroup>
                      <FieldDescription>Day of month (1-31)</FieldDescription>
                      {fieldState.invalid && (
                        <FieldError errors={[fieldState.error]} />
                      )}
                    </Field>
                  )}
                />
              </div>
            </div>
          )}

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
              {isPending && (
                <IconLoader2
                  className="mr-2 h-4 w-4 animate-spin"
                  aria-hidden="true"
                />
              )}
              {submitLabel}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
