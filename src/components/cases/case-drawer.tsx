"use client";

import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n/client";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";

/** Server-rendered case detail shown in a drawer; closing it drops `?case=` from the URL. */
export function CaseDrawer({ closeHref, title, children }: { closeHref: string; title: string; children: React.ReactNode }) {
  const router = useRouter();
  const { t } = useI18n();
  return (
    <Sheet open onOpenChange={(open) => !open && router.replace(closeHref, { scroll: false })}>
      <SheetContent aria-describedby={undefined}>
        <SheetTitle className="sr-only">{title}</SheetTitle>
        <SheetDescription className="sr-only">{t.cases.explorer.drawerDescription}</SheetDescription>
        <div className="flex-1 overflow-y-auto p-5 pt-10">{children}</div>
      </SheetContent>
    </Sheet>
  );
}
