"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { authClient } from "@repo/common/lib/auth-client";
import { resolveSafeRedirect } from "@repo/common/lib/redirect";
import { Button } from "@repo/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/card";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@repo/ui/components/field";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@repo/ui/components/input-group";
import { Separator } from "@repo/ui/components/separator";
import { cn } from "@repo/ui/lib/utils";
import {
  IconAlertCircle,
  IconEye,
  IconEyeOff,
  IconLoader2,
  IconMail,
} from "@tabler/icons-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type * as React from "react";
import { useState, useSyncExternalStore } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

const signInFormSchema = z.object({
  email: z.email({
    message: "Please enter a valid email address.",
  }),
  password: z.string().min(8, {
    message: "Password must be at least 8 characters long.",
  }),
});

type SignInFormValues = z.infer<typeof signInFormSchema>;

const subscribeToClient = (callback: () => void) => {
  const globalWindow =
    typeof globalThis === "undefined"
      ? undefined
      : (globalThis as { window?: Window }).window;
  if (globalWindow) {
    const id = globalWindow.requestAnimationFrame(() => callback());
    return () => {
      globalWindow.cancelAnimationFrame(id);
    };
  }
  return () => {};
};

export function SignInForm({
  className,
  ...props
}: Readonly<React.ComponentPropsWithoutRef<"div">>) {
  const mounted = useSyncExternalStore(
    subscribeToClient,
    () => true,
    () => false,
  );

  const isGoogleAuthEnabled = true;

  const [loading, setLoading] = useState<boolean>();
  const [authError, setAuthError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState<boolean>(false);

  const router = useRouter();
  const searchParams = useSearchParams();

  const dashboardBase = process.env.NEXT_PUBLIC_DASHBOARD_APP_URL || "/";
  const redirectPath = resolveSafeRedirect(
    searchParams.get("redirect"),
    dashboardBase,
  );

  const form = useForm<SignInFormValues>({
    resolver: zodResolver(signInFormSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  async function onSubmit(values: SignInFormValues) {
    setLoading(true);
    setAuthError(null);

    const { data, error } = await authClient.signIn.email({
      email: values.email,
      password: values.password,
      rememberMe: false,
    });

    if (data) {
      setLoading(false);
      toast.success("Logged in successfully — let’s get to it 🚀");
      router.push(redirectPath);
    } else if (error) {
      setLoading(false);
      setAuthError(error?.message || "An error occurred during sign in");
    }
  }

  async function signInWithSocialProvider(provider: string) {
    setLoading(true);
    setAuthError(null);
    const { data, error } = await authClient.signIn.social({
      provider,
    });

    if (data) {
      setLoading(false);
      toast.success("Logged in successfully — let’s get to it 🚀");
      router.push(redirectPath);
    } else if (error) {
      setLoading(false);
      setAuthError(error?.message || "An error occurred during sign in");
    }
  }

  return (
    <div className={cn("w-full max-w-md mx-auto", className)} {...props}>
      <Card className="shadow-md">
        <CardHeader className="space-y-1 text-center">
          <CardTitle className="text-2xl font-bold">Welcome back</CardTitle>
          <CardDescription>Sign in to your account to continue</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {authError && (
            <div
              className="p-3 text-sm text-destructive bg-destructive/10 rounded-md"
              role="alert"
            >
              <IconAlertCircle
                className="me-3 -mt-0.5 inline-flex opacity-60"
                size={16}
                aria-hidden="true"
              />
              {authError}
            </div>
          )}
          {mounted && isGoogleAuthEnabled && (
            <div className="grid gap-4">
              <Button
                variant="outline"
                className="w-full flex items-center justify-center"
                disabled={loading}
                type="button"
                onClick={() => signInWithSocialProvider("google")}
              >
                <div className="flex items-center justify-center w-5 h-5 mr-2">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-4 w-4"
                    viewBox="0 0 24 24"
                  >
                    <title>Continue with Google</title>
                    <path
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      fill="#4285F4"
                    />
                    <path
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      fill="#34A853"
                    />
                    <path
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                      fill="#FBBC05"
                    />
                    <path
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                      fill="#EA4335"
                    />
                    <path d="M1 1h22v22H1z" fill="none" />
                  </svg>
                </div>
                Continue with Google
              </Button>
            </div>
          )}

          {mounted && isGoogleAuthEnabled && (
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <Separator />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">
                  Or continue with credentials
                </span>
              </div>
            </div>
          )}

          {mounted && (
            <FieldGroup>
              <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="space-y-4"
              >
                <Controller
                  control={form.control}
                  name="email"
                  render={({ field, fieldState }) => (
                    <Field>
                      <FieldLabel>Email</FieldLabel>
                      <InputGroup>
                        <InputGroupInput
                          {...field}
                          type="text"
                          autoComplete="email"
                          placeholder="Enter your email"
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
                  name="password"
                  render={({ field, fieldState }) => (
                    <Field>
                      <div className="flex items-center justify-between">
                        <FieldLabel>Password</FieldLabel>
                        <Link
                          href="/forgot-password"
                          className="text-xs text-primary hover:underline"
                        >
                          Forgot password?
                        </Link>
                      </div>
                      <InputGroup className="relative">
                        <InputGroupInput
                          {...field}
                          type={showPassword ? "text" : "password"}
                          autoComplete="current-password"
                          placeholder="••••••••"
                        />
                        <InputGroupAddon>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                            onClick={() => setShowPassword(!showPassword)}
                            aria-label={
                              showPassword ? "Hide password" : "Show password"
                            }
                          >
                            {showPassword ? (
                              <IconEyeOff className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <IconEye className="h-4 w-4 text-muted-foreground" />
                            )}
                          </Button>
                        </InputGroupAddon>
                      </InputGroup>
                      {fieldState.invalid && (
                        <FieldError errors={[fieldState.error]} />
                      )}
                    </Field>
                  )}
                />
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? (
                    <>
                      <IconLoader2 className="mr-2 h-4 w-4 animate-spin" />
                      Signing in...
                    </>
                  ) : (
                    <>
                      <IconMail className="mr-2 h-4 w-4" />
                      Sign in with Credentials
                    </>
                  )}
                </Button>
                {form.formState.errors.root && (
                  <p className="text-sm text-destructive mt-2">
                    {form.formState.errors.root.message}
                  </p>
                )}
              </form>
            </FieldGroup>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
