import { afterAll, beforeAll, describe, expect, test } from "bun:test";

const previousWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
const keys = [
  "VITE_AUTH_BASE_URL",
  "VITE_AUTH_URL",
  "VITE_WORKSPACE_URL",
  "VITE_ADMIN_URL",
] as const;
const previousEnv = Object.fromEntries(
  keys.map((key) => [key, process.env[key]]),
);

// Each case loads its own copy of the module, since the URLs are read once.
let loads = 0;
async function urlsAt(host: string, protocol = "https:") {
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: { location: { host, protocol } },
  });
  return import(`./urls?load=${++loads}`) as Promise<typeof import("./urls")>;
}

beforeAll(() => {
  for (const key of keys) delete process.env[key];
});

afterAll(() => {
  for (const key of keys) {
    if (previousEnv[key] === undefined) delete process.env[key];
    else process.env[key] = previousEnv[key];
  }
  if (previousWindow)
    Object.defineProperty(globalThis, "window", previousWindow);
  else Reflect.deleteProperty(globalThis, "window");
});

describe("urls", () => {
  test("a deployed app works out every URL from its own host", async () => {
    const urls = await urlsAt("admin.dev.tagaroa.cc");
    expect(urls.IS_DEPLOYED).toBe(true);
    expect(urls.CORE_URL).toBe("https://dev.tagaroa.cc");
    expect(urls.AUTH_URL).toBe("https://auth.dev.tagaroa.cc");
    expect(urls.WORKSPACE_URL).toBe("https://app.dev.tagaroa.cc");
    expect(urls.ADMIN_URL).toBe("https://admin.dev.tagaroa.cc");
  });

  test("prod and a host with a port follow the same pattern", async () => {
    expect((await urlsAt("app.tagaroa.cc")).CORE_URL).toBe(
      "https://tagaroa.cc",
    );
    const local = await urlsAt("auth.dev.localtest.me:8443");
    expect(local.CORE_URL).toBe("https://dev.localtest.me:8443");
    expect(local.WORKSPACE_URL).toBe("https://app.dev.localtest.me:8443");
  });

  test("any other host keeps the local dev ports", async () => {
    for (const host of ["localhost:3001", "127.0.0.1:3001", "evil.example"]) {
      const urls = await urlsAt(host, "http:");
      expect(urls.IS_DEPLOYED).toBe(false);
      expect(urls.CORE_URL).toBe("http://localhost:8080");
      expect(urls.AUTH_URL).toBe("http://localhost:3001");
    }
  });

  test("a VITE_ value wins over the host", async () => {
    process.env.VITE_AUTH_BASE_URL = "https://api.example.test";
    try {
      const urls = await urlsAt("auth.dev.tagaroa.cc");
      expect(urls.CORE_URL).toBe("https://api.example.test");
      expect(urls.AUTH_URL).toBe("https://auth.dev.tagaroa.cc");
    } finally {
      delete process.env.VITE_AUTH_BASE_URL;
    }
  });
});
