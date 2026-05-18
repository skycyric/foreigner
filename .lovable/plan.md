## 背景與大原則

確認重點：
- **上線前就會搬到公司內網**（參考 everrich-group 那種靜態頁 + 公司 API 的架構）
- **後端 API 由公司提供**，我們現在用的 Supabase 只是「過渡期暫存」
- 結論：**現在每多依賴 Supabase 一個欄位 / 一條 RLS / 一個 server function，搬遷時就多一份工**

所以這次調整不只解決 `/coupons`，而要同步立一個原則：**所有對外資料存取走 `src/lib/api.ts` 單一抽象層**，未來搬家時只改這一個檔案的實作（Supabase client → fetch 公司 API），UI 完全不用動。

---

## 本次要做的事

### 1. `/coupons` 頁：完全脫離資料庫

3 組券號（`97E51126A6002000` / `97E51126A1008000` / `97E51126F1003000`）是**固定活動資產**，不是使用者資料 → 寫死在前端常數，搬家時直接跟著前端走，零成本。

| 動作 | 細節 |
|---|---|
| 新增 `src/lib/coupons.ts` | export 3 組常數：`{ serialnum, name, description }`，名稱/描述放 i18n key |
| 改寫 `src/routes/$lang.coupons.tsx` | 移除 SSR loader、`getStoredEmail` redirect、`api.getMyCoupons`、MOCK、快取邏輯。所有訪客直接看到 3 張 QR 卡 |
| QR 套件 | `bun remove jsbarcode` + `bun add qrcode @types/qrcode`；用 `QRCode.toDataURL(serialnum, { errorCorrectionLevel: "H", margin: 2, width: 256 })`，跟行銷原圖一致 |
| 刪除 `src/lib/coupons.functions.ts` | 整檔刪掉（`listAvailableCoupons` / `claimCoupon` / `markCouponUsed` 都不需要） |
| 刪除 `api.getMyCoupons` | 從 `src/lib/api.ts` 移除 |
| DB migration | `DROP TABLE public.coupons`（含 RLS、CHECK） |
| i18n | `zh/en/ja/ko.json` 各加 3 組券名與描述 key |

`/coupons` 頁保留的元素：頁面標題、3 張 QR 卡片、「去掃 TN 抽獎」「手動輸入 TN」「中獎名單」三個導航 CTA。**移除**：email 顯示、「更換 email」按鈕、welcome redirect。

### 2. 為搬遷預先抽象（不大改、只立規矩）

不重寫現有程式，但建立 1 個檔案＋ 1 個文件，讓後續搬遷有明確切換點：

| 檔案 | 內容 |
|---|---|
| `src/lib/api.ts`（既有，補註解） | 在檔頭加註：「**所有資料存取唯一入口；搬遷到公司 API 時只改此檔內部實作**」。確認所有 UI 元件都只 import `api.xxx()`，不直接 import `supabase` client |
| `docs/MIGRATION_PLAN.md`（新增） | 一頁說明：未來搬到內網時，把 `api.ts` 的 Supabase 呼叫換成 `fetch(COMPANY_API_BASE + ...)`；列出目前用到的 4 個方法（`getOrCreateParticipant` / `submitLotteryEntry` / `getWinners` / 已移除的 coupons）對應未來公司 API 預期 endpoint |
| `docs/DATABASE_SCHEMA.md` | 移除整個 `coupons` 章節；coupons 改記載於「前端常數，非資料庫」一節 |

> ⚠️ 這次**不**動 `participants` / `lottery_entries` / `winners` 三張表的結構，那是下一階段（拿到公司 API spec 後）才一次搬。本回合只清乾淨 coupons + 立好規矩。

---

## 技術細節

### `src/lib/coupons.ts`（新檔）

```ts
export interface ActivityCoupon {
  serialnum: string;
  nameKey: string;        // i18n key, e.g. "coupons.items.welcome.name"
  descriptionKey: string;
}

export const ACTIVITY_COUPONS: readonly ActivityCoupon[] = [
  { serialnum: "97E51126A6002000", nameKey: "coupons.items.a6.name", descriptionKey: "coupons.items.a6.desc" },
  { serialnum: "97E51126A1008000", nameKey: "coupons.items.a1.name", descriptionKey: "coupons.items.a1.desc" },
  { serialnum: "97E51126F1003000", nameKey: "coupons.items.f1.name", descriptionKey: "coupons.items.f1.desc" },
] as const;
```

### QR 渲染元件

```tsx
function CouponQR({ value }: { value: string }) {
  const [src, setSrc] = useState<string>("");
  useEffect(() => {
    QRCode.toDataURL(value, { errorCorrectionLevel: "H", margin: 2, width: 320 })
      .then(setSrc).catch(console.error);
  }, [value]);
  return <img src={src} alt={value} className="mx-auto w-64 h-64" />;
}
```

### DB migration

```sql
DROP TABLE IF EXISTS public.coupons CASCADE;
```
（無 FK 指向它，CASCADE 是保險）

---

## 確認後我會：
1. 跑 migration（會跳審核視窗）
2. 安裝 `qrcode`、移除 `jsbarcode`
3. 一次把 `coupons.ts`、`$lang.coupons.tsx`、i18n、文件改完
4. 刪除 `coupons.functions.ts` 與 `api.getMyCoupons`

要我直接開工嗎？或者要先補 `MIGRATION_PLAN.md` 給你看內容再決定？
