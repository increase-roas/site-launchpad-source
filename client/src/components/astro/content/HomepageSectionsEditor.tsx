import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  ASTRO_SECTION_LABELS,
  ASTRO_SECTION_TYPE_VALUES,
  createAstroHomepageSection,
  type AstroHomepageSection,
  type AstroSectionType,
} from "@shared/astroConfig";
import type { ConfigReadiness } from "@shared/astroConfigReadiness";
import type { MediaLibraryItemView } from "@shared/mediaLibrary";
import {
  ArrowDown,
  ArrowUp,
  GripVertical,
  LayoutList,
  MoreHorizontal,
  Plus,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import { HomepageSectionFields } from "../HomepageSectionFields";
import { sectionPreviewTitle } from "./sectionFieldModel";
import { moveItem } from "./reorder";

function issueCount(readiness: ConfigReadiness, index: number): number {
  let count = 0;
  for (const path of readiness.fields.keys()) {
    if (path.startsWith(`homepageSections.${index}.`)) count += 1;
  }
  return count;
}

export function HomepageSectionsEditor({
  sections,
  readiness,
  mediaItems,
  onChange,
}: {
  sections: AstroHomepageSection[];
  readiness: ConfigReadiness;
  mediaItems?: MediaLibraryItemView[];
  onChange: (next: AstroHomepageSection[]) => void;
}) {
  const firstOpen = sections.find(section => section.enabled)?.id ?? sections[0]?.id ?? "";
  const [openId, setOpenId] = useState(firstOpen);
  const [newSectionType, setNewSectionType] = useState<AstroSectionType>("hero");
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [pendingDelete, setPendingDelete] = useState<AstroHomepageSection | null>(null);

  const updateAt = (index: number, next: AstroHomepageSection) =>
    onChange(sections.map((section, sectionIndex) => (sectionIndex === index ? next : section)));

  const addSection = () => {
    const section = createAstroHomepageSection(newSectionType);
    onChange([...sections, section]);
    setOpenId(section.id);
  };

  const enabledCount = sections.filter(section => section.enabled).length;

  if (sections.length === 0) {
    return (
      <Empty className="border border-dashed">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <LayoutList />
          </EmptyMedia>
          <EmptyTitle>No homepage sections</EmptyTitle>
          <EmptyDescription>Add a hero first, then stack the blocks the template supports.</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Select value={newSectionType} onValueChange={value => setNewSectionType(value as AstroSectionType)}>
              <SelectTrigger className="sm:w-56">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ASTRO_SECTION_TYPE_VALUES.map(type => (
                  <SelectItem key={type} value={type}>
                    {ASTRO_SECTION_LABELS[type]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button type="button" onClick={addSection}>
              <Plus className="h-4 w-4" />
              Add section
            </Button>
          </div>
        </EmptyContent>
      </Empty>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-lg border border-border bg-muted/40 p-3 sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">Page composition</p>
          <p className="text-xs text-muted-foreground">
            {enabledCount} of {sections.length} sections will publish. Open one block at a time to edit its copy.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Select value={newSectionType} onValueChange={value => setNewSectionType(value as AstroSectionType)}>
            <SelectTrigger className="sm:w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ASTRO_SECTION_TYPE_VALUES.map(type => (
                <SelectItem key={type} value={type}>
                  {ASTRO_SECTION_LABELS[type]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button type="button" onClick={addSection}>
            <Plus className="h-4 w-4" />
            Add section
          </Button>
        </div>
      </div>

      <Accordion type="single" collapsible value={openId} onValueChange={setOpenId} className="space-y-2">
        {sections.map((section, index) => {
          const preview = sectionPreviewTitle(section);
          const gaps = section.enabled ? issueCount(readiness, index) : 0;
          return (
            <AccordionItem
              key={section.id}
              value={section.id}
              onDragOver={event => event.preventDefault()}
              onDrop={() => {
                if (dragIndex !== null) onChange(moveItem(sections, dragIndex, index));
                setDragIndex(null);
              }}
              className="overflow-hidden rounded-lg border border-border bg-card px-0 last:border-b"
            >
              <div className="flex items-center gap-2 px-3">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span
                      draggable
                      onDragStart={() => setDragIndex(index)}
                      className="inline-flex cursor-grab text-muted-foreground"
                    >
                      <GripVertical className="h-4 w-4" />
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>Drag to reorder</TooltipContent>
                </Tooltip>
                <AccordionTrigger className="flex-1 items-center py-3 hover:no-underline">
                  <span className="flex min-w-0 flex-1 flex-wrap items-center gap-2 text-left">
                    <Badge variant="secondary">{ASTRO_SECTION_LABELS[section.type]}</Badge>
                    <Badge variant="outline">#{index + 1}</Badge>
                    {preview ? (
                      <span className="truncate text-sm font-medium">{preview}</span>
                    ) : (
                      <span className="text-sm text-muted-foreground">No title yet</span>
                    )}
                    {gaps > 0 ? (
                      <Badge variant="outline">{gaps} to fill</Badge>
                    ) : null}
                    {!section.enabled ? <Badge variant="outline">Off</Badge> : null}
                  </span>
                </AccordionTrigger>
                <label
                  className="flex items-center gap-2 text-xs font-medium"
                  onClick={event => event.stopPropagation()}
                  onPointerDown={event => event.stopPropagation()}
                >
                  <Switch
                    checked={section.enabled}
                    onCheckedChange={enabled => updateAt(index, { ...section, enabled })}
                  />
                  <span className="hidden sm:inline">{section.enabled ? "On" : "Off"}</span>
                </label>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button type="button" size="icon" variant="ghost" aria-label="Section actions">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      disabled={index === 0}
                      onClick={() => onChange(moveItem(sections, index, index - 1))}
                    >
                      <ArrowUp className="h-4 w-4" />
                      Move up
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      disabled={index === sections.length - 1}
                      onClick={() => onChange(moveItem(sections, index, index + 1))}
                    >
                      <ArrowDown className="h-4 w-4" />
                      Move down
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem variant="destructive" onClick={() => setPendingDelete(section)}>
                      <Trash2 className="h-4 w-4" />
                      Remove
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <AccordionContent className="border-t border-border px-0 pb-0">
                <HomepageSectionFields
                  section={section}
                  index={index}
                  readiness={readiness}
                  mediaItems={mediaItems}
                  onChange={next => updateAt(index, next)}
                />
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>

      <AlertDialog open={pendingDelete !== null} onOpenChange={open => { if (!open) setPendingDelete(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this section?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete
                ? `${ASTRO_SECTION_LABELS[pendingDelete.type]} and its copy will be removed from the homepage.`
                : "This section will be removed from the homepage."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep section</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!pendingDelete) return;
                onChange(sections.filter(section => section.id !== pendingDelete.id));
                if (openId === pendingDelete.id) setOpenId("");
                setPendingDelete(null);
              }}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
