import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import type { BusinessDay, BusinessHour } from "@shared/client";

const DAY_LABELS: Record<BusinessDay, string> = {
  monday: "Monday",
  tuesday: "Tuesday",
  wednesday: "Wednesday",
  thursday: "Thursday",
  friday: "Friday",
  saturday: "Saturday",
  sunday: "Sunday",
};

const TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

const COLUMNS: { heading: string; align?: "right" }[] = [
  { heading: "Day" },
  { heading: "Status" },
  { heading: "Opens" },
  { heading: "Closes" },
  { heading: "Span", align: "right" },
];

/**
 * The span column is the point of the table: a mistyped 09:00-19:00 reads as
 * 10h against a column of 8h, which the previous per-day card list could not show.
 */
export function hoursSpanLabel(hour: BusinessHour): string {
  if (!hour.isOpen) return "—";
  if (!TIME_PATTERN.test(hour.opensAt) || !TIME_PATTERN.test(hour.closesAt)) return "—";
  const [openHour, openMinute] = hour.opensAt.split(":").map(Number);
  const [closeHour, closeMinute] = hour.closesAt.split(":").map(Number);
  const minutes = closeHour * 60 + closeMinute - (openHour * 60 + openMinute);
  if (minutes <= 0) return "—";
  const wholeHours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder ? `${wholeHours}h ${remainder}m` : `${wholeHours}h`;
}

export function HoursTable({
  hours,
  onChange,
}: {
  hours: BusinessHour[];
  onChange: (next: BusinessHour[]) => void;
}) {
  const updateDay = (index: number, patch: Partial<BusinessHour>) =>
    onChange(hours.map((hour, position) => (position === index ? { ...hour, ...patch } : hour)));

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-left">
        <thead>
          <tr className="bg-muted">
            {COLUMNS.map(column => (
              <th
                key={column.heading}
                className={cn(
                  "border-b border-border px-4 py-2 text-xs font-semibold text-muted-foreground",
                  column.align === "right" && "text-right",
                )}
              >
                {column.heading}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {hours.map((hour, index) => (
            <tr
              key={hour.day}
              className={cn(
                "border-b border-border/60 last:border-b-0",
                index % 2 === 1 && "bg-muted/40",
              )}
            >
              <td className="px-4 py-2 text-sm font-medium">{DAY_LABELS[hour.day]}</td>
              <td className="px-4 py-2">
                <span className="flex items-center gap-2">
                  <Switch
                    checked={hour.isOpen}
                    aria-label={`${DAY_LABELS[hour.day]} open`}
                    onCheckedChange={isOpen =>
                      updateDay(index, {
                        isOpen,
                        opensAt: isOpen ? hour.opensAt || "09:00" : "",
                        closesAt: isOpen ? hour.closesAt || "17:00" : "",
                      })
                    }
                  />
                  <span
                    className={cn(
                      "text-sm",
                      hour.isOpen ? "font-medium" : "text-muted-foreground",
                    )}
                  >
                    {hour.isOpen ? "Open" : "Closed"}
                  </span>
                </span>
              </td>
              <td className="px-4 py-2">
                <Input
                  type="time"
                  aria-label={`${DAY_LABELS[hour.day]} opens`}
                  disabled={!hour.isOpen}
                  value={hour.opensAt}
                  onChange={event => updateDay(index, { opensAt: event.target.value })}
                  className="w-[130px] text-sm tabular-nums"
                />
              </td>
              <td className="px-4 py-2">
                <Input
                  type="time"
                  aria-label={`${DAY_LABELS[hour.day]} closes`}
                  disabled={!hour.isOpen}
                  value={hour.closesAt}
                  onChange={event => updateDay(index, { closesAt: event.target.value })}
                  className="w-[130px] text-sm tabular-nums"
                />
              </td>
              <td className="px-4 py-2 text-right text-sm tabular-nums text-muted-foreground">
                {hoursSpanLabel(hour)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export { DAY_LABELS };
