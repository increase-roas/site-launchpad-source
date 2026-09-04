export type LineColumn = {
  key: string;
  label: string;
  placeholder?: string;
  wide?: boolean;
  type?: "text" | "number";
  choices?: Array<{ value: string; label: string }>;
};

export type LineRecord = Record<string, string>;

export function emptyLineRecord(columns: readonly LineColumn[]): LineRecord {
  return Object.fromEntries(columns.map(column => [column.key, ""]));
}

export function parseLineRecords(value: string, columns: readonly LineColumn[]): LineRecord[] {
  if (value === "") return [];
  return value.split(/\r?\n/).map(line => {
    const parts = line.split("|").map(part => part.trim());
    const record = emptyLineRecord(columns);
    columns.forEach((column, index) => {
      record[column.key] = parts[index] ?? "";
    });
    return record;
  });
}

export function serializeLineRecords(
  records: readonly LineRecord[],
  columns: readonly LineColumn[],
): string {
  return records
    .map(record => columns.map(column => (record[column.key] ?? "").trim()).join(" | "))
    .join("\n");
}

export function parseLines(value: string): string[] {
  if (value === "") return [];
  return value.split(/\r?\n/).map(line => line.trimEnd());
}

export function serializeLines(lines: readonly string[]): string {
  return lines.map(line => line.trimEnd()).join("\n");
}

export function parseJoinedParts(value: string, keys: readonly string[]): Record<string, string> {
  const parts = value.split("|").map(part => part.trim());
  return Object.fromEntries(keys.map((key, index) => [key, parts[index] ?? ""]));
}

export function serializeJoinedParts(
  record: Record<string, string>,
  keys: readonly string[],
): string {
  if (keys.every(key => !record[key]?.trim())) return "";
  return keys.map(key => (record[key] ?? "").trim()).join(" | ");
}
