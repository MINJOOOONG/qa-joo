import Link from "next/link";
import { SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getI18n } from "@/lib/i18n/server";

/** Localized 404 body with a way back to the project list. */
export async function NotFoundContent() {
  const { t } = await getI18n();
  const l = t.common.notFound;
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-4 py-24 text-center" data-testid="not-found">
      <SearchX className="size-8 text-muted-foreground" />
      <h1 className="text-lg font-semibold tracking-tight">{l.title}</h1>
      <p className="max-w-md text-[13px] text-muted-foreground">{l.description}</p>
      <Button asChild className="mt-2">
        <Link href="/projects">{l.back}</Link>
      </Button>
    </div>
  );
}
