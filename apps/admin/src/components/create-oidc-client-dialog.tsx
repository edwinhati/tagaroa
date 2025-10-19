"use client";

import React, { useState, useRef, useMemo, useEffect } from "react";
import {
  useForm,
  Controller,
  useFieldArray,
  Control,
  FieldPath,
  FieldValues,
} from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { PlusIcon, LoaderIcon, TrashIcon, Check } from "lucide-react";

import { Button } from "@repo/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import { Badge } from "@repo/ui/components/badge";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@repo/ui/components/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@repo/ui/components/popover";
import { ScrollArea } from "@repo/ui/components/scroll-area";

import { toast } from "sonner";

import { authClient } from "@repo/common/lib/auth-client";

// Helper functions to reduce duplication
const getStoredClients = () => {
  return JSON.parse(localStorage.getItem("oidc-clients") || "[]");
};

const saveClients = (clients: unknown[]) => {
  localStorage.setItem("oidc-clients", JSON.stringify(clients));
};

const validateRedirectUrls = (redirectURLs: { url: string }[]) => {
  const redirectUris = redirectURLs
    .map((item) => item.url.trim())
    .filter((uri) => uri.length > 0);

  if (redirectUris.length === 0) {
    toast.error("At least one redirect URL is required.");
    return null;
  }
  return redirectUris;
};

const validateMetadata = (metadataString?: string) => {
  if (!metadataString) return undefined;

  try {
    return JSON.parse(metadataString);
  } catch {
    toast.error("Metadata must be valid JSON.");
    return null;
  }
};

const handleAsyncOperation = async (
  operation: () => Promise<void>,
  setLoading: (loading: boolean) => void
) => {
  try {
    setLoading(true);
    await operation();
  } catch (error) {
    console.error("Operation failed:", error);
    toast.error(
      error instanceof Error ? error.message : "An unexpected error occurred."
    );
  } finally {
    setLoading(false);
  }
};

// Reusable form field component to reduce duplication
const FormField = <T extends FieldValues>({
  control,
  name,
  label,
  description,
  required = false,
  children,
}: {
  control: Control<T>;
  name: FieldPath<T>;
  label: string;
  description?: string;
  required?: boolean;
  children: (field: any, fieldState: unknown) => React.ReactNode;
}) => (
  <Controller
    control={control}
    name={name}
    render={({ field, fieldState }) => (
      <Field>
        <FieldLabel>
          {label} {required && "*"}
        </FieldLabel>
        {children(field, fieldState)}
        {description && <FieldDescription>{description}</FieldDescription>}
        {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
      </Field>
    )}
  />
);

// Common OAuth 2.0 / OIDC scopes
const COMMON_SCOPES = [
  {
    value: "openid",
    label: "openid",
    description: "Required for OIDC authentication",
  },
  {
    value: "profile",
    label: "profile",
    description: "Access to user profile information",
  },
  {
    value: "email",
    label: "email",
    description: "Access to user email address",
  },
  {
    value: "offline_access",
    label: "offline_access",
    description: "Access to refresh tokens",
  },
  {
    value: "phone",
    label: "phone",
    description: "Access to user phone number",
  },
  {
    value: "address",
    label: "address",
    description: "Access to user address information",
  },
  { value: "read", label: "read", description: "Read access to resources" },
  { value: "write", label: "write", description: "Write access to resources" },
  { value: "admin", label: "admin", description: "Administrative access" },
];

interface ScopeComboboxProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function ScopeCombobox({
  value,
  onChange,
  placeholder,
}: ScopeComboboxProps) {
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [triggerWidth, setTriggerWidth] = useState<number | undefined>();
  const triggerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Normalize current scopes (dedupe + trim + collapse whitespace)
  const currentScopes = useMemo(() => {
    const parts = value.split(/\s+/).filter(Boolean);
    return Array.from(new Set(parts)); // dedupe
  }, [value]);

  // Keep the external value normalized
  useEffect(() => {
    const normalized = currentScopes.join(" ");
    if (normalized !== value) onChange(normalized);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentScopes.join(" ")]);

  // Track trigger width and update reactively
  useEffect(() => {
    if (!triggerRef.current) return;
    const el = triggerRef.current;
    const update = () => setTriggerWidth(el.offsetWidth);
    update();

    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Focus the input whenever the popover opens
  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const setScopes = (scopes: string[]) => {
    const normalized = Array.from(new Set(scopes.filter(Boolean))).join(" ");
    onChange(normalized);
  };

  const handleScopeToggle = (scope: string) => {
    const scopes = currentScopes.includes(scope)
      ? currentScopes.filter((s) => s !== scope)
      : [...currentScopes, scope];

    setScopes(scopes);
    setInputValue(""); // clear filter
    // keep popover open for multi-select UX
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInputValue(newValue);
    if (!open) setOpen(true);
  };

  const handleInputFocus = () => setOpen(true);

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const trimmed = inputValue.trim();
      if (!trimmed) return;

      // If the typed value exactly matches a known scope, toggle that item
      const known = COMMON_SCOPES.find(
        (s) => s.value === trimmed || s.label === trimmed
      );
      if (known) {
        handleScopeToggle(known.value);
        return;
      }

      // Otherwise add as a custom scope (only on Enter, not Space)
      if (!currentScopes.includes(trimmed)) {
        setScopes([...currentScopes, trimmed]);
      }
      setInputValue("");
      return;
    }

    // Backspace on empty input removes the last scope
    if (
      e.key === "Backspace" &&
      inputValue === "" &&
      currentScopes.length > 0
    ) {
      e.preventDefault();
      setScopes(currentScopes.slice(0, -1));
      return;
    }

    // Escape closes the popover
    if (e.key === "Escape") {
      setOpen(false);
      return;
    }

    // Prevent SPACE from creating accidental custom scopes
    if (e.key === " " && inputValue.trim().length === 0) {
      // allow space in the middle of typing, but don't "submit" on space
      return;
    }
  };

  const handleRemoveScope = (scopeToRemove: string) => {
    setScopes(currentScopes.filter((s) => s !== scopeToRemove));
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const filteredScopes = useMemo(() => {
    const q = inputValue.toLowerCase().trim();
    if (!q) return COMMON_SCOPES;
    return COMMON_SCOPES.filter(
      (s) =>
        s.label.toLowerCase().includes(q) ||
        s.value.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q)
    );
  }, [inputValue]);

  return (
    <div className="space-y-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <div
            ref={triggerRef}
            className="flex min-h-10 w-full flex-wrap items-center gap-1 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 cursor-text"
            onClick={() => inputRef.current?.focus()}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                inputRef.current?.focus();
              }
            }}
            tabIndex={0}
            role="button"
            aria-label="Focus scope input"
          >
            <div className="flex flex-wrap items-center gap-1 w-full">
              {currentScopes.map((scope) => (
                <Badge
                  key={scope}
                  variant="secondary"
                  className="cursor-pointer hover:bg-secondary/80"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemoveScope(scope);
                  }}
                >
                  {scope}
                  <span className="ml-1 text-xs">×</span>
                </Badge>
              ))}
              <input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={handleInputChange}
                onFocus={handleInputFocus}
                onKeyDown={handleInputKeyDown}
                placeholder={
                  currentScopes.length === 0
                    ? (placeholder ?? "Search or add scopes…")
                    : ""
                }
                className="flex-1 bg-transparent outline-none placeholder:text-muted-foreground min-w-[120px]"
                // Prevent popover from toggling due to bubbling clicks
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          </div>
        </PopoverTrigger>

        <PopoverContent
          className="p-0"
          align="start"
          sideOffset={4}
          style={{ width: triggerWidth ? `${triggerWidth}px` : "auto" }}
        >
          <Command>
            <CommandList>
              <CommandEmpty>
                {inputValue ? (
                  <div className="p-2 text-center">
                    <p className="text-sm text-muted-foreground">
                      No matching scopes found.
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Press Enter to add “{inputValue}” as a custom scope.
                    </p>
                  </div>
                ) : (
                  "No scopes found."
                )}
              </CommandEmpty>

              <CommandGroup>
                <ScrollArea className="h-[200px] p-1">
                  {filteredScopes.map((scope) => {
                    const selected = currentScopes.includes(scope.value);
                    return (
                      <CommandItem
                        key={scope.value}
                        value={scope.value}
                        onSelect={() => handleScopeToggle(scope.value)}
                        className="cursor-pointer"
                      >
                        <Check
                          className={`mr-2 h-4 w-4 ${selected ? "opacity-100" : "opacity-0"}`}
                        />
                        <div className="flex flex-col">
                          <span className="font-medium">{scope.label}</span>
                          <span className="text-sm text-muted-foreground">
                            {scope.description}
                          </span>
                        </div>
                      </CommandItem>
                    );
                  })}
                </ScrollArea>
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}

const createClientSchema = z.object({
  client_name: z.string().min(1, "Client name is required"),
  client_uri: z.string().optional(),
  logo_uri: z.string().optional(),
  redirectURLs: z
    .array(
      z.object({
        url: z.string().min(1, "URL is required"),
      })
    )
    .min(1, "At least one redirect URL is required"),
  token_endpoint_auth_method: z.enum([
    "none",
    "client_secret_post",
    "client_secret_basic",
  ]),
  grant_types: z.array(z.string()),
  response_types: z.array(z.string()),
  scope: z.string().optional(),
  metadata: z.string().optional(),
});

type CreateClientFormData = z.infer<typeof createClientSchema>;

interface CreateOIDCClientDialogProps {
  onClientCreated: () => void;
}

export function CreateOIDCClientDialog({
  onClientCreated,
}: CreateOIDCClientDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const form = useForm({
    resolver: zodResolver(createClientSchema),
    defaultValues: {
      client_name: "",
      client_uri: "",
      logo_uri: "",
      redirectURLs: [{ url: "" }],
      token_endpoint_auth_method: "client_secret_basic" as const,
      grant_types: ["authorization_code"],
      response_types: ["code"],
      scope: "openid profile email",
      metadata: "",
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "redirectURLs",
  });

  const onSubmit = async (data: CreateClientFormData) => {
    await handleAsyncOperation(async () => {
      // Validate redirect URLs
      const redirectUris = validateRedirectUrls(data.redirectURLs);
      if (!redirectUris) return;

      // Validate metadata
      const metadata = validateMetadata(data.metadata);
      if (data.metadata && metadata === null) return;

      // Call the Better Auth OIDC register endpoint
      const response = await authClient.oauth2.register({
        client_name: data.client_name,
        client_uri: data.client_uri || undefined,
        logo_uri: data.logo_uri || undefined,
        redirect_uris: redirectUris,
        token_endpoint_auth_method: data.token_endpoint_auth_method,
        grant_types: data.grant_types,
        response_types: data.response_types,
        scope: data.scope || undefined,
        metadata,
      });

      if (response.error) {
        throw new Error(
          response.error.message || "Failed to create OIDC client"
        );
      }

      // Save to localStorage for demo purposes
      const newClient = {
        id: crypto.randomUUID(),
        name: data.client_name,
        clientId: response.data?.client_id || `client_${Date.now()}`,
        clientSecret: response.data?.client_secret,
        redirectURLs: redirectUris,
        type: data.token_endpoint_auth_method === "none" ? "public" : "web",
        disabled: false,
        icon: data.logo_uri || undefined,
        metadata: metadata || undefined,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const existingClients = getStoredClients();
      existingClients.push(newClient);
      saveClients(existingClients);

      toast.success(
        `Client "${data.client_name}" has been created successfully.`
      );

      form.reset();
      setOpen(false);
      onClientCreated();
    }, setLoading);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <PlusIcon className="h-4 w-4" />
          Create Client
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create OIDC Client</DialogTitle>
          <DialogDescription>
            Create a new OAuth 2.0 / OpenID Connect client application.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="client_name"
              label="Client Name"
              description="A human-readable name for the client application."
              required
            >
              {(field) => (
                <InputGroup>
                  <InputGroupInput
                    {...field}
                    type="text"
                    placeholder="My Application"
                  />
                </InputGroup>
              )}
            </FormField>

            <FormField
              control={form.control}
              name="token_endpoint_auth_method"
              label="Authentication Method"
              description="How the client authenticates with the token endpoint."
            >
              {(field) => (
                <Select
                  onValueChange={field.onChange}
                  defaultValue={field.value}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select authentication method" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="client_secret_basic">
                      Client Secret (Basic)
                    </SelectItem>
                    <SelectItem value="client_secret_post">
                      Client Secret (POST)
                    </SelectItem>
                    <SelectItem value="none">None (Public Client)</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </FormField>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="client_uri"
              label="Client URI"
              description="URL of the client application's homepage."
            >
              {(field) => (
                <InputGroup>
                  <InputGroupInput
                    {...field}
                    type="url"
                    placeholder="https://example.com"
                  />
                </InputGroup>
              )}
            </FormField>

            <FormField
              control={form.control}
              name="logo_uri"
              label="Logo URI"
              description="URL of the client application's logo image."
            >
              {(field) => (
                <InputGroup>
                  <InputGroupInput
                    {...field}
                    type="url"
                    placeholder="https://example.com/logo.png"
                  />
                </InputGroup>
              )}
            </FormField>
          </div>

          <Field>
            <FieldLabel>Redirect URLs *</FieldLabel>
            <div className="space-y-3">
              {fields.map((field, index) => (
                <div key={field.id} className="flex gap-2">
                  <Controller
                    control={form.control}
                    name={`redirectURLs.${index}.url`}
                    render={({ field: urlField, fieldState }) => (
                      <div className="flex-1">
                        <InputGroup>
                          <InputGroupInput
                            {...urlField}
                            type="url"
                            placeholder="https://example.com/auth/callback"
                          />
                        </InputGroup>
                        {fieldState.invalid && (
                          <FieldError errors={[fieldState.error]} />
                        )}
                      </div>
                    )}
                  />
                  {fields.length > 1 && (
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => remove(index)}
                    >
                      <TrashIcon className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => append({ url: "" })}
              >
                <PlusIcon className="mr-2 h-4 w-4" />
                Add URL
              </Button>
            </div>
            <FieldDescription>
              Valid redirect URLs for this client. Users will be redirected to
              these URLs after authentication.
            </FieldDescription>
          </Field>

          <FormField
            control={form.control}
            name="scope"
            label="Scopes"
            description='OAuth 2.0 scopes for this client. Type custom scopes and press Enter/Space to add them, or use the dropdown to select common ones. "openid" is required for OIDC.'
          >
            {(field) => (
              <ScopeCombobox
                value={field.value || ""}
                onChange={field.onChange}
                placeholder="openid profile email"
              />
            )}
          </FormField>

          <FormField
            control={form.control}
            name="metadata"
            label="Metadata (JSON)"
            description="Optional JSON metadata for the client application."
          >
            {(field) => (
              <InputGroupTextarea
                {...field}
                placeholder='{"description": "My application", "environment": "production"}'
                className="min-h-[80px] font-mono text-sm"
              />
            )}
          </FormField>

          <div className="space-y-2">
            <div className="text-sm font-medium">Grant Types</div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">authorization_code</Badge>
              <Badge variant="outline">refresh_token</Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              Authorization code flow is enabled by default. Refresh tokens are
              available when offline_access scope is requested.
            </p>
          </div>

          <div className="space-y-2">
            <div className="text-sm font-medium">Response Types</div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">code</Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              Only authorization code flow is supported for security reasons.
            </p>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <LoaderIcon className="h-4 w-4 mr-2 animate-spin" />}
              Create Client
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
