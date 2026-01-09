import { Loading } from "@repo/common/components/loading";
import { Logo } from "@repo/common/components/logo";
import Link from "next/link";
import { Suspense } from "react";
import { SignInForm } from "@/components/sign-in-form";

export default function SignInPage() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-muted p-6 md:p-10">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <Link
          href="#"
          className="flex items-center gap-2 self-center font-medium"
        >
          <Logo />
          <span className="text-3xl font-semibold leading-tight tracking-tight">
            Tagaroa
          </span>
        </Link>
        <Suspense
          fallback={
            <div
              className="fixed inset-0 flex items-center justify-center"
              style={{ height: "100vh", width: "100vw" }}
            >
              <Loading />
            </div>
          }
        >
          <SignInForm />
        </Suspense>
      </div>
    </div>
  );
}
