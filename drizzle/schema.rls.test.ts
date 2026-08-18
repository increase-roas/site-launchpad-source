import { is } from "drizzle-orm";
import { getTableConfig, PgTable } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import * as schema from "./schema";
import {
  assetUploadSessions,
  astroClientConfigs,
  astroSitePublishes,
  clientAssets,
  clientLeadIntegrations,
  clientSecretSetups,
  clientIntegrationProfiles,
  clients,
  funnelConfigs,
  funnelPublishes,
  funnelRuntimeSecrets,
  funnelSimpleFormConfigs,
  funnelSteps,
  funnelSurveyQuestions,
  funnels,
  homepageSections,
  paidFunnelGraphRevisions,
  paidFunnelGraphs,
  paidFunnelPublishes,
  paidFunnelReusableSections,
  paidFunnelSteps,
  paidFunnelTemplateArtifacts,
  paidFunnelTemplateVersions,
  paidFunnelTemplates,
  paidFunnels,
  sitePages,
  users,
  wranglerSecretSetups,
} from "./schema";

const applicationTables = {
  assetUploadSessions: {
    table: assetUploadSessions,
    databaseName: "assetUploadSessions",
  },
  astroClientConfigs: {
    table: astroClientConfigs,
    databaseName: "astroClientConfigs",
  },
  astroSitePublishes: {
    table: astroSitePublishes,
    databaseName: "astroSitePublishes",
  },
  clientAssets: { table: clientAssets, databaseName: "clientAssets" },
  clientLeadIntegrations: {
    table: clientLeadIntegrations,
    databaseName: "clientLeadIntegrations",
  },
  clientSecretSetups: {
    table: clientSecretSetups,
    databaseName: "clientSecretSetups",
  },
  clientIntegrationProfiles: {
    table: clientIntegrationProfiles,
    databaseName: "client_integration_profiles",
  },
  clients: { table: clients, databaseName: "clients" },
  funnelConfigs: { table: funnelConfigs, databaseName: "funnelConfigs" },
  funnelPublishes: { table: funnelPublishes, databaseName: "funnelPublishes" },
  funnelRuntimeSecrets: {
    table: funnelRuntimeSecrets,
    databaseName: "funnelRuntimeSecrets",
  },
  funnelSimpleFormConfigs: {
    table: funnelSimpleFormConfigs,
    databaseName: "funnelSimpleFormConfigs",
  },
  funnelSteps: { table: funnelSteps, databaseName: "funnelSteps" },
  funnelSurveyQuestions: {
    table: funnelSurveyQuestions,
    databaseName: "funnelSurveyQuestions",
  },
  funnels: { table: funnels, databaseName: "funnels" },
  homepageSections: {
    table: homepageSections,
    databaseName: "homepageSections",
  },
  paidFunnelGraphRevisions: {
    table: paidFunnelGraphRevisions,
    databaseName: "paid_funnel_graph_revisions",
  },
  paidFunnelGraphs: {
    table: paidFunnelGraphs,
    databaseName: "paid_funnel_graphs",
  },
  paidFunnelPublishes: {
    table: paidFunnelPublishes,
    databaseName: "paid_funnel_publishes",
  },
  paidFunnelReusableSections: {
    table: paidFunnelReusableSections,
    databaseName: "paid_funnel_reusable_sections",
  },
  paidFunnelSteps: {
    table: paidFunnelSteps,
    databaseName: "paid_funnel_steps",
  },
  paidFunnelTemplateArtifacts: {
    table: paidFunnelTemplateArtifacts,
    databaseName: "paid_funnel_template_artifacts",
  },
  paidFunnelTemplateVersions: {
    table: paidFunnelTemplateVersions,
    databaseName: "paid_funnel_template_versions",
  },
  paidFunnelTemplates: {
    table: paidFunnelTemplates,
    databaseName: "paid_funnel_templates",
  },
  paidFunnels: { table: paidFunnels, databaseName: "paid_funnels" },
  sitePages: { table: sitePages, databaseName: "sitePages" },
  users: { table: users, databaseName: "users" },
  wranglerSecretSetups: {
    table: wranglerSecretSetups,
    databaseName: "wranglerSecretSetups",
  },
} as const;

describe("PostgreSQL application-table RLS", () => {
  it("enumerates every exported application table exactly", () => {
    const discovered = Object.entries(schema)
      .filter((entry): entry is [string, PgTable] => is(entry[1], PgTable))
      .map(([exportName, table]) => ({
        exportName,
        databaseName: getTableConfig(table).name,
      }))
      .sort((left, right) => left.exportName.localeCompare(right.exportName));
    const expected = Object.entries(applicationTables)
      .map(([exportName, { databaseName }]) => ({ exportName, databaseName }))
      .sort((left, right) => left.exportName.localeCompare(right.exportName));

    expect(discovered).toEqual(expected);
    expect(discovered).toHaveLength(28);
  });

  it("enables RLS without schema policies on every application table", () => {
    const rlsBoundary = Object.entries(applicationTables).map(
      ([exportName, { table, databaseName }]) => {
        const config = getTableConfig(table);
        return {
          exportName,
          databaseName,
          enableRLS: config.enableRLS,
          policyCount: config.policies.length,
        };
      }
    );

    expect(rlsBoundary).toEqual(
      Object.entries(applicationTables).map(
        ([exportName, { databaseName }]) => ({
          exportName,
          databaseName,
          enableRLS: true,
          policyCount: 0,
        })
      )
    );
  });
});
