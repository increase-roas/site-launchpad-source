import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemGroup,
  ItemHeader,
  ItemTitle,
} from "@/components/ui/item";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2 } from "lucide-react";
import {
  emptyLineRecord,
  parseLineRecords,
  serializeLineRecords,
  type LineColumn,
  type LineRecord,
} from "./lineRecords";

function RecordField({
  column,
  value,
  onChange,
}: {
  column: LineColumn;
  value: string;
  onChange: (next: string) => void;
}) {
  if (column.choices) {
    const normalized = value === "true" || value === "1" ? "yes" : value;
    return (
      <Select value={normalized || column.choices[0]?.value || ""} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue placeholder={column.placeholder ?? column.label} />
        </SelectTrigger>
        <SelectContent>
          {column.choices.map(choice => (
            <SelectItem key={choice.value} value={choice.value}>
              {choice.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }
  if (column.wide) {
    return (
      <Textarea
        value={value}
        onChange={event => onChange(event.target.value)}
        placeholder={column.placeholder}
        className="min-h-20"
      />
    );
  }
  return (
    <Input
      type={column.type === "number" ? "number" : "text"}
      value={value}
      onChange={event => onChange(event.target.value)}
      placeholder={column.placeholder}
    />
  );
}

export function StructuredLinesEditor({
  value,
  columns,
  layout,
  onChange,
  addLabel,
}: {
  value: string;
  columns: readonly LineColumn[];
  layout: "table" | "cards";
  onChange: (next: string) => void;
  addLabel: string;
}) {
  const records = parseLineRecords(value, columns);
  const write = (next: LineRecord[]) => onChange(serializeLineRecords(next, columns));
  const update = (index: number, key: string, nextValue: string) =>
    write(records.map((record, recordIndex) => (recordIndex === index ? { ...record, [key]: nextValue } : record)));

  return (
    <div className="space-y-3">
      {records.length === 0 ? (
        <p className="text-xs text-muted-foreground">Nothing added yet.</p>
      ) : layout === "table" ? (
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map(column => (
                <TableHead key={column.key}>{column.label}</TableHead>
              ))}
              <TableHead className="w-12">
                <span className="sr-only">Remove</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {records.map((record, index) => (
              <TableRow key={`record-${index}`}>
                {columns.map(column => (
                  <TableCell key={column.key} className="whitespace-normal align-top">
                    <RecordField
                      column={column}
                      value={record[column.key] ?? ""}
                      onChange={next => update(index, column.key, next)}
                    />
                  </TableCell>
                ))}
                <TableCell className="align-top">
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    aria-label={`Remove ${addLabel.toLowerCase()} ${index + 1}`}
                    onClick={() => write(records.filter((_, recordIndex) => recordIndex !== index))}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <ItemGroup className="gap-2">
          {records.map((record, index) => (
            <Item key={`record-${index}`} variant="outline" className="flex-col items-stretch">
              <ItemHeader>
                <ItemTitle>
                  {record[columns[0]?.key ?? ""]?.trim() || `${addLabel} ${index + 1}`}
                </ItemTitle>
                <ItemActions>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    aria-label={`Remove ${addLabel.toLowerCase()} ${index + 1}`}
                    onClick={() => write(records.filter((_, recordIndex) => recordIndex !== index))}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </ItemActions>
              </ItemHeader>
              <ItemContent className="grid gap-3 sm:grid-cols-2">
                {columns.map(column => (
                  <div key={column.key} className={column.wide ? "space-y-1.5 sm:col-span-2" : "space-y-1.5"}>
                    <Label>{column.label}</Label>
                    <RecordField
                      column={column}
                      value={record[column.key] ?? ""}
                      onChange={next => update(index, column.key, next)}
                    />
                  </div>
                ))}
              </ItemContent>
            </Item>
          ))}
        </ItemGroup>
      )}
      <Button type="button" variant="outline" size="sm" onClick={() => write([...records, emptyLineRecord(columns)])}>
        <Plus className="h-4 w-4" />
        {addLabel}
      </Button>
    </div>
  );
}
