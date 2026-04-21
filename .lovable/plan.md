
## 修訂後的方案

依你的回覆調整：

1. **取消送出前確認 popup**（大部分人不會仔細看，反而多一步點擊摩擦）→ 改用其他方式擋 typo
2. **Custom domain 獨立成另一個輸入模式**（不混在 chip 裡）
3. **Toast + 卡片閃爍兩個都做**

---

## 一、Email 輸入頁重新設計

### 預設 UI：兩個並列的明確選擇

進入頁面時，使用者看到兩個明顯的輸入方式（Tabs 切換）：

```text
[ 快速選擇網域 ]  [ 自行輸入 Email ]
```

**分頁 A：快速選擇網域**（手機族群最快）
- account 輸入框 + `@` + 5 個常用網域 chip
- 移除原本混在 chip 裡的「+ 自訂網域」按鈕
- 文案提示：「不是常用網域？切換到『自行輸入 Email』分頁」

**分頁 B：自行輸入 Email**（autofill / 桌面族群）
- 單一個 `<input type="email" name="email" autocomplete="email" autoFocus>`
- 完全標準的 email 欄位，autofill / 密碼管理員 100% 相容
- 即時解析顯示「將以此 Email 通知您」確認卡

兩個分頁共用底下的「確認卡 + 同意條款 + 送出按鈕」。

### 強化「擷取確認卡」（取代原本灰色小字預覽）

- 大字、粗體、品牌色框線、`CheckCircle2` 圖示
- 文案：「📧 中獎將以此 Email 通知您：」
- email 完整時顯示綠色高亮 + 大字 email
- 不完整時顯示淺色 placeholder「請輸入完整的 Email」
- 置於送出按鈕正上方，使用者送出前一定會看到

### 自動填入 / 貼上的強回饋（兩個都做）

當 `handleAccountChange` 偵測到完整 email（含 `@`）：

1. **確認卡套用 1.5 秒 `animate-pulse` + 品牌色閃爍**
2. **跳出 Toast**：「已自動辨識您的 Email：xxx@yyy.com」
3. 自動 scroll 到確認卡位置（確保 autofill 後使用者看到）

如果使用者在「快速選擇網域」分頁貼上完整 email，且網域不在預設清單，**自動切換到「自行輸入 Email」分頁**並填入完整 email（不再切到 custom chip）。

### 取代「送出前確認」的防 typo 機制

由於不做 popup，改用**輸入時即時提示**：

- 偵測常見 typo 網域（`gmial.com` / `gamil.com` / `yahoo.cm` / `hotnail.com` / `outlok.com` 等）
- 在確認卡下方顯示淺色提示：「您是不是想輸入 `gmail.com`？[點此修正]」
- 點擊後一鍵替換，不打斷流程
- 維護一個小型 typo → 正確網域的 mapping table（約 15 組常見錯字）

這比 popup 更好：使用者不需要多一步點擊，但 typo 一定會被提示。

---

## 二、i18n 文案新增

`src/locales/{zh,en,ja,ko}.json` `welcome` 區塊新增：

- `tabQuick`：「快速選擇網域」
- `tabFull`：「自行輸入 Email」
- `notifyAt`：「中獎將以此 Email 通知您」
- `placeholder`：「請輸入完整的 Email」
- `autofilled`：「已自動辨識您的 Email」
- `typoSuggestion`：「您是不是想輸入 {{domain}}？」
- `typoFix`：「點此修正」
- `fullEmailLabel`：「Email 地址」
- `notCommonDomain`：「不是常用網域？切換到「自行輸入 Email」」

---

## 三、修改檔案清單

- `src/routes/$lang.welcome.tsx`（主要改動：加 Tabs、確認卡升級、typo 偵測、autofill toast/閃爍、scroll、移除 chip 內 custom 按鈕）
- `src/locales/zh.json`、`en.json`、`ja.json`、`ko.json`（新增 9 個 key）

需引入 `@/components/ui/tabs`（已存在）、`lucide-react` 的 `CheckCircle2`、`AlertCircle`。

---

## 四、不會動到的部分

- `getOrCreateParticipant` API 邏輯
- `LoadingOverlay` 流程（保留現有）
- `getDeviceId` / `setStoredEmail`
- 路由結構、其他頁面
