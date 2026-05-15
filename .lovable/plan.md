# 登入判斷改為 Cookie 為主

## 目標
判定「使用者是否已留過 email」改成以 **cookie 為單一信號源**，localStorage 僅作備援；device_id 行為完全不變（仍同步寫 localStorage + cookie，註冊時送往後端）。

## 改動範圍

### 1. `src/lib/identity.ts`
- 新增 `getCookie(name)` helper（讀 `document.cookie`）。
- `setStoredEmail(email)`：保留現行「同步寫 cookie + localStorage」。
- `clearStoredEmail()`：同時清 cookie + localStorage（已是現狀）。
- **`getStoredEmail()` 改為**：
  1. 先讀 cookie `lucky_email`，有就回傳。
  2. 沒有 cookie 才 fallback 到 `localStorage`；若 localStorage 有但 cookie 沒有，順手把 cookie 補回去（修舊使用者）。
  3. 兩邊都沒有 → `null`。
- SSR safe：`typeof document === "undefined"` 時直接回 `null`。

### 2. device_id：不動
- `getDeviceId()` 維持 localStorage + cookie 雙寫。
- `welcome.tsx` 註冊時仍呼叫 `getDeviceId()` 一起送 `api.getOrCreateParticipant`。
- 後端 `participants.device_id` 欄位、index、schema 文件都不動。

### 3. 不需要改的檔案（確認過）
- `src/routes/$lang.index.tsx`、`src/routes/$lang.welcome.tsx`：已透過 `getStoredEmail()` 判斷，函式內部改完即可。
- `src/lib/server-identity.ts`：SSR 本來就讀 cookie，符合新規則。
- `src/lib/api.ts`、coupons / lottery 流程：無關。

## 行為變化
- 使用者清 cookie 但沒清 localStorage → 第一次仍判定為已登入（從 localStorage fallback 回填 cookie）。符合「cookie 為主、localStorage 備援」語意。
- 使用者清 localStorage 但 cookie 還在 → 視為已登入（cookie 優先）。
- 兩個都清 → 視為新使用者，回到 `/welcome`。
- SSR 端行為不變（本來就只看 cookie）。

## 風險
- 低。純前端讀寫邏輯調整，不動 schema、不動 API、不動路由結構。
