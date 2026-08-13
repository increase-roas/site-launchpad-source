import { ChevronRight, Home } from "lucide-react";

export function WorkspaceBreadcrumbs({ items }: { items: string[] }) {
  return (
    <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5 text-sm font-bold text-muted-foreground">
      <Home className="h-4 w-4 shrink-0" aria-hidden="true" />
      {items.map((item, index) => (
        <span key={`${item}-${index}`} className="flex min-w-0 items-center gap-1.5">
          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-white/20" aria-hidden="true" />
          <span className={index === items.length - 1 ? "truncate text-foreground" : "truncate"}>
            {item}
          </span>
        </span>
      ))}
    </nav>
  );
}
