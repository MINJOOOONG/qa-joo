import type { Locale } from "./config";
import { activity } from "./messages/activity";
import { auth } from "./messages/auth";
import { automation } from "./messages/automation";
import { cases } from "./messages/cases";
import { common } from "./messages/common";
import { dashboard } from "./messages/dashboard";
import { enums } from "./messages/enums";
import { projects } from "./messages/projects";
import { review } from "./messages/review";
import { runs } from "./messages/runs";
import { server } from "./messages/server";
import { settings } from "./messages/settings";
import { shell } from "./messages/shell";

const NAMESPACES = { activity, auth, automation, cases, common, dashboard, enums, projects, review, runs, server, settings, shell };

type Namespaces = typeof NAMESPACES;
/** The full message tree for one locale (English shape; Korean has identical keys). */
export type Dictionary = { [K in keyof Namespaces]: Namespaces[K]["en"] };

const cache = new Map<Locale, Dictionary>();

export function getDictionary(locale: Locale): Dictionary {
  let dictionary = cache.get(locale);
  if (!dictionary) {
    dictionary = Object.fromEntries(
      Object.entries(NAMESPACES).map(([name, messages]) => [name, messages[locale]]),
    ) as Dictionary;
    cache.set(locale, dictionary);
  }
  return dictionary;
}
