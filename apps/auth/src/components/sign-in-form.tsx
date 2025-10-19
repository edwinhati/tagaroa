"use client";

import { z } from "zod";
import Link from "next/link";
import { useState, useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter, useSearchParams } from "next/navigation";
import { useFeatureFlagEnabled } from "posthog-js/react";

import { toast } from "sonner";
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
import { Button } from "@repo/ui/components/button";
import { Separator } from "@repo/ui/components/separator";
import { cn } from "@repo/ui/lib/utils";

import { authClient } from "@repo/common/lib/auth-client";
import { resolveSafeRedirect } from "@repo/common/lib/redirect";
import { CircleAlert, Eye, EyeOff, Loader2, Mail } from "lucide-react";

const signInFormSchema = z.object({
  email: z.email({
    message: "Please enter a valid email address.",
  }),
  password: z.string().min(8, {
    message: "Password must be at least 8 characters long.",
  }),
});

type SignInFormValues = z.infer<typeof signInFormSchema>;

export function SignInForm({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  const [mounted, setMounted] = useState(false);
  const googleAuthFlagEnabled = useFeatureFlagEnabled("google-auth");
  const githubAuthFlagEnabled = useFeatureFlagEnabled("github-auth");

  // Add fallback values and loading state
  const isGoogleAuthEnabled = googleAuthFlagEnabled ?? false;
  const isGithubAuthEnabled = githubAuthFlagEnabled ?? false;

  const [loading, setLoading] = useState<boolean>();
  const [authError, setAuthError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState<boolean>(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const router = useRouter();
  const searchParams = useSearchParams();

  const dashboardBase = process.env.NEXT_PUBLIC_DASHBOARD_APP_URL || "/";
  const redirectPath = resolveSafeRedirect(
    searchParams.get("redirect"),
    dashboardBase
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
              <CircleAlert
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

          {mounted && isGithubAuthEnabled && (
            <div className="grid gap-4">
              <Button
                variant="outline"
                className="w-full flex items-center justify-center"
                disabled={loading}
                type="button"
                onClick={() => signInWithSocialProvider("github")}
              >
                <div className="flex items-center justify-center w-5 h-5 mr-2">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-4 w-4"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                  >
                    <path d="M12 .5C5.73.5.5 5.74.5 12.02c0 5.1 3.29 9.42 7.86 10.96.58.11.79-.25.79-.56v-2.15c-3.2.7-3.87-1.54-3.87-1.54-.53-1.34-1.3-1.7-1.3-1.7-1.07-.73.08-.72.08-.72 1.18.08 1.8 1.22 1.8 1.22 1.05 1.79 2.75 1.27 3.42.97.11-.76.41-1.27.75-1.56-2.55-.29-5.23-1.28-5.23-5.7 0-1.26.45-2.29 1.19-3.1-.12-.29-.52-1.44.11-3.01 0 0 .97-.31 3.18 1.18a10.95 10.95 0 0 1 5.8 0c2.2-1.5 3.18-1.18 3.18-1.18.63 1.57.23 2.72.11 3.01.74.81 1.19 1.84 1.19 3.1 0 4.43-2.68 5.41-5.24 5.69.42.36.8 1.08.8 2.18v3.23c0 .31.21.68.8.56A10.52 10.52 0 0 0 23.5 12c0-6.28-5.23-11.5-11.5-11.5z" />
                  </svg>
                </div>
                Continue with Github
              </Button>
            </div>
          )}

          {mounted && (isGoogleAuthEnabled || isGithubAuthEnabled) && (
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
                          type="email"
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
                              <EyeOff className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <Eye className="h-4 w-4 text-muted-foreground" />
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
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Signing in...
                    </>
                  ) : (
                    <>
                      <Mail className="mr-2 h-4 w-4" />
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
