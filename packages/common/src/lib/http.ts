"use client";

type Service = "auth" | "finance" | "storage" | "investment";

function getApiUrl(service: Service, path: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? "";
  const servicePrefix: Record<Service, string> = {
    auth: "auth",
    finance: "finance",
    storage: "storage",
    investment: "investment",
  };

  return `${baseUrl}/api/${servicePrefix[service]}${path}`;
}

type ApiRequestInit = Omit<RequestInit, "headers" | "body"> & {
  headers?: Record<string, string>;
  // When provided, body will be JSON.stringified and Content-Type set accordingly
  json?: unknown;
  // When provided, body will be sent as FormData (for file uploads)
  formData?: FormData;
  // If false, return the parsed response without unwrapping the { data, pagination, ... } envelope
  unwrapData?: boolean;
};

type JsonEnvelope<T> = { data?: T; error?: string } | T;

async function apiRequest<T = unknown>(
  service: Service,
  path: string,
  init: ApiRequestInit = {},
): Promise<T> {
  const url = getApiUrl(service, path);

  const headers: Record<string, string> = init.headers ?? {};
  const body = buildBody(init, headers);

  const response = await fetch(url, {
    ...init,
    headers,
    body,
    credentials: "include",
  });

  const unwrapData = init.unwrapData ?? true;
  return handleResponse<T>(response, unwrapData);
}

export const financeApi = {
  get: <T>(path: string, init: ApiRequestInit = {}) =>
    apiRequest<T>("finance", path, { method: "GET", ...init }),
  post: <T>(path: string, json?: unknown, init: ApiRequestInit = {}) =>
    apiRequest<T>("finance", path, { method: "POST", json, ...init }),
  put: <T>(path: string, json?: unknown, init: ApiRequestInit = {}) =>
    apiRequest<T>("finance", path, { method: "PUT", json, ...init }),
  patch: <T>(path: string, json?: unknown, init: ApiRequestInit = {}) =>
    apiRequest<T>("finance", path, { method: "PATCH", json, ...init }),
  delete: <T>(path: string, init: ApiRequestInit = {}) =>
    apiRequest<T>("finance", path, { method: "DELETE", ...init }),
};

export const investmentApi = {
  get: <T>(path: string, init: ApiRequestInit = {}) =>
    apiRequest<T>("investment", path, { method: "GET", ...init }),
  post: <T>(path: string, json?: unknown, init: ApiRequestInit = {}) =>
    apiRequest<T>("investment", path, { method: "POST", json, ...init }),
  put: <T>(path: string, json?: unknown, init: ApiRequestInit = {}) =>
    apiRequest<T>("investment", path, { method: "PUT", json, ...init }),
  patch: <T>(path: string, json?: unknown, init: ApiRequestInit = {}) =>
    apiRequest<T>("investment", path, { method: "PATCH", json, ...init }),
  delete: <T>(path: string, init: ApiRequestInit = {}) =>
    apiRequest<T>("investment", path, { method: "DELETE", ...init }),
};

export const storageApi = {
  get: <T>(path: string, init: ApiRequestInit = {}) =>
    apiRequest<T>("storage", path, { method: "GET", ...init }),
  delete: <T>(path: string, init: ApiRequestInit = {}) =>
    apiRequest<T>("storage", path, { method: "DELETE", ...init }),
  post: <T>(path: string, json?: unknown, init: ApiRequestInit = {}) =>
    apiRequest<T>("storage", path, { method: "POST", json, ...init }),
  upload: <T>(file: File, init: ApiRequestInit = {}) => {
    const formData = new FormData();
    formData.append("file", file);
    return apiRequest<T>("storage", "/upload", {
      method: "POST",
      formData,
      ...init,
    });
  },
};

function buildBody(
  init: ApiRequestInit,
  headers: Record<string, string>,
): BodyInit | undefined {
  if (init.formData) {
    return init.formData;
  }
  if (init.json !== undefined) {
    headers["Content-Type"] = headers["Content-Type"] ?? "application/json";
    return JSON.stringify(init.json);
  }
  return undefined;
}

async function parseJsonResponse<T>(
  response: Response,
): Promise<JsonEnvelope<T> | undefined> {
  try {
    return (await response.json()) as JsonEnvelope<T>;
  } catch {
    return undefined;
  }
}

function extractErrorMessage<T>(
  response: Response,
  parsed?: JsonEnvelope<T>,
): string {
  if (
    parsed &&
    typeof parsed === "object" &&
    "error" in parsed &&
    parsed.error
  ) {
    return parsed.error;
  }
  return response.statusText || "Request failed";
}

function unwrapResponseData<T>(parsed?: JsonEnvelope<T>): T {
  if (parsed && typeof parsed === "object" && "data" in parsed) {
    if (parsed.data === undefined) {
      throw new Error("Response payload missing data field");
    }
    return parsed.data;
  }
  return parsed as T;
}

async function handleResponse<T>(
  response: Response,
  unwrapData: boolean,
): Promise<T> {
  const parsed = await parseJsonResponse<T>(response);
  if (!response.ok) {
    throw new Error(extractErrorMessage(response, parsed));
  }
  if (!unwrapData) {
    if (parsed === undefined) {
      throw new Error("Response payload missing body");
    }
    return parsed as T;
  }
  return unwrapResponseData(parsed);
}
