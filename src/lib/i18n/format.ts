import { INTL_LOCALE, type Locale } from "./config";
import { getDictionary } from "./dictionary";
import { fmt } from "./define";

export function formatDateTime(value: string | null | undefined, locale: Locale): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat(INTL_LOCALE[locale], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
}

export function formatRelative(value: string | null | undefined, locale: Locale, now = Date.now()): string {
  if (!value) return "—";
  const t = getDictionary(locale).common.time;
  const seconds = Math.round((now - new Date(value).getTime()) / 1000);
  if (seconds < 45) return t.justNow;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return fmt(t.minutesAgo, { n: minutes });
  const hours = Math.round(minutes / 60);
  if (hours < 24) return fmt(t.hoursAgo, { n: hours });
  const days = Math.round(hours / 24);
  if (days < 30) return fmt(t.daysAgo, { n: days });
  return formatDateTime(value, locale);
}
