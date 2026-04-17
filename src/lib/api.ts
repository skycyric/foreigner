/**
 * API 抽象層 — 集中所有後端呼叫。
 *
 * 預設使用 Lovable Cloud (Supabase)。日後切換到貴司自家後端時，
 * 只需要把每個方法的實作換成 `fetch(import.meta.env.VITE_API_BASE_URL + ...)` 即可，
 * 元件層不需要修改。
 */
import { supabase } from "@/integrations/supabase/client";

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

export interface LookupResult {
  found: boolean;
  alreadyUsed: boolean;
  amount?: number;
  date?: string;
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

  /** Lookup transaction in valid_transactions and check if already used in lottery_entries. */
  async lookupTransaction(input: { tn: string }): Promise<LookupResult> {
    if (USE_REMOTE_API) {
      return remote(`/lottery/lookup?tn=${encodeURIComponent(input.tn)}`);
    }
    const [{ data: txn }, { data: entry }] = await Promise.all([
      supabase
        .from("valid_transactions")
        .select("amount, txn_date")
        .eq("tn_number", input.tn)
        .maybeSingle(),
      supabase
        .from("lottery_entries")
        .select("id")
        .eq("tn_number", input.tn)
        .maybeSingle(),
    ]);
    return {
      found: !!txn,
      alreadyUsed: !!entry,
      amount: txn?.amount ? Number(txn.amount) : undefined,
      date: txn?.txn_date ?? undefined,
    };
  },

  async submitLotteryEntry(input: {
    tn: string;
    email: string;
    raw_payload?: string;
    source: "manual" | "qr";
  }): Promise<{ id: string }> {
    if (USE_REMOTE_API) {
      return remote("/lottery/submit", { method: "POST", body: JSON.stringify(input) });
    }
    const { data, error } = await supabase
      .from("lottery_entries")
      .insert({
        tn_number: input.tn,
        email: input.email,
        raw_payload: input.raw_payload ?? null,
        source: input.source,
      })
      .select("id")
      .single();
    if (error) throw error;
    return { id: data.id };
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
