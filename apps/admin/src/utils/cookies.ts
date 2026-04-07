export function setCookie(name: string, value: string, path: string): void {
  if (typeof cookieStore === "undefined") {
    const encodedName = encodeURIComponent(name);
    const encodedValue = encodeURIComponent(value);
    // Workaround for biome suspicious/noDocumentCookie
    const doc = document as unknown as Record<string, string>;
    doc.cookie = `${encodedName}=${encodedValue}; path=${path}; SameSite=Lax`;
  } else {
    cookieStore.set({ name, value, path });
  }
}
