/**
 * @deprecated 改用 @/lib/identity（同步寫 cookie 讓 SSR 可讀）
 * 此檔保留為 re-export 維持相容。
 */
export {
  getStoredEmail,
  setStoredEmail,
  clearStoredEmail,
  getDeviceId,
} from "./identity";
