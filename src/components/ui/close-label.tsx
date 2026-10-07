"use client";

import { useI18n } from "@/lib/i18n/client";

/** Localized screen-reader label for dialog/sheet close buttons. */
export function CloseLabel() {
  return <>{useI18n().t.common.close}</>;
}
