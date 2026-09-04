import { StatusBadge, type BadgeTone } from "@/components/dashboard/StatusBadge";
import { Checklist, ChecklistItem } from "@/components/dashboard/Checklist";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { wizardStepHref } from "@/app/wizardRoutes";
import {
  type WizardDetailState,
  type WizardStepState,
  type WizardStepStatus,
} from "@/app/wizard";
import { cn } from "@/lib/utils";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  CircleDashed,
  CircleDot,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "wouter";

type StepVisual = {
  icon: LucideIcon;
  label: string;
  tone: BadgeTone;
  chip: string;
  iconColor: string;
};

const STEP_VISUAL: Record<WizardStepState, StepVisual> = {
  complete: {
    icon: CheckCircle2,
    label: "Complete",
    tone: "success",
    chip: "bg-success/15 text-success",
    iconColor: "text-success",
  },
  current: {
    icon: CircleDot,
    label: "Next up",
    tone: "primary",
    chip: "bg-primary text-primary-foreground",
    iconColor: "text-primary",
  },
  todo: {
    icon: AlertCircle,
    label: "Needs attention",
    tone: "warning",
    chip: "bg-warning/15 text-warning",
    iconColor: "text-warning",
  },
  unknown: {
    icon: CircleDashed,
    label: "Not checked yet",
    tone: "neutral",
    chip: "bg-muted text-muted-foreground",
    iconColor: "text-muted-foreground",
  },
};

function detailTone(state: WizardDetailState): BadgeTone {
  switch (state) {
    case "complete":
      return "success";
    case "incomplete":
      return "warning";
    case "invalid":
      return "danger";
    case "off":
      return "neutral";
    default: {
      const exhaustive: never = state;
      return exhaustive;
    }
  }
}

function detailLabel(state: WizardDetailState): string {
  switch (state) {
    case "complete":
      return "Complete";
    case "incomplete":
      return "Incomplete";
    case "invalid":
      return "Invalid";
    case "off":
      return "Off";
    default: {
      const exhaustive: never = state;
      return exhaustive;
    }
  }
}

function checklistState(
  state: WizardDetailState,
): "pass" | "fail" | "pending" {
  switch (state) {
    case "complete":
      return "pass";
    case "incomplete":
    case "invalid":
      return "fail";
    case "off":
      return "pending";
    default: {
      const exhaustive: never = state;
      return exhaustive;
    }
  }
}

function stepPercent(step: WizardStepStatus): number | undefined {
  if (step.total && step.total > 0 && step.filled !== undefined) {
    return Math.round((step.filled / step.total) * 100);
  }
  if (step.state === "complete") return 100;
  if (step.state === "unknown") return undefined;
  return 0;
}

export function BuildPath({
  steps,
  clientId,
  loading = false,
}: {
  steps: readonly WizardStepStatus[];
  clientId: number;
  loading?: boolean;
}) {
  const current = steps.find(step => step.state === "current");
  const [open, setOpen] = useState<string | undefined>(current?.step);

  useEffect(() => {
    if (current?.step) setOpen(current.step);
  }, [current?.step]);

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-16 rounded-lg" />
        <Skeleton className="h-20 rounded-lg" />
        <Skeleton className="h-20 rounded-lg" />
        <Skeleton className="h-20 rounded-lg" />
      </div>
    );
  }

  return (
    <Accordion
      type="single"
      collapsible
      value={open}
      onValueChange={setOpen}
      className="w-full"
    >
      {steps.map((step, index) => {
        const visual = STEP_VISUAL[step.state];
        const percent = stepPercent(step);
        const last = index === steps.length - 1;

        return (
          <AccordionItem
            key={step.step}
            value={step.step}
            className="border-0"
          >
            <div className="flex gap-3">
              <div className="flex w-6 shrink-0 flex-col items-center">
                <span
                  className={cn(
                    "grid h-6 w-6 place-items-center rounded-md text-[11px] font-semibold",
                    visual.chip,
                  )}
                >
                  {step.index}
                </span>
                {last ? null : (
                  <span
                    aria-hidden="true"
                    className="mt-1 w-px flex-1 bg-border"
                  />
                )}
              </div>

              <div className={cn("min-w-0 flex-1", last ? "pb-0" : "pb-3")}>
                <AccordionTrigger className="items-center py-1.5 hover:no-underline">
                  <span className="flex min-w-0 flex-1 flex-col gap-1.5 pr-2 sm:flex-row sm:items-center sm:gap-3">
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold leading-tight">
                        {step.label}
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                        {step.blockedBy ?? step.caption}
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-2">
                      <visual.icon
                        className={cn("hidden h-3.5 w-3.5 sm:block", visual.iconColor)}
                        aria-hidden="true"
                      />
                      {percent !== undefined ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="hidden w-24 sm:block">
                              <Progress value={percent} className="h-1.5" />
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>
                            {step.filled !== undefined && step.total !== undefined
                              ? `${step.filled} of ${step.total} required`
                              : `${percent}%`}
                          </TooltipContent>
                        </Tooltip>
                      ) : null}
                      <HoverCard>
                        <HoverCardTrigger asChild>
                          <span>
                            <StatusBadge
                              tone={visual.tone}
                              label={visual.label}
                              dot
                            />
                          </span>
                        </HoverCardTrigger>
                        <HoverCardContent className="w-64" align="end">
                          <p className="text-sm font-semibold">{step.label}</p>
                          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                            {step.blockedBy ??
                              (step.state === "complete"
                                ? "This step matches the current configuration."
                                : step.caption)}
                          </p>
                          {step.filled !== undefined && step.total !== undefined ? (
                            <p className="mt-2 text-xs tabular-nums text-muted-foreground">
                              {step.filled} of {step.total} required fields
                            </p>
                          ) : null}
                        </HoverCardContent>
                      </HoverCard>
                    </span>
                  </span>
                </AccordionTrigger>

                <AccordionContent className="pb-1">
                  <StepBody step={step} clientId={clientId} />
                </AccordionContent>
              </div>
            </div>
          </AccordionItem>
        );
      })}
    </Accordion>
  );
}

function StepBody({
  step,
  clientId,
}: {
  step: WizardStepStatus;
  clientId: number;
}) {
  const href = wizardStepHref(step.step, clientId);
  const details = step.details ?? [];

  return (
    <div className="space-y-3 rounded-lg border border-border bg-muted/40 p-3">
      {details.length > 0 ? (
        <Checklist className="rounded-md border border-border bg-card">
          {details.map(detail => (
            <ChecklistItem
              key={detail.label}
              state={checklistState(detail.state)}
              label={detail.label}
              detail={detail.note}
              action={
                <StatusBadge
                  tone={detailTone(detail.state)}
                  label={detailLabel(detail.state)}
                />
              }
            />
          ))}
        </Checklist>
      ) : (
        <p className="text-xs leading-relaxed text-muted-foreground">
          {step.blockedBy ?? step.caption}
        </p>
      )}

      <Button asChild size="sm" className="h-8 text-xs font-semibold">
        <Link href={href}>
          Open {step.label}
          <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      </Button>
    </div>
  );
}
