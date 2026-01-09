"use client";

import { Loading } from "@repo/common/components/loading";
import { authClient } from "@repo/common/lib/auth-client";
import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/card";
import { Separator } from "@repo/ui/components/separator";
import { CheckIcon, MailIcon, ShieldIcon, UserIcon, XIcon } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

function ConsentPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const consentCode = searchParams.get("consent_code");
  const clientId = searchParams.get("client_id");
  const scope = searchParams.get("scope");

  const scopes = scope ? scope.split(" ") : [];

  useEffect(() => {
    if (!consentCode || !clientId) {
      setError("Missing required parameters");
    }
  }, [consentCode, clientId]);

  const handleConsent = async (accept: boolean) => {
    if (!consentCode) {
      setError("Missing consent code");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data, error } = await authClient.oauth2.consent({
        accept,
        consent_code: consentCode,
      });

      if (error) {
        setError(error.message || "Failed to process consent");
        return;
      }

      if (data?.redirectURI) {
        const globalLocation =
          typeof globalThis !== "undefined" &&
          (globalThis as { location?: Location }).location !== undefined
            ? (globalThis as { location?: Location }).location
            : null;
        if (globalLocation) {
          globalLocation.href = data.redirectURI;
        } else {
          router.push(data.redirectURI);
        }
      } else {
        router.push("/");
      }
    } catch (err) {
      setError("An unexpected error occurred");
      console.error("Consent error:", err);
    } finally {
      setLoading(false);
    }
  };

  const getScopeDescription = (scope: string) => {
    switch (scope) {
      case "openid":
        return "Verify your identity";
      case "profile":
        return "Access your basic profile information (name, picture)";
      case "email":
        return "Access your email address";
      default:
        return `Access ${scope} information`;
    }
  };

  const getScopeIcon = (scope: string) => {
    switch (scope) {
      case "openid":
        return <ShieldIcon className="h-4 w-4" />;
      case "profile":
        return <UserIcon className="h-4 w-4" />;
      case "email":
        return <MailIcon className="h-4 w-4" />;
      default:
        return <ShieldIcon className="h-4 w-4" />;
    }
  };

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-center text-red-600">Error</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-center text-gray-600 mb-4">{error}</p>
            <Button
              onClick={() => router.push("/")}
              className="w-full"
              variant="outline"
            >
              Go Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-blue-100">
            <ShieldIcon className="h-6 w-6 text-blue-600" />
          </div>
          <CardTitle>Authorize Application</CardTitle>
          <p className="text-sm text-gray-600">
            <strong>{clientId}</strong> is requesting access to your account
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h3 className="text-sm font-medium text-gray-900 mb-3">
              This application will be able to:
            </h3>
            <div className="space-y-2">
              {scopes.map((scope) => (
                <div key={scope} className="flex items-center space-x-3">
                  <div className="flex-shrink-0 text-green-500">
                    {getScopeIcon(scope)}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center space-x-2">
                      <Badge variant="secondary" className="text-xs">
                        {scope}
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-600 mt-1">
                      {getScopeDescription(scope)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <Separator />

          <div className="text-xs text-gray-500 text-center">
            By authorizing this application, you allow it to access the
            information described above. You can revoke this access at any time
            in your account settings.
          </div>

          <div className="flex space-x-3">
            <Button
              onClick={() => handleConsent(false)}
              variant="outline"
              className="flex-1"
              disabled={loading}
            >
              <XIcon className="h-4 w-4 mr-2" />
              Deny
            </Button>
            <Button
              onClick={() => handleConsent(true)}
              className="flex-1"
              disabled={loading}
            >
              <CheckIcon className="h-4 w-4 mr-2" />
              {loading ? "Authorizing..." : "Authorize"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function ConsentPage() {
  return (
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
      <ConsentPageContent />
    </Suspense>
  );
}
