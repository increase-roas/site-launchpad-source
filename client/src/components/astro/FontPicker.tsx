import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { Check, ChevronsUpDown, TriangleAlert } from "lucide-react";
import { useState } from "react";
import {
  FONT_CATEGORY_LABELS,
  fontGroupsForRole,
  fontSelectionState,
  fontStack,
  type FontRole,
} from "./fontCatalog";
import { useFontPreviews } from "./useFontPreviews";

/**
 * Word-style family picker: the closed control is itself the specimen, and every
 * row renders in the font it names, so a choice is judged by its shape rather
 * than by reading a string.
 */
export function FontPicker({
  value,
  role,
  label,
  onChange,
}: {
  value: string;
  role: FontRole;
  label: string;
  onChange: (next: string) => void;
}) {
  const [open, setOpen] = useState(false);
  useFontPreviews();

  const groups = fontGroupsForRole(role);
  const state = fontSelectionState(value, role);

  return (
    <span className="block">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          role="combobox"
          aria-expanded={open}
          aria-label={label}
          className={cn(
            "flex h-9 w-full items-center gap-2 rounded-md border border-input bg-transparent px-3 text-left text-sm shadow-xs transition-[color,box-shadow] outline-none",
            "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
            state === "unapproved" && "border-warning/50",
          )}
        >
          <span
            className={cn("min-w-0 flex-1 truncate", state === "empty" && "text-muted-foreground")}
            style={{ fontFamily: fontStack(value, role) }}
          >
            {value || "Choose a font"}
          </span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        </PopoverTrigger>
        <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] p-0">
          <Command>
            <CommandInput placeholder="Search fonts…" />
            <CommandList className="max-h-[320px]">
              <CommandEmpty>No approved font matches.</CommandEmpty>
              {groups.map(group => (
                <CommandGroup key={group.category} heading={group.label}>
                  {group.options.map(option => {
                    const selected = option.family === value.trim();
                    return (
                      <CommandItem
                        key={option.family}
                        value={option.family}
                        onSelect={() => {
                          onChange(option.family);
                          setOpen(false);
                        }}
                        className="gap-2"
                      >
                        <Check
                          className={cn("h-4 w-4 shrink-0", !selected && "opacity-0")}
                          aria-hidden="true"
                        />
                        <span
                          className="min-w-0 flex-1 truncate text-base"
                          style={{ fontFamily: fontStack(option.family, role) }}
                        >
                          {option.family}
                        </span>
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {FONT_CATEGORY_LABELS[option.category]}
                        </span>
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              ))}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {state === "unapproved" ? (
        <span className="mt-1.5 flex items-center gap-1.5 text-xs text-warning">
          <TriangleAlert className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          Not an approved {role === "mono" ? "monospace " : ""}font — pick one from the list.
        </span>
      ) : null}
    </span>
  );
}
