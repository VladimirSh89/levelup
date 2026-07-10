import type { Request } from "express";
import { Locale } from "@prisma/client";

export type { Locale };

/**
 * Resolve the request locale from (in priority order):
 * 1. `?locale=en|ru` query param
 * 2. `Accept-Language` header (first tag, `ru*` → ru)
 * 3. `en` default
 */
export function parseLocale(req: Request): Locale {
  const query = req.query.locale;
  if (query === "en" || query === "ru") return query;

  const header = req.headers["accept-language"];
  const raw = Array.isArray(header) ? header[0] : header;
  if (typeof raw === "string" && raw.trim()) {
    const first = raw.split(",")[0]?.trim().toLowerCase() ?? "";
    if (first.startsWith("ru")) return Locale.ru;
  }

  return Locale.en;
}

/** Pick the localized field, e.g. `pickLocale(locale, service.nameEn, service.nameRu)`. */
export function pickLocale<T>(locale: Locale, en: T, ru: T): T {
  return locale === Locale.ru ? ru : en;
}
