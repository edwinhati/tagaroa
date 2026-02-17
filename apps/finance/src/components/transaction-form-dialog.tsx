"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { FileUpload } from "@repo/common/components/file-upload";
import { useBudgetPeriod } from "@repo/common/hooks/use-budget-period";
import type { FileWithPreview } from "@repo/common/hooks/use-file-upload";
import { storageApi } from "@repo/common/lib/http";
import { accountQueryOptions } from "@repo/common/lib/query/account-query";
import { budgetQueryOptions } from "@repo/common/lib/query/budget-query";
import type { FileMetadata as StorageFileMetadata } from "@repo/common/lib/query/storage-query";
import { uploadFileMutationOptions } from "@repo/common/lib/query/storage-query";
import {
  transactionMutationOptions,
  transactionTypesQueryOptions,
} from "@repo/common/lib/query/transaction-query";
import {
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
import { useMutation, useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { CalendarIcon, Loader2, PlusIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { NumericFormat } from "react-number-format";
import { toast } from "sonner";

const currencies = [
  { value: "IDR", label: "Indonesian Rupiah (IDR)" },
  { value: "USD", label: "US Dollar (USD)" },
  { value: "SGD", label: "Singapore Dollar (SGD)" },
];

type TransactionFormDialogProps = Readonly<{
  initialData?: Partial<Transaction>;
  trigger?: React.ReactElement;
  onSuccess?: () => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}>;

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
  };
}

export function TransactionFormDialog({
  initialData,
  trigger,
  onSuccess,
  open: externalOpen,
  onOpenChange: externalOnOpenChange,
}: TransactionFormDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [dateOpen, setDateOpen] = useState(false);

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

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      form.reset();
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

    mutate({
      id: initialData?.id,
      amount: form.getValues("amount"),
      date: form.getValues("date"),
      type: form.getValues("type"),
      currency: form.getValues("currency"),
      notes: form.getValues("notes"),
      files: fileIds,
      account_id: form.getValues("account_id"),
      budget_item_id: form.getValues("budget_item_id"),
    });
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

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {trigger ??
          (externalOpen === undefined && (
            <Button className="ml-auto" size="sm">
              <PlusIcon
                className="-ms-1 opacity-60"
                size={16}
                aria-hidden="true"
              />
              Add transaction
            </Button>
          ))}
      </DialogTrigger>
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
                    Enter the transaction amount in the selected currency.
                  </FieldDescription>
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
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !field.value && "text-muted-foreground",
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {field.value ? (
                          format(field.value, "PPP")
                        ) : (
                          <span>Pick a date</span>
                        )}
                      </Button>
                    </PopoverTrigger>
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
                  <FieldDescription>
                    Select the date when this transaction occurred.
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
                  <FieldLabel>Transaction Type</FieldLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
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
                  <FieldDescription>
                    Choose whether this is an income or expense transaction.
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
                    Choose the currency for this transaction.
                  </FieldDescription>
                  {fieldState.invalid && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </Field>
              )}
            />

            <Controller
              control={form.control}
              name="account_id"
              render={({ field, fieldState }) => (
                <Field>
                  <FieldLabel>Account</FieldLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select account" />
                    </SelectTrigger>
                    <SelectContent>
                      {accounts.map((account) => (
                        <SelectItem key={account.id} value={account.id || ""}>
                          {account.name} -{" "}
                          {formatBalance(
                            account.balance || 0,
                            account.currency,
                          )}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FieldDescription>
                    Select the account for this transaction.
                  </FieldDescription>
                  {fieldState.invalid && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </Field>
              )}
            />

            <Controller
              control={form.control}
              name="budget_item_id"
              render={({ field, fieldState }) => (
                <Field>
                  <FieldLabel>Category (Optional)</FieldLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No category</SelectItem>
                      {budgetItems.map((item) => {
                        const remaining =
                          (item.allocation || 0) - (item.spent || 0);
                        return (
                          <SelectItem key={item.id} value={item.id || ""}>
                            {item.category} -{" "}
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
              )}
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
                    placeholder="Add any additional notes about this transaction..."
                  />
                </InputGroup>
                <FieldDescription>
                  Add any notes or details to describe this transaction
                  (optional).
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
                <Loader2
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
