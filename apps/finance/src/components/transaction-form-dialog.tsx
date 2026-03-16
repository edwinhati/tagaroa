"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { FileUpload } from "@repo/common/components/file-upload";
import { useBudgetPeriod } from "@repo/common/hooks/use-budget-period";
import type { FileWithPreview } from "@repo/common/hooks/use-file-upload";
import { currencies } from "@repo/common/lib/currencies";
import { storageApi } from "@repo/common/lib/http";
import { accountQueryOptions } from "@repo/common/lib/query/account-query";
import { budgetQueryOptions } from "@repo/common/lib/query/budget-query";
import type { FileMetadata as StorageFileMetadata } from "@repo/common/lib/query/storage-query";
import { uploadFileMutationOptions } from "@repo/common/lib/query/storage-query";
import {
  transactionMutationOptions,
  transactionTypesQueryOptions,
} from "@repo/common/lib/query/transaction-query";
import { getAccountCategoryFromType } from "@repo/common/types/account";
import {
  calculateMonthlyInstallment,
  formatInstallmentBreakdown,
  type Transaction,
  transactionSchema,
} from "@repo/common/types/transaction";
import { Button } from "@repo/ui/components/button";
import { Calendar } from "@repo/ui/components/calendar";
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@repo/ui/components/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select";
import { cn } from "@repo/ui/lib/utils";
import {
  IconCalendar,
  IconClock,
  IconCreditCard,
  IconLoader2,
  IconPlus,
} from "@tabler/icons-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { useEffect, useRef, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { NumericFormat } from "react-number-format";
import { toast } from "sonner";

type PaymentMethod = "full" | "installment";

type TransactionFormDialogProps = Readonly<{
  initialData?: Partial<Transaction>;
  trigger?: React.ReactElement;
  nativeButton?: boolean;
  onSuccess?: () => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}>;

const TENURE_OPTIONS = [
  { value: 3, label: "3 months" },
  { value: 6, label: "6 months" },
  { value: 12, label: "12 months" },
  { value: 24, label: "24 months" },
];

function getDefaultValues(initialData?: Partial<Transaction>): Transaction {
  const defaultDate = initialData?.date ?? new Date();

  return {
    id: initialData?.id ?? undefined,
    amount: initialData?.amount ?? 0,
    date: defaultDate,
    type: initialData?.type ?? "EXPENSE",
    currency: initialData?.currency ?? "IDR",
    notes: initialData?.notes ?? "",
    files: initialData?.files ?? [],
    account_id: initialData?.account_id ?? "",
    budget_item_id: initialData?.budget_item_id ?? "",
    installment: initialData?.installment,
  };
}

export function TransactionFormDialog({
  initialData,
  trigger,
  nativeButton,
  onSuccess,
  open: externalOpen,
  onOpenChange: externalOnOpenChange,
}: TransactionFormDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [dateOpen, setDateOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(
    initialData?.installment ? "installment" : "full",
  );

  const open = externalOpen ?? internalOpen;
  const setOpen = (newOpen: boolean) => {
    externalOnOpenChange?.(newOpen);
    if (!externalOnOpenChange) {
      setInternalOpen(newOpen);
    }
  };

  const [uploadedFiles, setUploadedFiles] = useState<FileWithPreview[]>([]);

  // Load existing files when initialData changes
  useEffect(() => {
    if (initialData?.files && initialData.files.length > 0) {
      const loadFiles = async () => {
        const files = initialData.files || [];
        const filePromises = files.map(async (fileId) => {
          try {
            const fileMetadata = await getFile(fileId);
            return {
              file: {
                id: fileId,
                name: fileMetadata.original_name || "Unknown File",
                size: fileMetadata.size || 0,
                type: fileMetadata.content_type || "application/octet-stream",
                url: fileMetadata.url,
              },
              id: fileId,
              preview: fileMetadata.url,
            };
          } catch (error) {
            console.error(`Failed to load file ${fileId}:`, error);
            return {
              file: {
                id: fileId,
                name: "Error Loading File",
                size: 0,
                type: "application/octet-stream",
                url: "",
              },
              id: fileId,
              preview: "",
            };
          }
        });

        const loadedFiles = await Promise.all(filePromises);
        setUploadedFiles(loadedFiles);
      };

      loadFiles();
    }
  }, [initialData?.files]);
  const uploadingFilesRef = useRef<Set<string>>(new Set());

  const { data: transactionTypes } = useQuery(transactionTypesQueryOptions());
  const { data: accountsData } = useQuery(accountQueryOptions({ limit: 100 }));

  const form = useForm<Transaction>({
    resolver: zodResolver(transactionSchema),
    defaultValues: getDefaultValues(initialData),
  });

  // Update form when initialData changes (for pre-fill scenarios)
  useEffect(() => {
    if (initialData) {
      form.reset(getDefaultValues(initialData));
      setPaymentMethod(initialData?.installment ? "installment" : "full");
    }
  }, [initialData, form]);

  // Sync uploaded files with form field
  useEffect(() => {
    const fileIds = uploadedFiles
      .filter((f) => !(f.file instanceof File))
      .map((f) => f.id);
    form.setValue("files", fileIds);
  }, [uploadedFiles, form]);

  const selectedDate = useWatch({
    control: form.control,
    name: "date",
  });

  const { month, year } = useBudgetPeriod((s) => ({
    month: s.month,
    year: s.year,
  }));

  const { data: budgetData } = useQuery({
    ...budgetQueryOptions({
      month,
      year,
    }),
    enabled: !!selectedDate,
  });

  const selectedCurrency = useWatch({
    control: form.control,
    name: "currency",
  });

  const selectedAccountId = useWatch({
    control: form.control,
    name: "account_id",
  });

  const selectedAmount = useWatch({
    control: form.control,
    name: "amount",
  });

  // Check if selected account is a liability (credit card/pay-later)
  const selectedAccount = accountsData?.accounts?.find(
    (a) => a.id === selectedAccountId,
  );
  const isLiabilityAccount =
    selectedAccount &&
    getAccountCategoryFromType(selectedAccount.type) === "LIABILITY";

  // Initialize installment defaults when dialog opens with installment payment method
  useEffect(() => {
    if (open && paymentMethod === "installment" && isLiabilityAccount) {
      const currentInstallment = form.getValues("installment");
      const tenure = currentInstallment?.tenure ?? 3;
      const interestRate = currentInstallment?.interestRate ?? 0;
      const amount = form.getValues("amount") || 0;

      const monthlyAmount = calculateMonthlyInstallment(
        amount,
        interestRate,
        tenure,
      );

      form.setValue("installment", {
        tenure,
        interestRate,
        monthlyAmount,
      });
    }
  }, [open, paymentMethod, isLiabilityAccount, form]);

  // Watch installment fields for auto-calculation
  const installmentTenure = useWatch({
    control: form.control,
    name: "installment.tenure",
  });
  const installmentInterestRate = useWatch({
    control: form.control,
    name: "installment.interestRate",
  });

  // Auto-calculate monthly amount when tenure or interest changes
  useEffect(() => {
    if (
      paymentMethod === "installment" &&
      selectedAmount > 0 &&
      installmentTenure &&
      installmentInterestRate !== undefined
    ) {
      const monthlyAmount = calculateMonthlyInstallment(
        selectedAmount,
        installmentInterestRate,
        installmentTenure,
      );
      form.setValue("installment.monthlyAmount", monthlyAmount, {
        shouldValidate: false,
      });
    }
  }, [
    paymentMethod,
    selectedAmount,
    installmentTenure,
    installmentInterestRate,
    form,
  ]);

  // Clear installment data when switching to full payment or non-liability account
  useEffect(() => {
    if (paymentMethod === "full" || !isLiabilityAccount) {
      form.setValue("installment", undefined);
    } else if (paymentMethod === "installment") {
      // Always ensure installment has all required fields
      const currentInstallment = form.getValues("installment");
      const tenure = currentInstallment?.tenure ?? 3;
      const interestRate = currentInstallment?.interestRate ?? 0;
      const amount = selectedAmount || 0;
      const monthlyAmount = calculateMonthlyInstallment(
        amount,
        interestRate,
        tenure,
      );

      form.setValue("installment", {
        tenure,
        interestRate,
        monthlyAmount,
      });
    }
  }, [paymentMethod, isLiabilityAccount, form, selectedAmount]);

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      form.reset();
      setPaymentMethod("full");
    }
    setOpen(newOpen);
  };

  const { mutate, isPending } = useMutation({
    ...transactionMutationOptions(),
    onSuccess: () => {
      toast.success(
        initialData?.id ? "Transaction updated" : "Transaction created",
      );
      form.reset();
      setPaymentMethod("full");
      setOpen(false);
      onSuccess?.();
    },
    onError: (err) => {
      toast.error("Failed to save transaction", {
        description: err.message,
      });
    },
  });

  const { mutate: uploadFile } = useMutation({
    ...uploadFileMutationOptions(),
    onSuccess: (storageFileMetadata, file) => {
      // Convert storage FileMetadata to hook FileMetadata format
      const fileMetadata = {
        name: file.name, // Use original file name, not the storage name
        size: file.size,
        type: file.type,
        url: storageFileMetadata.url,
        id: storageFileMetadata.id,
      };

      // Remove from uploading set
      const fileKey = `${file.name}-${file.size}`;
      uploadingFilesRef.current.delete(fileKey);

      // Update the uploaded files by replacing the temporary file with the uploaded one
      setUploadedFiles((prev) =>
        prev.map((fileWithPreview) => {
          // If this is a temporary file (File instance), replace it with the uploaded metadata
          if (
            fileWithPreview.file instanceof File &&
            fileWithPreview.file.name === file.name &&
            fileWithPreview.file.size === file.size
          ) {
            return {
              file: fileMetadata,
              id: fileMetadata.id,
              preview: fileMetadata.url,
            };
          }
          return fileWithPreview;
        }),
      );
    },
    onError: (err, file) => {
      // Remove from uploading set on error
      const fileKey = `${file.name}-${file.size}`;
      uploadingFilesRef.current.delete(fileKey);

      toast.error("Failed to upload file", {
        description: err.message,
      });
    },
  });

  const onSubmit = async () => {
    const fileIds = uploadedFiles
      .filter((f) => !(f.file instanceof File))
      .map((f) => f.id);

    // Update form field with file IDs
    form.setValue("files", fileIds);

    const values = form.getValues();
    const payload: Record<string, unknown> = {
      id: initialData?.id,
      amount: values.amount,
      date: values.date,
      type: values.type,
      currency: values.currency,
      notes: values.notes,
      files: fileIds,
      account_id: values.account_id,
      budget_item_id: values.budget_item_id,
    };

    if (paymentMethod === "installment" && values.installment) {
      const tenure = values.installment.tenure ?? 3;
      const interestRate = values.installment.interestRate ?? 0;
      const transactionAmount = values.amount || 0;

      const monthlyAmount =
        values.installment.monthlyAmount && values.installment.monthlyAmount > 0
          ? values.installment.monthlyAmount
          : calculateMonthlyInstallment(
              transactionAmount,
              interestRate,
              tenure,
            );

      payload.installment = {
        tenure,
        interest_rate: interestRate,
        monthly_amount: monthlyAmount,
      };
    }

    mutate(payload as Transaction);
  };

  const accounts = accountsData?.accounts || [];
  const budgetItems = budgetData?.items || [];

  const formatBalance = (balance: number, currency: string) => {
    const formatter = new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    });
    return formatter.format(balance);
  };

  let submitLabel = "Add Transaction";
  if (initialData?.id) {
    submitLabel = "Update Transaction";
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

  // Calculate installment breakdown for display
  const installmentBreakdown =
    paymentMethod === "installment" &&
    selectedAmount > 0 &&
    installmentTenure &&
    installmentInterestRate !== undefined
      ? formatInstallmentBreakdown(
          selectedAmount,
          installmentInterestRate,
          installmentTenure,
          selectedCurrency,
        )
      : null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange} modal={false}>
      {trigger ? (
        <DialogTrigger render={trigger} nativeButton={nativeButton} />
      ) : externalOpen === undefined ? (
        <DialogTrigger
          render={
            <Button className="ml-auto" size="sm">
              <IconPlus
                className="-ms-1 opacity-60"
                size={16}
                aria-hidden="true"
              />
              Add Transaction
            </Button>
          }
        />
      ) : undefined}
      <DialogContent className="!max-w-2xl !w-full max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {initialData?.id ? "Edit Transaction" : "Add New Transaction"}
          </DialogTitle>
          <DialogDescription>
            {initialData?.id
              ? "Edit your transaction details below."
              : "Add a new transaction to your account."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* File Upload Section - Top */}
          <Controller
            control={form.control}
            name="files"
            render={({ fieldState }) => {
              return (
                <Field>
                  <FieldLabel>Attachments (Optional)</FieldLabel>
                  <FileUpload
                    maxFiles={5}
                    maxSizeMB={5}
                    value={uploadedFiles}
                    onChange={(files) => {
                      setUploadedFiles(files);
                      // Update form field with file IDs
                      const fileIds = files
                        .filter((f) => !(f.file instanceof File))
                        .map((f) => f.id);
                      form.setValue("files", fileIds);
                    }}
                    onFilesAdded={(files) => {
                      // Upload files immediately, but check for duplicates first
                      files.forEach((fileWithPreview) => {
                        if (fileWithPreview.file instanceof File) {
                          const fileKey = `${fileWithPreview.file.name}-${fileWithPreview.file.size}`;

                          // Only upload if not already uploading
                          if (!uploadingFilesRef.current.has(fileKey)) {
                            uploadingFilesRef.current.add(fileKey);
                            uploadFile(fileWithPreview.file);
                          }
                        }
                      });
                    }}
                  />
                  <FieldDescription>
                    Upload receipts, invoices, or other documents related to
                    this transaction.
                  </FieldDescription>
                  {fieldState.invalid && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </Field>
              );
            }}
          />

          {/* Form Fields in 2-column Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Controller
              control={form.control}
              name="amount"
              render={({ field, fieldState }) => (
                <Field>
                  <FieldLabel>Amount</FieldLabel>
                  <InputGroup>
                    <NumericFormat
                      customInput={InputGroupInput}
                      thousandSeparator="."
                      decimalSeparator=","
                      decimalScale={2}
                      fixedDecimalScale
                      allowNegative={false}
                      prefix={getCurrencyPrefix(selectedCurrency)}
                      placeholder={getCurrencyPlaceholder(selectedCurrency)}
                      value={field.value || ""}
                      onValueChange={(values) => {
                        field.onChange(values.floatValue ?? 0);
                      }}
                      onBlur={field.onBlur}
                      name={field.name}
                      getInputRef={field.ref}
                    />
                  </InputGroup>
                  {fieldState.invalid && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </Field>
              )}
            />

            <Controller
              control={form.control}
              name="date"
              render={({ field, fieldState }) => (
                <Field>
                  <FieldLabel>Date</FieldLabel>
                  <Popover open={dateOpen} onOpenChange={setDateOpen}>
                    <PopoverTrigger
                      render={
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !field.value && "text-muted-foreground",
                          )}
                        >
                          <IconCalendar className="mr-2 h-4 w-4" />
                          {field.value ? (
                            format(field.value, "PPP")
                          ) : (
                            <span>Pick a date</span>
                          )}
                        </Button>
                      }
                    />
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value}
                        onSelect={(date) => {
                          field.onChange(date);
                          setDateOpen(false);
                        }}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
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
                  <FieldLabel>Transaction Type</FieldLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select transaction type" />
                    </SelectTrigger>
                    <SelectContent>
                      {(transactionTypes ?? []).map((type) => (
                        <SelectItem key={type} value={type}>
                          {type.toUpperCase().replace("_", " ")}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
                  <Select value={field.value} onValueChange={field.onChange}>
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
                  {fieldState.invalid && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </Field>
              )}
            />

            <Controller
              control={form.control}
              name="account_id"
              render={({ field, fieldState }) => {
                const selectedAccount =
                  accounts.find((a) => a.id === field.value) ?? null;
                return (
                  <Field>
                    <FieldLabel>Account</FieldLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger className="w-full">
                        {selectedAccount ? (
                          <span className="flex flex-1 truncate text-left text-sm">
                            {selectedAccount.name} —{" "}
                            {formatBalance(
                              selectedAccount.balance || 0,
                              selectedAccount.currency,
                            )}
                          </span>
                        ) : (
                          <SelectValue placeholder="Select account" />
                        )}
                      </SelectTrigger>
                      <SelectContent>
                        {accounts.map((account) => (
                          <SelectItem key={account.id} value={account.id || ""}>
                            {account.name} —{" "}
                            {formatBalance(
                              account.balance || 0,
                              account.currency,
                            )}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {fieldState.invalid && (
                      <FieldError errors={[fieldState.error]} />
                    )}
                  </Field>
                );
              }}
            />

            <Controller
              control={form.control}
              name="budget_item_id"
              render={({ field, fieldState }) => {
                const selectedItem =
                  budgetItems.find((item) => item.id === field.value) ?? null;
                return (
                  <Field>
                    <FieldLabel>Category (Optional)</FieldLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger className="w-full">
                        {selectedItem ? (
                          <span className="flex flex-1 truncate text-left text-sm">
                            {selectedItem.category} —{" "}
                            {formatBalance(
                              (selectedItem.allocation || 0) -
                                (selectedItem.spent || 0),
                              budgetData?.currency || "IDR",
                            )}{" "}
                            remaining
                          </span>
                        ) : (
                          <SelectValue placeholder="Select category" />
                        )}
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No category</SelectItem>
                        {budgetItems.map((item) => {
                          const remaining =
                            (item.allocation || 0) - (item.spent || 0);
                          return (
                            <SelectItem key={item.id} value={item.id || ""}>
                              {item.category} —{" "}
                              <span
                                className={
                                  remaining < 0 ? "text-destructive" : ""
                                }
                              >
                                {formatBalance(
                                  remaining,
                                  budgetData?.currency || "IDR",
                                )}
                              </span>{" "}
                              remaining
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                    <FieldDescription>
                      Link this transaction to a budget category.
                    </FieldDescription>
                    {fieldState.invalid && (
                      <FieldError errors={[fieldState.error]} />
                    )}
                  </Field>
                );
              }}
            />
          </div>

          {/* Payment Method Section - Only for liability accounts */}
          {isLiabilityAccount && (
            <div className="space-y-4 rounded-lg border bg-muted/30 p-4">
              <FieldLabel>Payment Method</FieldLabel>
              <div className="grid grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => setPaymentMethod("full")}
                  className={cn(
                    "flex items-center gap-3 rounded-lg border p-4 transition-all text-left",
                    paymentMethod === "full"
                      ? "border-primary bg-primary/5"
                      : "border-border bg-card hover:bg-muted",
                  )}
                >
                  <div
                    className={cn(
                      "flex h-10 w-10 items-center justify-center rounded-full",
                      paymentMethod === "full"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted",
                    )}
                  >
                    <IconCreditCard size={20} />
                  </div>
                  <div>
                    <div className="font-medium">Full Payment</div>
                    <div className="text-xs text-muted-foreground">
                      Pay immediately
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMethod("installment")}
                  className={cn(
                    "flex items-center gap-3 rounded-lg border p-4 transition-all text-left",
                    paymentMethod === "installment"
                      ? "border-primary bg-primary/5"
                      : "border-border bg-card hover:bg-muted",
                  )}
                >
                  <div
                    className={cn(
                      "flex h-10 w-10 items-center justify-center rounded-full",
                      paymentMethod === "installment"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted",
                    )}
                  >
                    <IconClock size={20} />
                  </div>
                  <div>
                    <div className="font-medium">Installment</div>
                    <div className="text-xs text-muted-foreground">
                      Spread over months
                    </div>
                  </div>
                </button>
              </div>

              {/* Installment Fields */}
              {paymentMethod === "installment" && (
                <div className="mt-4 space-y-4 border-t pt-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Controller
                      control={form.control}
                      name="installment.tenure"
                      render={({ field, fieldState }) => (
                        <Field>
                          <FieldLabel>Tenure</FieldLabel>
                          <Select
                            value={field.value?.toString() ?? ""}
                            onValueChange={(v) =>
                              field.onChange(parseInt(v ?? "3", 10))
                            }
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select months" />
                            </SelectTrigger>
                            <SelectContent>
                              {TENURE_OPTIONS.map((option) => (
                                <SelectItem
                                  key={option.value}
                                  value={option.value.toString()}
                                >
                                  {option.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {fieldState.invalid && (
                            <FieldError errors={[fieldState.error]} />
                          )}
                        </Field>
                      )}
                    />

                    <Controller
                      control={form.control}
                      name="installment.interestRate"
                      render={({ field, fieldState }) => (
                        <Field>
                          <FieldLabel>Interest Rate (% p.a.)</FieldLabel>
                          <InputGroup>
                            <NumericFormat
                              customInput={InputGroupInput}
                              decimalScale={2}
                              fixedDecimalScale
                              allowNegative={false}
                              suffix="%"
                              placeholder="0.00%"
                              value={field.value ?? 0}
                              onValueChange={(values) => {
                                field.onChange(values.floatValue ?? 0);
                              }}
                              onBlur={field.onBlur}
                              name={field.name}
                              getInputRef={field.ref}
                            />
                          </InputGroup>
                          {fieldState.invalid && (
                            <FieldError errors={[fieldState.error]} />
                          )}
                        </Field>
                      )}
                    />

                    <Field>
                      <FieldLabel>Monthly Amount</FieldLabel>
                      <InputGroup>
                        <InputGroupInput
                          value={
                            installmentBreakdown?.formatted.monthlyAmount ?? "-"
                          }
                          readOnly
                          className="bg-muted"
                        />
                      </InputGroup>
                      <FieldDescription>Auto-calculated</FieldDescription>
                    </Field>
                  </div>

                  {/* Installment Breakdown */}
                  {installmentBreakdown && (
                    <div className="rounded-lg bg-muted p-4 space-y-2">
                      <div className="text-sm font-medium">
                        Installment Breakdown
                      </div>
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <div className="text-muted-foreground">Principal</div>
                          <div className="font-medium">
                            {installmentBreakdown.formatted.principal}
                          </div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">Interest</div>
                          <div className="font-medium">
                            {installmentBreakdown.formatted.interest}
                            {(installmentInterestRate ?? 0) > 0 && (
                              <span className="text-xs text-muted-foreground ml-1">
                                ({installmentInterestRate}% p.a.)
                              </span>
                            )}
                          </div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">Total</div>
                          <div className="font-medium">
                            {installmentBreakdown.formatted.total}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
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
                    placeholder="Add any additional notes about this transaction..."
                  />
                </InputGroup>
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
                  className="mr-2 animate-spin"
                  size={16}
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

// Helper functions for file operations
const getFile = async (id: string): Promise<StorageFileMetadata> => {
  return storageApi.get<StorageFileMetadata>(`/${id}`);
};
