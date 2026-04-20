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
 *
 * 範例：
 *   "TT" → 所有以 TT 開頭的券號都是測試券（TT0000000001、TT9999999999...）
 *   "ZZ0000" → 更精確：只有 ZZ0000xxxxxx 才算測試
 */
const TEST_TN_PREFIXES = ["TT", "ZZ"];

/**
 * 完整列舉的測試 TN（除了前綴外的個別白名單）。
 * 若需要把某個既存券號設為「可重複測試」，加進這裡。
 */
const TEST_TN_LIST: readonly string[] = [
  // 範例：
  // "YA2101223580",
];

/**
 * 判斷某個 TN 是否屬於測試券號（可重複輸入）。
 */
export function isTestTn(tn: string): boolean {
  const upper = tn.toUpperCase();
  if (TEST_TN_LIST.includes(upper)) return true;
  return TEST_TN_PREFIXES.some((p) => upper.startsWith(p.toUpperCase()));
}
