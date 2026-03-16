"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { currencies } from "@repo/common/lib/currencies";
import {
  assetMutationOptions,
  assetTypesQueryOptions,
} from "@repo/common/lib/query/asset-query";
import { type Asset, assetSchema } from "@repo/common/types/asset";
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
import { cn } from "@repo/ui/lib/utils";
import { IconLoader2, IconPlus } from "@tabler/icons-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { NumericFormat } from "react-number-format";
import { toast } from "sonner";

type AssetFormDialogProps = Readonly<{
  initialData?: Asset;
  trigger?: React.ReactElement;
}>;

export function AssetFormDialog({
  initialData,
  trigger,
}: AssetFormDialogProps) {
  const [open, setOpen] = useState(false);

  const form = useForm<Asset>({
    resolver: zodResolver(assetSchema),
    defaultValues: initialData
      ? {
          id: initialData.id,
          name: initialData.name,
          type: initialData.type,
          value: initialData.value,
          shares: initialData.shares ?? null,
          ticker: initialData.ticker ?? null,
          currency: initialData.currency,
          notes: initialData.notes ?? "",
        }
      : {
          name: "",
          type: "CRYPTO",
          value: 0,
          shares: null,
          ticker: null,
          currency: "IDR",
          notes: "",
        },
  });

  const selectedCurrency = useWatch({
    control: form.control,
    name: "currency",
  });
  const selectedType = useWatch({ control: form.control, name: "type" });

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      form.reset();
    }
    setOpen(newOpen);
  };

  const { mutate, isPending } = useMutation({
    ...assetMutationOptions(),
    onSuccess: () => {
      toast.success(initialData ? "Asset updated" : "Asset created");
      form.reset();
      setOpen(false);
    },
    onError: (err) => {
      toast.error("Failed to save asset", {
        description: err.message,
      });
    },
  });

  const onSubmit = async () => {
    mutate({
      id: initialData?.id,
      name: form.getValues("name"),
      type: form.getValues("type"),
      value: form.getValues("value"),
      shares: form.getValues("shares"),
      ticker: form.getValues("ticker"),
      currency: form.getValues("currency"),
      notes: form.getValues("notes"),
    });
  };

  const { data: assetTypes } = useQuery(assetTypesQueryOptions());

  const showStockFields = selectedType === "STOCK" || selectedType === "CRYPTO";

  let submitLabel = "Add Asset";
  if (initialData) {
    submitLabel = "Update Asset";
  }
  if (isPending) {
    submitLabel = "Saving...";
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
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
              Add asset
            </Button>
          )
        }
      />
      <DialogContent className="!max-w-2xl !w-full max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {initialData ? "Edit Asset" : "Add New Asset"}
          </DialogTitle>
          <DialogDescription>
            {initialData
              ? "Edit your asset details below."
              : "Add a new asset to track your net worth."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Controller
              control={form.control}
              name="name"
              render={({ field, fieldState }) => (
                <Field>
                  <FieldLabel>Asset Name</FieldLabel>
                  <InputGroup>
                    <InputGroupInput
                      {...field}
                      type="text"
                      placeholder="e.g., Apple Stock, BTC"
                      autoFocus
                    />
                  </InputGroup>
                  <FieldDescription>
                    Use a name that helps you easily recognize this asset.
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
                  <FieldLabel>Asset Type</FieldLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value ?? ""}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select asset type" />
                    </SelectTrigger>
                    <SelectContent>
                      {(assetTypes ?? []).map((type) => (
                        <SelectItem key={type} value={type}>
                          {type.replace(/_/g, " ")}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FieldDescription>
                    Specify the type of asset, such as investment, crypto, or
                    property.
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
                    value={field.value ?? ""}
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
                    Choose the currency in which this asset is valued.
                  </FieldDescription>
                  {fieldState.invalid && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </Field>
              )}
            />

            <Controller
              control={form.control}
              name="value"
              render={({ field, fieldState }) => (
                <Field>
                  <FieldLabel>Current Value</FieldLabel>
                  <InputGroup>
                    <NumericFormat
                      customInput={InputGroupInput}
                      thousandSeparator={selectedCurrency === "IDR" ? "." : ","}
                      decimalSeparator={selectedCurrency === "IDR" ? "," : "."}
                      prefix={selectedCurrency === "IDR" ? "Rp " : "$ "}
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
                    Enter the current market value of this asset.
                  </FieldDescription>
                  {fieldState.invalid && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </Field>
              )}
            />
          </div>

          <div
            className={cn(
              "transition-all duration-300 ease-out overflow-hidden",
              showStockFields
                ? "grid grid-cols-1 md:grid-cols-2 gap-6 max-h-96 opacity-100 mb-6"
                : "max-h-0 opacity-0 mb-0",
            )}
          >
            <Controller
              control={form.control}
              name="ticker"
              render={({ field, fieldState }) => (
                <Field>
                  <FieldLabel>Ticker Symbol</FieldLabel>
                  <InputGroup>
                    <InputGroupInput
                      {...field}
                      type="text"
                      placeholder="e.g., AAPL, BTC"
                      value={field.value ?? ""}
                      className={cn(
                        fieldState.invalid &&
                          "border-destructive focus-visible:ring-destructive",
                      )}
                      aria-invalid={fieldState.invalid}
                    />
                  </InputGroup>
                  <FieldDescription>
                    The stock ticker or cryptocurrency symbol.
                  </FieldDescription>
                  {fieldState.invalid && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </Field>
              )}
            />

            <Controller
              control={form.control}
              name="shares"
              render={({ field, fieldState }) => (
                <Field>
                  <FieldLabel>Number of Shares</FieldLabel>
                  <InputGroup>
                    <NumericFormat
                      customInput={InputGroupInput}
                      decimalScale={6}
                      value={field.value ?? ""}
                      onValueChange={(values) => {
                        field.onChange(values.floatValue ?? null);
                      }}
                      onBlur={field.onBlur}
                      name={field.name}
                      getInputRef={field.ref}
                      placeholder="0.000000"
                    />
                  </InputGroup>
                  <FieldDescription>
                    The quantity of shares or units held.
                  </FieldDescription>
                  {fieldState.invalid && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </Field>
              )}
            />
          </div>

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
                    placeholder="Add any additional notes about this asset..."
                    value={field.value ?? ""}
                  />
                </InputGroup>
                <FieldDescription>
                  Add any notes or details to describe this asset (optional).
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
            <Button
              type="submit"
              disabled={isPending}
              aria-busy={isPending}
              className="flex-1"
            >
              {isPending && (
                <IconLoader2
                  className="animate-spin mr-2 h-4 w-4"
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
