import { AlertCircle } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export function FormField({
  label,
  error,
  hint,
  required = true,
  children,
}: {
  label: string;
  error?: string;
  hint?: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <label className="block space-y-2">
      <span className="flex items-center gap-2 text-sm font-extrabold text-foreground">
        {label}
        {!required ? <span className="font-semibold text-muted-foreground">Optional</span> : null}
      </span>
      {children}
      {error ? (
        <span className="flex items-center gap-1.5 text-sm font-bold text-red-300">
          <AlertCircle className="h-4 w-4" aria-hidden="true" />
          {error}
        </span>
      ) : hint ? (
        <span className="block text-sm font-medium leading-relaxed text-muted-foreground">{hint}</span>
      ) : null}
    </label>
  );
}

export function SectionHeading({
  icon: Icon,
  eyebrow,
  title,
  description,
}: {
  icon: LucideIcon;
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="mb-6 flex items-start gap-4">
      <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-cyan-400/10 text-cyan-300 ring-1 ring-cyan-300/15">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </div>
      <div>
        <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-cyan-300">{eyebrow}</p>
        <h2 className="mt-1.5 text-2xl font-extrabold tracking-tight text-foreground">{title}</h2>
        <p className="mt-2 max-w-3xl text-sm font-medium leading-relaxed text-muted-foreground sm:text-base">
          {description}
        </p>
      </div>
    </div>
  );
}
