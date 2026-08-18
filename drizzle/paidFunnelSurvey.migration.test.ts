import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("paid funnel survey-step migration", () => {
  it("only extends the existing step kind enum", () => {
    const sql = readFileSync("drizzle/postgres/0010_paid_funnel_survey_step.sql", "utf8");
    expect(sql).toContain("ADD VALUE IF NOT EXISTS 'survey'");
    expect(sql).not.toMatch(/DROP|DELETE|TRUNCATE/i);
  });
});
