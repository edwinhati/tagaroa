export function setCookie(name: string, value: string, path: string): void {
  if (typeof cookieStore !== "undefined") {
    cookieStore.set({ name, value, path });
  } else {
    const encodedName = encodeURIComponent(name);
    const encodedValue = encodeURIComponent(value);
    document.cookie = `${encodedName}=${encodedValue}; path=${path}; SameSite=Lax`;
  }
}
