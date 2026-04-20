/**
 * 測試券號白名單 — 只有列在這裡的 TN 才會在送出時加上時間戳後綴，
 * 讓同一張紙可以重複測試。其他「真實」券號即使在 dev / preview
 * 環境也照常 unique 檢查，避免測試模式遮蔽真實情境的 bug。
 *
 * ⚠️ 上線前請參考 docs/PRODUCTION_CHECKLIST.md 移除整個檔案及相關引用。
 */

/**
 * 測試 TN 前綴清單（大小寫不敏感）。
 * 任何以這些字串開頭的 TN 都視為測試券號。
 */
const TEST_TN_PREFIXES: readonly string[] = [];

/**
 * 完整列舉的測試 TN（個別白名單）。
 * 列在這裡的券號可以重複輸入而不被擋下。
 */
const TEST_TN_LIST: readonly string[] = [
  "YA2101223581",
];

/**
 * 判斷某個 TN 是否屬於測試券號（可重複輸入）。
 */
export function isTestTn(tn: string): boolean {
  const upper = tn.toUpperCase();
  if (TEST_TN_LIST.includes(upper)) return true;
  return TEST_TN_PREFIXES.some((p) => upper.startsWith(p.toUpperCase()));
}
