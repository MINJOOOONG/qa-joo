import type { ReactNode } from "react";

export function PageHeader({
  title,
  description,
  actions,
  eyebrow,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  eyebrow?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4 border-b px-4 py-4 sm:px-6">
      <div className="min-w-0">
        {eyebrow ? <div className="mb-1 text-xs text-muted-foreground">{eyebrow}</div> : null}
        <h1 className="truncate whitespace-nowrap text-lg font-semibold tracking-tight">{title}</h1>
        {description ? <p className="mt-0.5 text-[13px] text-muted-foreground">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function SectionTitle({ children, actions }: { children: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2 pb-2">
      <h2 className="text-[13px] font-semibold">{children}</h2>
      {actions}
    </div>
  );
}
