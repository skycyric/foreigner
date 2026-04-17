/**
 * Device ID — 持久化於 localStorage，用於 cookie-less 識別。
 */
const KEY = "lucky_device_id";

export function getDeviceId(): string {
  if (typeof window === "undefined") return "ssr";
  let id = window.localStorage.getItem(KEY);
  if (!id) {
    id = (crypto?.randomUUID?.() ?? `dev-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    window.localStorage.setItem(KEY, id);
  }
  return id;
}

const EMAIL_KEY = "lucky_email";
export function getStoredEmail(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(EMAIL_KEY);
}
export function setStoredEmail(email: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(EMAIL_KEY, email);
}
export function clearStoredEmail() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(EMAIL_KEY);
}
