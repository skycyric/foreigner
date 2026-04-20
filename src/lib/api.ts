/**
 * API 抽象層 — 集中所有後端呼叫。
 *
 * 預設使用 Lovable Cloud (Supabase)。日後切換到貴司自家後端時，
 * 只需要把每個方法的實作換成 `fetch(import.meta.env.VITE_API_BASE_URL + ...)` 即可，
 * 元件層不需要修改。
 */
import { supabase } from "@/integrations/supabase/client";
import { isTestTn } from "./test-mode";

/**
 * TN（交易單號）格式設定 — 集中管理。
 * 未來要改長度 / 字母數 / 加破折號，只動這裡，scan / manual / API 都會跟著變。
 *
 * 範例：
 *   - 改 11 碼數字：digits: 11, pattern: /^[A-Z]{2}\d{11}$/
 *   - 改 3 碼英文：letters: 3, pattern: /^[A-Z]{3}\d{10}$/
 *   - 完全放寬：pattern: /^.+$/
 */
export const TN_FORMAT = {
  letters: 2,
  digits: 10,
  pattern: /^[A-Z]{2}\d{10}$/,
};

export const isValidTnFormat = (tn: string): boolean => TN_FORMAT.pattern.test(tn);

export class InvalidTnError extends Error {
  constructor() {
    super("INVALID_TN_FORMAT");
    this.name = "InvalidTnError";
  }
}

export interface Coupon {
  coupon_code: string;
  email: string | null;
  assigned_at: string | null;
  used_at: string | null;
  note: string | null;
}

export interface Winner {
  id: string;
  prize_name: string;
  masked_email: string;
  rank: number;
  is_backup: boolean;
}

const API_BASE = import.meta.env.VITE_API_BASE_URL as string | undefined;
const USE_REMOTE_API = Boolean(API_BASE);

async function remote<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json();
}

export const api = {
  async getOrCreateParticipant(input: {
    email: string;
    device_id: string;
    language: string;
  }): Promise<{ email: string }> {
    if (USE_REMOTE_API) {
      return remote("/participants", { method: "POST", body: JSON.stringify(input) });
    }
    const { error } = await supabase
      .from("participants")
      .upsert(
        {
          email: input.email,
          device_id: input.device_id,
          language: input.language,
        },
        { onConflict: "email" },
      );
    if (error) throw error;
    return { email: input.email };
  },

  async getMyCoupons(input: { email: string }): Promise<Coupon[]> {
    if (USE_REMOTE_API) {
      return remote(`/coupons?email=${encodeURIComponent(input.email)}`);
    }
    const { data, error } = await supabase
      .from("coupons")
      .select("*")
      .eq("email", input.email);
    if (error) throw error;
    return (data ?? []) as Coupon[];
  },


  async submitLotteryEntry(input: {
    tn: string;
    email: string;
    raw_payload?: string;
    source: "manual" | "qr";
  }): Promise<{ id: string; alreadyUsed?: boolean }> {
    if (!isValidTnFormat(input.tn)) {
      throw new InvalidTnError();
    }
    if (USE_REMOTE_API) {
      return remote("/lottery/submit", { method: "POST", body: JSON.stringify(input) });
    }
    // ⚠️ TEST MODE: 只有測試 TN（白名單／前綴）才會加上時間戳後綴讓它可重複輸入；
    // 真實券號永遠走 unique 檢查。上線前請參考 docs/PRODUCTION_CHECKLIST.md 移除。
    const tnToInsert = isTestTn(input.tn) ? `${input.tn}__t${Date.now()}` : input.tn;
    const insertEntry = async () =>
      supabase
        .from("lottery_entries")
        .insert({
          tn_number: tnToInsert,
          email: input.email,
          raw_payload: input.raw_payload ?? null,
          source: input.source,
        })
        .select("id")
        .single();

    let { data, error } = await insertEntry();

    if ((error as { code?: string } | null)?.code === "23503") {
      const { error: participantError } = await supabase
        .from("participants")
        .upsert({ email: input.email }, { onConflict: "email" });

      if (!participantError) {
        const retry = await insertEntry();
        data = retry.data;
        error = retry.error;
      }
    }

    if (error) {
      // Postgres unique violation → 此單號已被登錄過
      if ((error as { code?: string }).code === "23505") {
        return { id: "", alreadyUsed: true };
      }
      throw error;
    }
    const entryId = data?.id;
    if (!entryId) {
      throw new Error("LOTTERY_ENTRY_INSERT_FAILED");
    }
    return { id: entryId };
  },

  async getWinners(): Promise<Winner[]> {
    if (USE_REMOTE_API) return remote("/winners");
    const { data, error } = await supabase
      .from("winners")
      .select("*")
      .order("rank", { ascending: true });
    if (error) throw error;
    return (data ?? []) as Winner[];
  },
};
