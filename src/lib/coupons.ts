/**
 * 活動固定發放的 3 張優惠券。
 *
 * 為什麼是常數而不是資料表？
 *   - 券號為行銷預先生成的固定資產，每位參加者拿到的都一樣
 *   - POS 端用條碼掃描器讀 QR Code 即可，本系統不需要記錄誰用了哪張券
 *   - 搬遷到公司內網時跟著前端走，零資料庫成本
 *
 * QR Code payload 為純 16 碼券號（已實測與行銷原 QR 一致）。
 */
export interface ActivityCoupon {
  serialnum: string;
  nameKey: string;
  descriptionKey: string;
}

export const ACTIVITY_COUPONS: readonly ActivityCoupon[] = [
  {
    serialnum: "97E51126A6002000",
    nameKey: "coupons.items.a6.name",
    descriptionKey: "coupons.items.a6.desc",
  },
  {
    serialnum: "97E51126A1008000",
    nameKey: "coupons.items.a1.name",
    descriptionKey: "coupons.items.a1.desc",
  },
  {
    serialnum: "97E51126F1003000",
    nameKey: "coupons.items.f1.name",
    descriptionKey: "coupons.items.f1.desc",
  },
] as const;