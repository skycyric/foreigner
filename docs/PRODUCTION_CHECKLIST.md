# 上線前清單（Production Checklist）

部署正式環境前，**必須**完成以下所有項目。

---

## 1. 移除測試模式

開發階段為了能反覆掃同一張紙本 QR 測試，加入了「TN 自動加時間後綴」的機制。
正式上線前必須完整移除，避免測試資料污染正式 DB。

### 1.1 刪除測試模式檔案
```
src/lib/test-mode.ts
```
直接刪除整個檔案。

### 1.2 修改 `src/lib/api.ts`
- 移除最上方的 `import { IS_TEST_MODE } from "./test-mode";`
- 在 `submitLotteryEntry` 中，把這段：
  ```ts
  const tnToInsert = IS_TEST_MODE ? `${input.tn}__t${Date.now()}` : input.tn;
  // ...
  tn_number: tnToInsert,
  ```
  改回：
  ```ts
  tn_number: input.tn,
  ```

### 1.3 修改 `src/routes/$lang.result.tsx`
- 移除 `const displayTn = tn.split("__t")[0];`
- 把畫面上的 `{displayTn}` 改回 `{tn}`

---

## 2. 清理測試資料（SQL）

**⚠️ 請在正式 DB 執行一次**，清掉所有 dev 階段累積的測試單號：

```sql
DELETE FROM lottery_entries WHERE tn_number LIKE '%\_\_t%' ESCAPE '\';
```

說明：dev 模式下單號會被加上 `__t{timestamp}` 後綴，這條 SQL 會把所有此類測試資料全部刪除，正式單號（格式如 `AB1234567890`）不會被影響。

---

## 3. 驗證

1. 執行 `npm run build`（或 production build 指令），確認沒有 import error
2. 在 production 環境掃一筆真實 QR，到 DB 查詢 `lottery_entries`，確認 `tn_number` 沒有 `__t` 後綴
3. 嘗試重複掃同一張 → 應該要顯示「已使用」訊息（代表測試模式已正確關閉）

---

## 4. 其他建議檢查項目

未來若有更多上線注意事項，請追加到此處：

- [ ] 關閉所有 `console.log` debug 訊息
- [ ] 確認 Lovable Cloud / Supabase 的 RLS policies 都已設定正確
- [ ] 確認 secrets / API keys 都已正確設定，沒有寫死在程式碼中
- [ ] 確認 i18n 各語言翻譯檔都已補完
