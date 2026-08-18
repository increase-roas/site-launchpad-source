import { getTableConfig } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import * as schema from "./schema";

describe("paid funnel registry schema", () => {
  it("registers RLS-enabled registry tables with cascade ownership", () => {
    const tables = [
      schema.paidFunnelTemplates,
      schema.paidFunnelTemplateVersions,
      schema.paidFunnelTemplateArtifacts,
      schema.paidFunnels,
      schema.paidFunnelSteps,
      schema.paidFunnelGraphs,
      schema.paidFunnelGraphRevisions,
      schema.paidFunnelReusableSections,
      schema.paidFunnelPublishes,
    ];
    expect(tables.map(table => getTableConfig(table).name)).toEqual([
      "paid_funnel_templates",
      "paid_funnel_template_versions",
      "paid_funnel_template_artifacts",
      "paid_funnels",
      "paid_funnel_steps",
      "paid_funnel_graphs",
      "paid_funnel_graph_revisions",
      "paid_funnel_reusable_sections",
      "paid_funnel_publishes",
    ]);
    for (const table of tables) {
      const config = getTableConfig(table);
      expect(config.enableRLS).toBe(true);
      expect(config.policies).toHaveLength(0);
    }
    expect(
      getTableConfig(schema.paidFunnelTemplateVersions).indexes.map(
        index => index.config.name
      )
    ).toEqual(expect.arrayContaining(["paid_funnel_template_versions_unique"]));
  });
});
