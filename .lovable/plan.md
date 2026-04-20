

## 簡化測試模式 + 上線清理提醒文件

### 做法

1. **`src/lib/test-mode.ts`**（新增，1 行）
   ```ts
   export const IS_TEST_MODE = import.meta.env.DEV;
   ```

2. **`src/lib/api.ts`**（改 1 行 + 加 import）
   - import `IS_TEST_MODE`
   - `submitLotteryEntry` insert 前：
     ```ts
     const tnToInsert = IS_TEST_MODE ? `${input.tn}__t${Date.now()}` : input.tn;
     ```
   - 把 `tn_number: input.tn` 換成 `tn_number: tnToInsert`

3. **`src/routes/$lang.result.tsx`**（改 1 行）
   - 顯示時：`const displayTn = tn.split("__t")[0];`
   - 把畫面上 `{tn}` 換成 `{displayTn}`

4. **`docs/PRODUCTION_CHECKLIST.md`**（新增，重點提醒文件）
   - 標題：上線前清單
   - 必做項目：
     - 刪 `src/lib/test-mode.ts`
     - `src/lib/api.ts` 拔掉 `IS_TEST_MODE` 三元判斷與 import
     - `src/routes/$lang.result.tsx` 把 `displayTn` 改回 `tn`
     - **執行 SQL 清理測試資料**（用程式碼區塊清楚標示）：
       ```sql
       DELETE FROM lottery_entries WHERE tn_number LIKE '%\_\_t%' ESCAPE '\';
       ```
     - 驗證 production build 不再產生 `__t` 後綴單號
   - 放在 docs/ 目錄方便日後查找

### 檔案影響
- 新增：`src/lib/test-mode.ts`、`docs/PRODUCTION_CHECKLIST.md`
- 修改：`src/lib/api.ts`、`src/routes/$lang.result.tsx`

### 為什麼用 docs/ 不用 README
- README 是給新進開發者看專案總覽
- 上線清單是一次性 checklist，獨立檔案更清楚不會被淹沒
- 之後若有更多上線注意事項（例如關 console.log、檢查 secret），同一份文件繼續累積

