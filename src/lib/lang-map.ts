import type { Lang } from "./i18n";

/** 把前端語言碼對應到 everrich 後端 lang_type */
export function toEverrichLang(lang: Lang): "tw" | "en" | "jp" | "kr" {
  switch (lang) {
    case "zh":
      return "tw";
    case "ja":
      return "jp";
    case "ko":
      return "kr";
    case "en":
    default:
      return "en";
  }
}