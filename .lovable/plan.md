
## 讓 TN 格式可調整

把格式規則集中在一個地方，未來要改長度、改字母數、或加破折號都只動一行。

### 做法

在 `src/lib/api.ts` 頂部宣告一個 `TN_FORMAT` 設定物件：

```ts
export const TN_FORMAT = {
  pattern: /^[A-Z]{2}\d{10}$/,  // 目前：2 字母 + 10 數字
  letters: 2,
  digits: 10,
};
export const isValidTnFormat = (tn: string) => TN_FORMAT.pattern.test(tn);
```

未來要改：
- 改成 11 碼 → `\d{10}` 改 `\d{11}`，`digits: 11`
- 改成 3 字母 → `[A-Z]{2}` 改 `[A-Z]{3}`，`letters: 3`
- 想完全放寬 → `pattern: /^.+$/`
- 完全不驗證 → `submitLotteryEntry` 開頭那行 `if (!isValidTnFormat(tn))` 註解掉

### 影響的檔案
1. **`src/lib/api.ts`** — 加 `TN_FORMAT` + `isValidTnFormat`，`submitLotteryEntry` 開頭驗證，不過就 throw
2. **`src/routes/$lang.scan.tsx`** — `processDecodedText` 取出 TN 後呼叫 `isValidTnFormat`，不合格 toast 提示重掃，不寫 DB
3. **`src/routes/$lang.manual.tsx`** — 改用 `isValidTnFormat`（取代目前寫死的 regex），並用 `TN_FORMAT.letters / digits` 動態設 `maxLength` 和 placeholder，這樣未來改設定 UI 也跟著變
4. **`src/locales/{zh,en,ja,ko}.json`** — 新增 `scan.invalidFormat`：「無效的 QR Code 格式」/「Invalid QR code format」等

### 好處
- 規則只有一份，三個地方（API / 掃描 / 手動）都吃同一份設定
- 改規則不用動 UI，連 placeholder 跟輸入框長度都自動跟上
- 想暫時關掉驗證也只要改一行
