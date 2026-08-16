import { readFileSync } from "node:fs";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import {
  astroClientConfigs,
  clientAssets,
  clientSecretSetups,
  funnelConfigs,
  funnelRuntimeSecrets,
  funnelSimpleFormConfigs,
  users,
  wranglerSecretSetups,
} from "../drizzle/schema";
import {
  postgresConflictTargets,
  requireSinglePositiveId,
  withUpdatedAt,
} from "./postgresPersistence";

type ConflictCallsite = {
  insertedTable: string;
  target: string;
  usesUpdatedAt: boolean;
};

const expectedConflictCallsites = {
  "server/db.ts": [
    { insertedTable: "users", target: "users", usesUpdatedAt: true },
    {
      insertedTable: "clientSecretSetups",
      target: "clientSecretSetups",
      usesUpdatedAt: true,
    },
    {
      insertedTable: "clientSecretSetups",
      target: "clientSecretSetups",
      usesUpdatedAt: true,
    },
  ],
  "server/assetUploadDb.ts": [
    { insertedTable: "clientAssets", target: "clientAssets", usesUpdatedAt: true },
  ],
  "server/astroConfigDb.ts": [
    {
      insertedTable: "astroClientConfigs",
      target: "astroClientConfigs",
      usesUpdatedAt: true,
    },
    {
      insertedTable: "wranglerSecretSetups",
      target: "wranglerSecretSetups",
      usesUpdatedAt: true,
    },
  ],
  "server/funnelConfigDb.ts": [
    {
      insertedTable: "funnelConfigRows",
      target: "funnelConfigs",
      usesUpdatedAt: true,
    },
  ],
  "server/simpleFormDb.ts": [
    {
      insertedTable: "funnelSimpleFormConfigs",
      target: "funnelSimpleFormConfigs",
      usesUpdatedAt: true,
    },
    {
      insertedTable: "funnelRuntimeSecrets",
      target: "funnelRuntimeSecrets",
      usesUpdatedAt: true,
    },
  ],
} as const satisfies Record<string, readonly ConflictCallsite[]>;

function objectProperty(
  value: ts.Expression | undefined,
  name: string,
): ts.PropertyAssignment | undefined {
  if (!value || !ts.isObjectLiteralExpression(value)) return undefined;
  return value.properties.find(
    (property): property is ts.PropertyAssignment =>
      ts.isPropertyAssignment(property) &&
      ((ts.isIdentifier(property.name) && property.name.text === name) ||
        (ts.isStringLiteral(property.name) && property.name.text === name)),
  );
}

function insertedTableFor(
  call: ts.CallExpression,
  sourceFile: ts.SourceFile,
): string {
  if (!ts.isPropertyAccessExpression(call.expression)) {
    throw new Error("Expected onConflictDoUpdate to use property access.");
  }
  let receiver: ts.Expression = call.expression.expression;
  while (ts.isCallExpression(receiver) && ts.isPropertyAccessExpression(receiver.expression)) {
    if (receiver.expression.name.text === "insert") {
      const table = receiver.arguments[0];
      if (!table) throw new Error("Expected insert to name a table.");
      return table.getText(sourceFile);
    }
    receiver = receiver.expression.expression;
  }
  throw new Error("Expected onConflictDoUpdate to follow an insert call.");
}

function collectConflictCallsites(path: string, source: string): ConflictCallsite[] {
  const sourceFile = ts.createSourceFile(
    path,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const callsites: ConflictCallsite[] = [];

  function visit(node: ts.Node): void {
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.name.text === "onConflictDoUpdate"
    ) {
      const targetProperty = objectProperty(node.arguments[0], "target");
      const setProperty = objectProperty(node.arguments[0], "set");
      const targetExpression = targetProperty?.initializer;
      if (
        !targetExpression ||
        !ts.isPropertyAccessExpression(targetExpression) ||
        !ts.isIdentifier(targetExpression.expression) ||
        targetExpression.expression.text !== "postgresConflictTargets"
      ) {
        throw new Error(`Expected an explicit postgresConflictTargets target in ${path}.`);
      }
      const setExpression = setProperty?.initializer;
      callsites.push({
        insertedTable: insertedTableFor(node, sourceFile),
        target: targetExpression.name.text,
        usesUpdatedAt:
          Boolean(setExpression) &&
          ts.isCallExpression(setExpression) &&
          ts.isIdentifier(setExpression.expression) &&
          setExpression.expression.text === "withUpdatedAt",
      });
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return callsites;
}

describe("PostgreSQL persistence helpers", () => {
  it("uses the exact schema columns for every application conflict target", () => {
    expect(postgresConflictTargets.users).toBe(users.authUserId);
    expect(postgresConflictTargets.clientSecretSetups).toBe(clientSecretSetups.clientId);
    expect(postgresConflictTargets.clientAssets).toEqual([
      clientAssets.clientId,
      clientAssets.slot,
    ]);
    expect(postgresConflictTargets.astroClientConfigs).toBe(astroClientConfigs.clientId);
    expect(postgresConflictTargets.wranglerSecretSetups).toBe(wranglerSecretSetups.clientId);
    expect(postgresConflictTargets.funnelConfigs).toBe(funnelConfigs.funnelId);
    expect(postgresConflictTargets.funnelSimpleFormConfigs).toBe(
      funnelSimpleFormConfigs.funnelId,
    );
    expect(postgresConflictTargets.funnelRuntimeSecrets).toBe(
      funnelRuntimeSecrets.funnelId,
    );
  });

  it("returns the single positive integer insert ID", () => {
    expect(requireSinglePositiveId([{ id: 42 }], "Insert failed.")).toBe(42);
  });

  it("rejects zero or multiple returned insert rows", () => {
    expect(() => requireSinglePositiveId([], "Insert failed.")).toThrow("Insert failed.");
    expect(() =>
      requireSinglePositiveId([{ id: 1 }, { id: 2 }], "Insert failed."),
    ).toThrow("Insert failed.");
  });

  it("rejects non-positive and non-integer insert IDs", () => {
    expect(() => requireSinglePositiveId([{ id: 0 }], "Insert failed.")).toThrow(
      "Insert failed.",
    );
    expect(() => requireSinglePositiveId([{ id: 1.5 }], "Insert failed.")).toThrow(
      "Insert failed.",
    );
  });

  it("replaces updatedAt while preserving all other fields", () => {
    const previous = new Date("2026-08-14T12:00:00.000Z");
    const supplied = new Date("2026-08-15T12:00:00.000Z");
    const values = { name: "Northland Spas", updatedAt: previous };

    expect(withUpdatedAt(values, supplied)).toEqual({
      name: "Northland Spas",
      updatedAt: supplied,
    });
    expect(values.updatedAt).toBe(previous);
    expect(withUpdatedAt({ name: "Northland Spas" }).updatedAt).toBeInstanceOf(Date);
  });
});

describe("PostgreSQL query callsites", () => {
  it("binds every individual upsert table to its exact conflict target and updatedAt set", () => {
    for (const [path, expected] of Object.entries(expectedConflictCallsites)) {
      const source = readFileSync(path, "utf8");
      expect(collectConflictCallsites(path, source), path).toEqual(expected);
    }
  });

  it("detects a swapped table-specific conflict target", () => {
    const path = "server/assetUploadDb.ts";
    const source = readFileSync(path, "utf8");
    const mutated = source.replace(
      "target: postgresConflictTargets.clientAssets",
      "target: postgresConflictTargets.users",
    );

    expect(collectConflictCallsites(path, mutated)).not.toEqual(
      expectedConflictCallsites[path],
    );
  });

  it("writes updatedAt for every active update query", () => {
    for (const path of [
      "server/assetUploadDb.ts",
      "server/db.ts",
      "server/astroConfigDb.ts",
      "server/funnelConfigDb.ts",
      "server/simpleFormDb.ts",
      "server/workspaceDb.ts",
    ]) {
      const source = readFileSync(path, "utf8");
      const updateCount = source.match(/\.update\(/g)?.length ?? 0;
      const timestampCount = source.match(/\.set\(withUpdatedAt\(/g)?.length ?? 0;
      expect(timestampCount, path).toBe(updateCount);
    }
  });
});
