import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemGroup,
} from "@/components/ui/item";
import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { parseLines, serializeLines } from "./lineRecords";

export function SimpleLinesEditor({
  value,
  onChange,
  addLabel,
  placeholder,
}: {
  value: string;
  onChange: (next: string) => void;
  addLabel: string;
  placeholder?: string;
}) {
  const stored = parseLines(value);
  const [drafts, setDrafts] = useState<string[]>([]);
  const lines = [...stored, ...drafts];
  const writeStored = (next: string[]) => {
    setDrafts([]);
    onChange(serializeLines(next));
  };

  const update = (index: number, nextValue: string) => {
    if (index < stored.length) {
      onChange(serializeLines(stored.map((line, entryIndex) => (entryIndex === index ? nextValue : line))));
      return;
    }
    const draftIndex = index - stored.length;
    const nextDrafts = drafts.map((line, entryIndex) => (entryIndex === draftIndex ? nextValue : line));
    const filled = nextDrafts.filter(line => line.trim());
    const empty = nextDrafts.filter(line => !line.trim());
    if (filled.length > 0) {
      onChange(serializeLines([...stored, ...filled]));
      setDrafts(empty);
      return;
    }
    setDrafts(nextDrafts);
  };

  return (
    <div className="space-y-3">
      {lines.length === 0 ? (
        <p className="text-xs text-muted-foreground">Nothing added yet.</p>
      ) : (
        <ItemGroup className="gap-2">
          {lines.map((line, index) => (
            <Item key={`line-${index}`} variant="outline" size="sm" className="items-center">
              <ItemContent>
                <Input
                  value={line}
                  onChange={event => update(index, event.target.value)}
                  placeholder={placeholder}
                />
              </ItemContent>
              <ItemActions>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  aria-label={`Remove ${addLabel.toLowerCase()} ${index + 1}`}
                  onClick={() => {
                    if (index < stored.length) {
                      writeStored(stored.filter((_, entryIndex) => entryIndex !== index));
                      return;
                    }
                    setDrafts(drafts.filter((_, entryIndex) => entryIndex !== index - stored.length));
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </ItemActions>
            </Item>
          ))}
        </ItemGroup>
      )}
      <Button type="button" variant="outline" size="sm" onClick={() => setDrafts(current => [...current, ""])}>
        <Plus className="h-4 w-4" />
        {addLabel}
      </Button>
    </div>
  );
}
