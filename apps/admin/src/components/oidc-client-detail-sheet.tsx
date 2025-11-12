"use client";

import { useState } from "react";
import { useForm, Controller, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  EyeIcon,
  EyeOffIcon,
  LoaderIcon,
  TrashIcon,
  EditIcon,
  ExternalLinkIcon,
  PlusIcon,
} from "lucide-react";

import { Button } from "@repo/ui/components/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@repo/ui/components/sheet";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@repo/ui/components/alert-dialog";
import { Badge } from "@repo/ui/components/badge";
import { Switch } from "@repo/ui/components/switch";
import { Separator } from "@repo/ui/components/separator";
import { toast } from "sonner";

import { CopyToClipboard } from "@repo/common/components/copy-to-clipboard";

// OIDC Client type (same as in data table)
interface OIDCClient {
  id: string;
  name: string;
  clientId: string;
  clientSecret?: string;
  redirectURLs: string[];
  type: "web" | "native" | "user-agent-based" | "public";
  disabled: boolean;
  icon?: string;
  metadata?: Record<string, unknown>;
  userId?: string;
  createdAt: Date;
  updatedAt: Date;
}

const updateClientSchema = z.object({
  name: z.string().min(1, "Client name is required"),
  client_uri: z.string().optional(),
  logo_uri: z.string().optional(),
  redirectURLs: z
    .array(
      z.object({
        url: z.string().min(1, "URL is required"),
      }),
    )
    .min(1, "At least one redirect URL is required"),
  disabled: z.boolean(),
  metadata: z.string().optional(),
});

type UpdateClientFormData = z.infer<typeof updateClientSchema>;

type OIDCClientDetailSheetProps = Readonly<{
  client: OIDCClient;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onClientUpdated: () => void;
  onClientDeleted: () => void;
}>;

// Helper functions to reduce duplication
const getStoredClients = (): OIDCClient[] => {
  return JSON.parse(localStorage.getItem("oidc-clients") || "[]");
};

const saveClients = (clients: OIDCClient[]) => {
  localStorage.setItem("oidc-clients", JSON.stringify(clients));
};

const handleAsyncOperation = async (
  operation: () => Promise<void>,
  setLoading: (loading: boolean) => void,
  successMessage?: string,
) => {
  try {
    setLoading(true);
    await operation();
    if (successMessage) {
      toast.success(successMessage);
    }
  } catch (error) {
    console.error("Operation failed:", error);
    toast.error(
      error instanceof Error ? error.message : "An unexpected error occurred.",
    );
  } finally {
    setLoading(false);
  }
};

// Helper component for credential display
const CredentialField = ({
  label,
  value,
  copyLabel,
  showToggle,
  isVisible,
  onToggleVisibility,
}: {
  label: string;
  value: string;
  copyLabel: string;
  showToggle?: boolean;
  isVisible?: boolean;
  onToggleVisibility?: () => void;
}) => (
  <div>
    <p className="text-sm font-medium text-muted-foreground">{label}</p>
    <div className="flex items-center gap-2 mt-1">
      <code className="flex-1 text-sm bg-muted px-3 py-2 rounded border">
        {showToggle && !isVisible ? "••••••••••••••••••••••••••••••••" : value}
      </code>
      {showToggle && (
        <Button size="sm" variant="outline" onClick={onToggleVisibility}>
          {isVisible ? (
            <EyeOffIcon className="h-4 w-4" />
          ) : (
            <EyeIcon className="h-4 w-4" />
          )}
        </Button>
      )}
      {(!showToggle || isVisible) && (
        <CopyToClipboard text={value} label={copyLabel} />
      )}
    </div>
  </div>
);

// Helper component for endpoint display
const EndpointField = ({
  label,
  endpoint,
  showExternalLink = false,
}: {
  label: string;
  endpoint: string;
  showExternalLink?: boolean;
}) => (
  <div>
    <p className="text-sm font-medium text-muted-foreground">{label}</p>
    <div className="flex items-center gap-2 mt-1">
      <code className="flex-1 text-sm bg-muted px-3 py-2 rounded border">
        {endpoint}
      </code>
      <CopyToClipboard text={endpoint} label={label} />
      {showExternalLink && (
        <Button
          size="sm"
          variant="outline"
          onClick={() => window.open(endpoint, "_blank")}
        >
          <ExternalLinkIcon className="h-4 w-4" />
        </Button>
      )}
    </div>
  </div>
);

export function OIDCClientDetailSheet({
  client,
  open,
  onOpenChange,
  onClientUpdated,
  onClientDeleted,
}: OIDCClientDetailSheetProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showSecret, setShowSecret] = useState(false);

  const form = useForm<UpdateClientFormData>({
    resolver: zodResolver(updateClientSchema),
    defaultValues: {
      name: client.name,
      client_uri: "",
      logo_uri: client.icon || "",
      redirectURLs: client.redirectURLs.map((url) => ({ url })),
      disabled: client.disabled,
      metadata: client.metadata ? JSON.stringify(client.metadata, null, 2) : "",
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "redirectURLs",
  });

  const onSubmit = async (data: UpdateClientFormData) => {
    await handleAsyncOperation(
      async () => {
        // Extract redirect URIs from field array
        const redirectUris = data.redirectURLs
          .map((item) => item.url.trim())
          .filter((uri) => uri.length > 0);

        if (redirectUris.length === 0) {
          toast.error("At least one redirect URL is required.");
          return;
        }

        // Parse metadata if provided
        let metadata: Record<string, unknown> | undefined;
        if (data.metadata) {
          try {
            metadata = JSON.parse(data.metadata);
          } catch {
            toast.error("Metadata must be valid JSON.");
            return;
          }
        }

        // Update in localStorage
        const existingClients = getStoredClients();
        const updatedClients = existingClients.map((c: OIDCClient) =>
          c.id === client.id
            ? {
                ...c,
                name: data.name,
                redirectURLs: redirectUris,
                disabled: data.disabled,
                icon: data.logo_uri || undefined,
                metadata: metadata || undefined,
                updatedAt: new Date(),
              }
            : c,
        );
        saveClients(updatedClients);

        setIsEditing(false);
        onClientUpdated();
      },
      setLoading,
      `Client "${data.name}" has been updated successfully.`,
    );
  };

  const handleDelete = async () => {
    await handleAsyncOperation(
      async () => {
        // Delete from localStorage
        const existingClients = getStoredClients();
        const updatedClients = existingClients.filter(
          (c: OIDCClient) => c.id !== client.id,
        );
        saveClients(updatedClients);

        onOpenChange(false);
        onClientDeleted();
      },
      setLoading,
      `Client "${client.name}" has been deleted successfully.`,
    );
  };

  const typeLabels = {
    web: "Web Application",
    native: "Native App",
    "user-agent-based": "Single Page Application",
    public: "Public Client",
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto p-4">
        <SheetHeader>
          <div className="flex items-center justify-between">
            <div>
              <SheetTitle className="flex items-center gap-2">
                {client.name}
                <Badge variant={client.disabled ? "destructive" : "default"}>
                  {client.disabled ? "Disabled" : "Active"}
                </Badge>
              </SheetTitle>
              <SheetDescription>
                {typeLabels[client.type]} • Created{" "}
                {client.createdAt.toLocaleDateString()}
              </SheetDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setIsEditing(!isEditing)}
                disabled={loading}
              >
                <EditIcon className="h-4 w-4 mr-2" />
                {isEditing ? "Cancel" : "Edit"}
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button size="sm" variant="destructive" disabled={loading}>
                    <TrashIcon className="h-4 w-4 mr-2" />
                    Delete
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete OIDC Client</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to delete &quot;{client.name}&quot;?
                      This action cannot be undone and will immediately revoke
                      all access tokens for this client.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleDelete}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Delete Client
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </SheetHeader>

        <div className="space-y-6 mt-6">
          {isEditing ? (
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <Controller
                control={form.control}
                name="name"
                render={({ field, fieldState }) => (
                  <Field>
                    <FieldLabel>Client Name</FieldLabel>
                    <InputGroup>
                      <InputGroupInput {...field} type="text" />
                    </InputGroup>
                    {fieldState.invalid && (
                      <FieldError errors={[fieldState.error]} />
                    )}
                  </Field>
                )}
              />

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
                  Valid redirect URLs for this client. Users will be redirected
                  to these URLs after authentication.
                </FieldDescription>
              </Field>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Controller
                  control={form.control}
                  name="client_uri"
                  render={({ field, fieldState }) => (
                    <Field>
                      <FieldLabel>Client URI</FieldLabel>
                      <InputGroup>
                        <InputGroupInput
                          {...field}
                          type="url"
                          placeholder="https://example.com"
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
                  name="logo_uri"
                  render={({ field, fieldState }) => (
                    <Field>
                      <FieldLabel>Logo URI</FieldLabel>
                      <InputGroup>
                        <InputGroupInput
                          {...field}
                          type="url"
                          placeholder="https://example.com/logo.png"
                        />
                      </InputGroup>
                      {fieldState.invalid && (
                        <FieldError errors={[fieldState.error]} />
                      )}
                    </Field>
                  )}
                />
              </div>

              <Controller
                control={form.control}
                name="disabled"
                render={({ field, fieldState }) => (
                  <Field>
                    <div className="flex flex-row items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FieldLabel className="text-base">
                          Disable Client
                        </FieldLabel>
                        <FieldDescription>
                          Disabled clients cannot authenticate or receive new
                          tokens.
                        </FieldDescription>
                      </div>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </div>
                    {fieldState.invalid && (
                      <FieldError errors={[fieldState.error]} />
                    )}
                  </Field>
                )}
              />

              <Controller
                control={form.control}
                name="metadata"
                render={({ field, fieldState }) => (
                  <Field>
                    <FieldLabel>Metadata (JSON)</FieldLabel>
                    <InputGroupTextarea
                      className="min-h-[100px] font-mono text-sm"
                      {...field}
                    />
                    <FieldDescription>
                      Optional JSON metadata for the client.
                    </FieldDescription>
                    {fieldState.invalid && (
                      <FieldError errors={[fieldState.error]} />
                    )}
                  </Field>
                )}
              />

              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsEditing(false)}
                  disabled={loading}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={loading}>
                  {loading && (
                    <LoaderIcon className="h-4 w-4 mr-2 animate-spin" />
                  )}
                  Save Changes
                </Button>
              </div>
            </form>
          ) : (
            <>
              {/* Client Credentials */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Client Credentials</h3>

                <div className="space-y-3">
                  <CredentialField
                    label="Client ID"
                    value={client.clientId}
                    copyLabel="Client ID"
                  />

                  {client.clientSecret && (
                    <CredentialField
                      label="Client Secret"
                      value={client.clientSecret}
                      copyLabel="Client Secret"
                      showToggle
                      isVisible={showSecret}
                      onToggleVisibility={() => setShowSecret(!showSecret)}
                    />
                  )}
                </div>
              </div>

              <Separator />

              {/* Client Configuration */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Configuration</h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      Client Type
                    </p>
                    <div className="mt-1">
                      <Badge variant="secondary">
                        {typeLabels[client.type]}
                      </Badge>
                    </div>
                  </div>

                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      Status
                    </p>
                    <div className="mt-1">
                      <Badge
                        variant={client.disabled ? "destructive" : "default"}
                      >
                        {client.disabled ? "Disabled" : "Active"}
                      </Badge>
                    </div>
                  </div>
                </div>

                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Redirect URIs
                  </p>
                  <div className="mt-1 space-y-1">
                    {client.redirectURLs.map((uri) => (
                      <div key={uri} className="flex items-center gap-2">
                        <code className="flex-1 text-sm bg-muted px-3 py-2 rounded border">
                          {uri}
                        </code>
                        <CopyToClipboard text={uri} label="Redirect URI" />
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => window.open(uri, "_blank")}
                        >
                          <ExternalLinkIcon className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>

                {client.metadata && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      Metadata
                    </p>
                    <pre className="mt-1 text-sm bg-muted px-3 py-2 rounded border overflow-x-auto">
                      {JSON.stringify(client.metadata, null, 2)}
                    </pre>
                  </div>
                )}
              </div>

              <Separator />

              {/* OAuth 2.0 Endpoints */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">
                  OAuth 2.0 / OIDC Endpoints
                </h3>

                <div className="space-y-3">
                  <EndpointField
                    label="Authorization Endpoint"
                    endpoint={`${process.env.NEXT_PUBLIC_API_URL}/oauth2/authorize`}
                  />

                  <EndpointField
                    label="Token Endpoint"
                    endpoint={`${process.env.NEXT_PUBLIC_API_URL}/oauth2/token`}
                  />

                  <EndpointField
                    label="UserInfo Endpoint"
                    endpoint={`${process.env.NEXT_PUBLIC_API_URL}/oauth2/userinfo`}
                  />

                  <EndpointField
                    label="OIDC Discovery"
                    endpoint={`${process.env.NEXT_PUBLIC_API_URL}/.well-known/openid-configuration`}
                    showExternalLink
                  />
                </div>
              </div>

              <Separator />

              {/* Timestamps */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Timestamps</h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      Created
                    </p>
                    <div className="mt-1 text-sm">
                      {client.createdAt.toLocaleString()}
                    </div>
                  </div>

                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      Last Updated
                    </p>
                    <div className="mt-1 text-sm">
                      {client.updatedAt.toLocaleString()}
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
