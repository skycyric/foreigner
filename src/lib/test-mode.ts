/**
 * 測試模式旗標 — dev 環境自動開啟，正式 build 自動關閉。
 *
 * ⚠️ 上線前請參考 docs/PRODUCTION_CHECKLIST.md 移除此檔案及相關引用。
 */
export const IS_TEST_MODE = import.meta.env.DEV;
