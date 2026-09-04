import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { configSectionElementId } from "@/lib/workspaceNavigation";
import type { ConfigReadiness, ConfigSectionId, SectionReadiness } from "@shared/astroConfigReadiness";
import { BadgeDollarSign, LayoutList, Menu, ShoppingBag } from "lucide-react";
import type { LucideIcon } from "lucide-react";

const JUMP_TARGETS: Array<{ id: ConfigSectionId; label: string; icon: LucideIcon }> = [
  { id: "navigation", label: "Navigation", icon: Menu },
  { id: "categories", label: "Categories", icon: ShoppingBag },
  { id: "financing", label: "Financing", icon: BadgeDollarSign },
  { id: "homepage", label: "Homepage", icon: LayoutList },
];

function statusLabel(section: SectionReadiness): string {
  if (section.invalid > 0) return `${section.invalid} invalid`;
  if (section.incomplete > 0) return `${section.incomplete} to fill`;
  return "Ready";
}

function statusVariant(section: SectionReadiness): "default" | "secondary" | "destructive" | "outline" {
  if (section.state === "invalid") return "destructive";
  if (section.state === "incomplete") return "outline";
  return "secondary";
}

export function ContentJumpNav({ readiness }: { readiness: ConfigReadiness }) {
  return (
    <nav
      aria-label="Content sections"
      className="flex flex-wrap gap-2 rounded-lg border border-border bg-card p-2"
    >
      {JUMP_TARGETS.map(target => {
        const Icon = target.icon;
        const section = readiness.sections[target.id];
        return (
          <Button
            key={target.id}
            type="button"
            variant="ghost"
            size="sm"
            className="h-auto justify-start gap-2 px-2.5 py-1.5"
            onClick={() => {
              document.getElementById(configSectionElementId(target.id))?.scrollIntoView({
                behavior: "smooth",
                block: "start",
              });
            }}
          >
            <Icon className="h-4 w-4 text-muted-foreground" />
            <span>{target.label}</span>
            <Badge variant={statusVariant(section)}>{statusLabel(section)}</Badge>
          </Button>
        );
      })}
    </nav>
  );
}
