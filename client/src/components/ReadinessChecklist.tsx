import { ReadinessBar } from "./ReadinessBar";

type ChecklistItem = {
  key: string;
  label: string;
  complete: boolean;
  group: "details" | "photos" | "setup";
};

type ReadinessChecklistProps = {
  items: ChecklistItem[];
  completed: number;
  total: number;
  percent: number;
};

const groupLabels = {
  details: "Client details",
  photos: "Logo and photos",
  setup: "Technical Setup (ask Alex)",
};

export function ReadinessChecklist({
  items,
  completed,
  total,
  percent,
}: ReadinessChecklistProps) {
  return (
    <section className="rounded-3xl border border-white/8 bg-card/95 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.24)] sm:p-6">
      <div>
        <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-cyan-300">
          Launch checklist
        </p>
        <h2 className="mt-2 text-2xl font-extrabold tracking-tight">What is left?</h2>
      </div>

      <div className="mt-5">
        <ReadinessBar percent={percent} completed={completed} total={total} size="large" />
      </div>

      <div className="mt-6 space-y-6">
        {(["details", "photos", "setup"] as const).map(group => {
          const groupItems = items.filter(item => item.group === group);
          return (
            <div key={group}>
              <h3 className="mb-2.5 text-sm font-extrabold text-foreground">
                {groupLabels[group]}
              </h3>
              <div className="space-y-2">
                {groupItems.map(item => (
                  <div
                    key={item.key}
                    className="flex items-center gap-3 rounded-xl bg-white/[0.025] px-3 py-2.5"
                  >
                    <span className="text-base" aria-hidden="true">
                      {item.complete ? "✅" : "❌"}
                    </span>
                    <span
                      className={
                        item.complete
                          ? "text-sm font-bold text-foreground"
                          : "text-sm font-bold text-muted-foreground"
                      }
                    >
                      {item.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
