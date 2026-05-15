/**
 * 票券中台對接 server functions（骨架）
 *
 * ⚠️ 目前為 mock 實作。等票券中台 API 規格確認後，
 * 把 fetch 對應到 process.env.COUPON_MIDDLEWARE_BASE_URL，
 * 並用 process.env.COUPON_MIDDLEWARE_API_KEY 認證。
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/** 16 碼券碼格式：[Leading 2 數字][W/E/R][1-7][12 數字]
 *  = 2 leading + 1 source + 1 category + 2 type_serial + 9 serial + 1 check
 */
const COUPON_CODE_REGEX = /^[0-9]{2}[WER][1-7][0-9]{12}$/;

export interface AvailableCoupon {
  template_id: string;
  name: string;
  description: string;
  issue_source: "W" | "E" | "R";
  usage_category: string;
}

/**
 * 列出該 email 在票券中台「可領」的券（尚未領取）
 * TODO: 改為呼叫 GET {COUPON_MIDDLEWARE_BASE_URL}/coupons/available?email=...
 */
export const listAvailableCoupons = createServerFn({ method: "GET" })
  .inputValidator(z.object({ email: z.string().email() }).parse)
  .handler(async ({ data: _data }): Promise<AvailableCoupon[]> => {
    return [
      {
        template_id: "tpl_w101",
        name: "會員酬賓 85 折券",
        description: "iRich CRM 會員專屬",
        issue_source: "W",
        usage_category: "1",
      },
      {
        template_id: "tpl_e201",
        name: "活動 9 折券",
        description: "幸運抽獎活動專屬",
        issue_source: "E",
        usage_category: "2",
      },
    ];
  });

/**
 * 領取一張券：呼叫中台拿到 16 碼 → INSERT 到本地 coupons 表
 * TODO: 改為呼叫 POST {COUPON_MIDDLEWARE_BASE_URL}/coupons/claim
 */
export const claimCoupon = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      email: z.string().email(),
      template_id: z.string().min(1).max(64),
    }).parse,
  )
  .handler(async ({ data }) => {
    // === Mock：產生符合 16 碼格式的測試碼 ===
    const mockSource = data.template_id.includes("w") ? "W" : "E";
    const mockCategory = data.template_id.includes("w") ? "1" : "2";
    const serial = String(Date.now()).slice(-9).padStart(9, "0");
    // 99 (2) + source (1) + category (1) + 01 type_serial (2) + serial (9) + 0 check (1) = 16
    const couponCode =
      "99" + mockSource + mockCategory + "01" + serial + "0";

    if (!COUPON_CODE_REGEX.test(couponCode)) {
      throw new Error("INVALID_COUPON_CODE_FORMAT");
    }

    const { error } = await supabaseAdmin.from("coupons").insert({
      coupon_code: couponCode,
      email: data.email,
    });
    if (error) throw new Error(error.message);

    return { coupon_code: couponCode };
  });

/**
 * 標記券已使用（中台 webhook 或定期同步使用）
 */
export const markCouponUsed = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      coupon_code: z.string().regex(COUPON_CODE_REGEX),
      used_at: z.string().datetime().optional(),
    }).parse,
  )
  .handler(async ({ data }) => {
    const { error } = await supabaseAdmin
      .from("coupons")
      .update({ used_at: data.used_at ?? new Date().toISOString() })
      .eq("coupon_code", data.coupon_code);
    if (error) throw new Error(error.message);
    return { ok: true };
  });