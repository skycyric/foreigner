/**
 * API 層 — 對接昇恆昌活動後端 `POST /landing/eventpost.php`（same-origin）。
 *
 * 部署假設：前端打包後與後端同網域（例：events.everrich-group.com/luckydraw*），
 * 所以這裡直接打相對路徑 `/landing/eventpost.php`，不處理 CORS。
 *
 * 後端不回 status code、不檢查重複，因此：
 *   - 成功判定：HTTP 2xx
 *   - 重複登錄：前端用 localStorage 黑名單擋
 */
import { toEverrichLang } from "./lang-map";
import type { Lang } from "./i18n";

/** 交易單號格式 */
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

const ENDPOINT = "/landing/eventpost.php";
const EVENT_NAME = "EmailLuckyDraw2026";
const USED_TNS_KEY = "lucky_used_tns";

function readUsedTns(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(USED_TNS_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? arr.map(String) : []);
  } catch {
    return new Set();
  }
}

function writeUsedTns(set: Set<string>): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(USED_TNS_KEY, JSON.stringify([...set]));
  } catch {
    /* ignore */
  }
}

function markTnUsed(tn: string): void {
  const s = readUsedTns();
  s.add(tn.toUpperCase());
  writeUsedTns(s);
}

function isTnUsed(tn: string): boolean {
  return readUsedTns().has(tn.toUpperCase());
}

export const api = {
  /**
   * 送出抽獎登錄。
   * - HTTP 2xx → 視為成功
   * - 命中 localStorage 黑名單 → 直接回 alreadyUsed
   */
  async submitEntry(input: {
    email: string;
    tn: string;
    lang: Lang;
  }): Promise<{ alreadyUsed?: boolean }> {
    if (!isValidTnFormat(input.tn)) {
      throw new InvalidTnError();
    }
    if (isTnUsed(input.tn)) {
      return { alreadyUsed: true };
    }

    const uploadData = JSON.stringify({
      Email: input.email,
      NoteText: input.tn,
    });

    const body = new URLSearchParams({
      lang_type: toEverrichLang(input.lang),
      eventName: EVENT_NAME,
      upload_data: uploadData,
    });

    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });

    if (!res.ok) {
      throw new Error(`API ${res.status}`);
    }

    markTnUsed(input.tn);
    return {};
  },
};