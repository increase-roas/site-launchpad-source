import { describe, expect, it } from "vitest";
import {
  emptyLineRecord,
  parseJoinedParts,
  parseLineRecords,
  parseLines,
  serializeJoinedParts,
  serializeLineRecords,
  serializeLines,
  type LineColumn,
} from "./lineRecords";

const COLUMNS: LineColumn[] = [
  { key: "title", label: "Title" },
  { key: "body", label: "Body" },
  { key: "href", label: "Link" },
];

describe("lineRecords", () => {
  it("round-trips filled and blank records so add-row stays visible", () => {
    const records = [
      { title: "A", body: "One", href: "/a" },
      emptyLineRecord(COLUMNS),
      { title: "B", body: "", href: "/b" },
    ];
    const serialized = serializeLineRecords(records, COLUMNS);
    expect(serialized).toBe("A | One | /a\n |  | \nB |  | /b");
    expect(parseLineRecords(serialized, COLUMNS)).toEqual(records);
  });

  it("pads short legacy lines so older copy still opens", () => {
    expect(parseLineRecords("Hero", COLUMNS)).toEqual([
      { title: "Hero", body: "", href: "" },
    ]);
  });

  it("keeps simple claim lists as one line per item", () => {
    expect(serializeLines(["Fast delivery", "Local service"])).toBe(
      "Fast delivery\nLocal service",
    );
    expect(parseLines("Fast delivery\nLocal service")).toEqual([
      "Fast delivery",
      "Local service",
    ]);
  });

  it("round-trips joined aggregate fields", () => {
    const keys = ["rating", "count", "source"] as const;
    const serialized = serializeJoinedParts(
      { rating: "4.7", count: "48", source: "Google" },
      keys,
    );
    expect(serialized).toBe("4.7 | 48 | Google");
    expect(parseJoinedParts(serialized, keys)).toEqual({
      rating: "4.7",
      count: "48",
      source: "Google",
    });
  });
});
