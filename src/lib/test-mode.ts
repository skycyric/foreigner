/**
 * 測試模式旗標 — dev 環境與 Lovable preview 環境自動開啟，正式網域自動關閉。
 *
 * 判斷規則：
 * - dev server (`import.meta.env.DEV`) → 測試
 * - hostname 含 `lovable.app` 或 `lovableproject.com` → 測試
 * - 其他（自訂 domain、published 正式網址）→ 關閉
 *
 * ⚠️ 上線前請參考 docs/PRODUCTION_CHECKLIST.md 移除此檔案及相關引用。
 */
export const IS_TEST_MODE =
  import.meta.env.DEV ||
  (typeof window !== "undefined" &&
    /(lovable\.app|lovableproject\.com)$/.test(window.location.hostname));
