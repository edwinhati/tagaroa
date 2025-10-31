"use client";

import { authClient } from "@repo/common/lib/auth-client";

type Service = "auth" | "finance" | "file" | string;

function getApiUrl(service: Service, path: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL as string;

  // Add service prefix to path for API gateway routing
  switch (service) {
    case "auth":
      return `${baseUrl}/api/auth${path}`;
    case "finance":
      return `${baseUrl}/api/finance${path}`;
    case "file":
      return `${baseUrl}/api/file${path}`;
    default:
      // Allow passing a full base URL string for custom services
      return `${service}${path}`;
  }
}

export type ApiRequestInit = Omit<RequestInit, "headers" | "body"> & {
  headers?: Record<string, string>;
  // When provided, body will be JSON.stringified and Content-Type set accordingly
  json?: unknown;
  // When provided, body will be sent as FormData (for file uploads)
  formData?: FormData;
  // If false, do not attach Authorization header
  auth?: boolean;
};

type JsonEnvelope<T> = { data?: T; error?: string } | T;

export async function apiRequest<T = unknown>(
  service: Service,
  path: string,
  init: ApiRequestInit = {},
): Promise<T> {
  const url = getApiUrl(service, path);

  const headers: Record<string, string> = {
    ...(init.headers || {}),
  };

  // Attach Authorization header by default
  if (init.auth !== false) {
    try {
      const { data: jwtData, error } = await authClient.token();
      if (jwtData?.token) {
        headers["Authorization"] = `Bearer ${jwtData.token}`;
      } else {
        console.warn("Failed to get JWT token:", error);
        const { data: session } = await authClient.getSession();
        const sessionToken = session?.session.token;
        if (sessionToken) {
          headers["Authorization"] = `Bearer ${sessionToken}`;
        }
      }
    } catch (error) {
      console.warn("Error getting JWT token:", error);
      // Fallback to session token
      const { data: session } = await authClient.getSession();
      const sessionToken = session?.session.token;
      if (sessionToken) {
        headers["Authorization"] = `Bearer ${sessionToken}`;
      }
    }
  }

  // Handle JSON body convenience
  let body: BodyInit | undefined = undefined;
  if (init.formData !== undefined) {
    // Don't set Content-Type for FormData - let the browser set it with boundary
    body = init.formData;
  } else if (init.json !== undefined) {
    headers["Content-Type"] = headers["Content-Type"] || "application/json";
    body = JSON.stringify(init.json);
  }

  const response = await fetch(url, {
    ...init,
    headers,
    body,
  });

  // Attempt to parse JSON either way
  let parsed: JsonEnvelope<T> | undefined;
  try {
    parsed = (await response.json()) as JsonEnvelope<T>;
  } catch {
    // Non-JSON response
  }

  if (!response.ok) {
    const message =
      (parsed &&
        typeof parsed === "object" &&
        "error" in parsed &&
        parsed.error) ||
      response.statusText ||
      "Request failed";
    throw new Error(message);
  }

  // Support both `{ data }` envelope and raw JSON bodies
  if (parsed && typeof parsed === "object" && "data" in parsed) {
    return parsed.data as T;
  }
  return parsed as T;
}

export const authApi = {
  get: <T>(path: string, init?: ApiRequestInit) =>
    apiRequest<T>("auth", path, { method: "GET", ...(init || {}) }),
  post: <T>(path: string, json?: unknown, init?: ApiRequestInit) =>
    apiRequest<T>("auth", path, { method: "POST", json, ...(init || {}) }),
};

export const financeApi = {
  get: <T>(path: string, init?: ApiRequestInit) =>
    apiRequest<T>("finance", path, { method: "GET", ...(init || {}) }),
  post: <T>(path: string, json?: unknown, init?: ApiRequestInit) =>
    apiRequest<T>("finance", path, { method: "POST", json, ...(init || {}) }),
  put: <T>(path: string, json?: unknown, init?: ApiRequestInit) =>
    apiRequest<T>("finance", path, { method: "PUT", json, ...(init || {}) }),
  patch: <T>(path: string, json?: unknown, init?: ApiRequestInit) =>
    apiRequest<T>("finance", path, { method: "PATCH", json, ...(init || {}) }),
};

export const fileApi = {
  get: <T>(path: string, init?: ApiRequestInit) =>
    apiRequest<T>("file", path, { method: "GET", ...(init || {}) }),
  delete: <T>(path: string, init?: ApiRequestInit) =>
    apiRequest<T>("file", path, { method: "DELETE", ...(init || {}) }),
  post: <T>(path: string, json?: unknown, init?: ApiRequestInit) =>
    apiRequest<T>("file", path, { method: "POST", json, ...(init || {}) }),
  upload: <T>(file: File, init?: ApiRequestInit) => {
    const formData = new FormData();
    formData.append("file", file);
    return apiRequest<T>("file", "/upload", {
      method: "POST",
      formData,
      ...(init || {}),
    });
  },
};
