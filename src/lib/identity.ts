/**
 * Email + Device ID 識別 — 同步存 localStorage 與 cookie。
 * cookie 讓 SSR loader / server function 能在 server 端就拿到，
 * 預先 fetch 資料避免 client 端再閃骨架。
 */

const EMAIL_KEY = "lucky_email";
const DEVICE_KEY = "lucky_device_id";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 180; // 180 天

function setCookie(name: string, value: string) {
  if (typeof document === "undefined") return;
  document.cookie = `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${COOKIE_MAX_AGE}; SameSite=Lax`;
}

function deleteCookie(name: string) {
  if (typeof document === "undefined") return;
  document.cookie = `${name}=; Path=/; Max-Age=0; SameSite=Lax`;
}

export function getStoredEmail(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(EMAIL_KEY);
}

export function setStoredEmail(email: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(EMAIL_KEY, email);
  setCookie(EMAIL_KEY, email);
}

export function clearStoredEmail() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(EMAIL_KEY);
  deleteCookie(EMAIL_KEY);
}

export function getDeviceId(): string {
  if (typeof window === "undefined") return "ssr";
  let id = window.localStorage.getItem(DEVICE_KEY);
  if (!id) {
    id =
      crypto?.randomUUID?.() ??
      `dev-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    window.localStorage.setItem(DEVICE_KEY, id);
  }
  // 確保 cookie 也存在（升級舊使用者）
  setCookie(DEVICE_KEY, id);
  return id;
}

export const COOKIE_KEYS = {
  email: EMAIL_KEY,
  deviceId: DEVICE_KEY,
} as const;
