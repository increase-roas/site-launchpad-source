import { Lock } from "lucide-react";

/**
 * Marks a designed-but-inert surface. Publishing, Cloudflare provisioning, and
 * customer GitHub are out of scope for this phase, and some stores (audit trail,
 * team membership) do not exist yet — these screens say so rather than present
 * placeholder data as if it were real.
 */
export function DeferredNotice({
  title,
  reason,
  planned,
}: {
  title: string;
  reason: string;
  planned?: readonly string[];
}) {
  return (
    <div className="rounded-lg border border-dashed border-border bg-card p-5">
      <div className="flex items-start gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
          <Lock className="h-4 w-4" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold">{title}</p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{reason}</p>
          {planned && planned.length > 0 ? (
            <>
              <p className="mt-3 text-xs font-semibold text-foreground">
                Planned for this screen
              </p>
              <ul className="mt-1.5 space-y-1">
                {planned.map(item => (
                  <li
                    key={item}
                    className="flex items-start gap-2 text-xs text-muted-foreground"
                  >
                    <span
                      aria-hidden="true"
                      className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-muted-foreground/50"
                    />
                    {item}
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
