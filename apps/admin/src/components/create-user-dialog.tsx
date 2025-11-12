"use client";

import { z } from "zod";
import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { PlusIcon } from "lucide-react";

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
import { Checkbox } from "@repo/ui/components/checkbox";
import { toast } from "sonner";

import { authClient } from "@repo/common/lib/auth-client";

const createUserSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  role: z.enum(["user", "admin"]).default("user"),
  emailVerified: z.boolean().default(false),
});

type CreateUserFormData = z.infer<typeof createUserSchema>;

type CreateUserDialogProps = Readonly<{
  onUserCreated?: () => void;
}>;

export function CreateUserDialog({ onUserCreated }: CreateUserDialogProps) {
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm({
    resolver: zodResolver(createUserSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
      role: "user" as const,
      emailVerified: false,
    },
  });

  const onSubmit = async (data: CreateUserFormData) => {
    try {
      setIsLoading(true);

      const response = await authClient.admin.createUser({
        name: data.name,
        email: data.email,
        password: data.password,
        role: data.role || "user",
        data: {
          emailVerified: data.emailVerified || false,
        },
      });

      if (response.error) {
        toast.error(response.error.message || "Failed to create user");
        return;
      }

      toast.success("User created successfully");

      form.reset();
      setOpen(false);
      onUserCreated?.();
    } catch (error) {
      console.error("Failed to create user:", error);
      toast.error("Failed to create user. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <PlusIcon className="h-4 w-4" />
          Add User
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-3xl w-full">
        <DialogHeader>
          <DialogTitle>Create New User</DialogTitle>
          <DialogDescription>
            Add a new user to the system. They will be able to sign in with the
            provided credentials.
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
                  <FieldLabel>Name</FieldLabel>
                  <InputGroup>
                    <InputGroupInput
                      {...field}
                      type="text"
                      placeholder="Enter user's full name"
                    />
                  </InputGroup>
                  <FieldDescription>
                    Enter the user&apos;s full name.
                  </FieldDescription>
                  {fieldState.invalid && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </Field>
              )}
            />

            <Controller
              control={form.control}
              name="email"
              render={({ field, fieldState }) => (
                <Field>
                  <FieldLabel>Email</FieldLabel>
                  <InputGroup>
                    <InputGroupInput
                      {...field}
                      type="email"
                      placeholder="Enter user's email address"
                    />
                  </InputGroup>
                  <FieldDescription>
                    Enter a valid email address for the user.
                  </FieldDescription>
                  {fieldState.invalid && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </Field>
              )}
            />

            <Controller
              control={form.control}
              name="password"
              render={({ field, fieldState }) => (
                <Field>
                  <FieldLabel>Password</FieldLabel>
                  <InputGroup>
                    <InputGroupInput
                      {...field}
                      type="password"
                      placeholder="Enter a secure password"
                    />
                  </InputGroup>
                  <FieldDescription>
                    Password must be at least 8 characters long.
                  </FieldDescription>
                  {fieldState.invalid && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </Field>
              )}
            />

            <Controller
              control={form.control}
              name="role"
              render={({ field, fieldState }) => (
                <Field>
                  <FieldLabel>Role</FieldLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select a role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="user">User</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                  <FieldDescription>
                    Admin users have access to the admin panel.
                  </FieldDescription>
                  {fieldState.invalid && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </Field>
              )}
            />
          </div>

          {/* Email Verified Field - Full width */}
          <Controller
            control={form.control}
            name="emailVerified"
            render={({ field, fieldState }) => (
              <Field>
                <div className="flex flex-row items-start space-x-3 space-y-0">
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                  <div className="space-y-1 leading-none">
                    <FieldLabel>Email Verified</FieldLabel>
                    <FieldDescription>
                      Mark the email as verified to skip email verification.
                    </FieldDescription>
                  </div>
                </div>
                {fieldState.invalid && (
                  <FieldError errors={[fieldState.error]} />
                )}
              </Field>
            )}
          />

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isLoading}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading} className="flex-1">
              {isLoading ? "Creating..." : "Create User"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
