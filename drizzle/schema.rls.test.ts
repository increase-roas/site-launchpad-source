import { is } from "drizzle-orm";
import { getTableConfig, PgTable } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import * as schema from "./schema";
import {
  assetUploadSessions,
  astroClientConfigs,
  clientAssets,
  clientSecretSetups,
  clients,
  funnelConfigs,
  funnelRuntimeSecrets,
  funnelSimpleFormConfigs,
  funnelSteps,
  funnelSurveyQuestions,
  funnels,
  homepageSections,
  sitePages,
  users,
  wranglerSecretSetups,
} from "./schema";

const applicationTables = {
  assetUploadSessions: {
    table: assetUploadSessions,
    databaseName: "assetUploadSessions",
  },
  astroClientConfigs: { table: astroClientConfigs, databaseName: "astroClientConfigs" },
  clientAssets: { table: clientAssets, databaseName: "clientAssets" },
  clientSecretSetups: { table: clientSecretSetups, databaseName: "clientSecretSetups" },
  clients: { table: clients, databaseName: "clients" },
  funnelConfigs: { table: funnelConfigs, databaseName: "funnelConfigs" },
  funnelRuntimeSecrets: { table: funnelRuntimeSecrets, databaseName: "funnelRuntimeSecrets" },
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
  homepageSections: { table: homepageSections, databaseName: "homepageSections" },
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
    expect(discovered).toHaveLength(15);
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
      },
    );

    expect(rlsBoundary).toEqual(
      Object.entries(applicationTables).map(([exportName, { databaseName }]) => ({
        exportName,
        databaseName,
        enableRLS: true,
        policyCount: 0,
      })),
    );
  });
});
