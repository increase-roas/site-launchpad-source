import { spawnSync } from "node:child_process";
import path from "node:path";
import { describe, expect, it } from "vitest";

const repositoryRoot = path.resolve(import.meta.dirname, "..");
const directUrl = "postgresql://direct.invalid/site-launchpad";
const runtimeUrl = "postgresql://runtime.invalid/site-launchpad";
const inspectMigrationConfig = `
const config = (await import("./drizzle.config.ts")).default;
const configuredUrl = config.dbCredentials?.url;
if (configuredUrl !== process.env.EXPECTED_DATABASE_URL) process.exit(2);
if (
  process.env.FORBIDDEN_DATABASE_URL &&
  configuredUrl === process.env.FORBIDDEN_DATABASE_URL
) process.exit(3);
`;

type MigrationConfigEnvironment = {
  directUrl?: string;
  runtimeUrl?: string;
  expectedUrl: string;
  forbiddenUrl?: string;
};

function runMigrationConfig(environment: MigrationConfigEnvironment) {
  const childEnvironment: NodeJS.ProcessEnv = {
    PATH: process.env.PATH,
    DATABASE_DIRECT_URL: environment.directUrl,
    DATABASE_URL: environment.runtimeUrl,
    EXPECTED_DATABASE_URL: environment.expectedUrl,
    FORBIDDEN_DATABASE_URL: environment.forbiddenUrl,
  };

  return spawnSync(
    process.execPath,
    ["--import", "tsx", "--input-type=module", "--eval", inspectMigrationConfig],
    {
      cwd: repositoryRoot,
      encoding: "utf8",
      env: childEnvironment,
    },
  );
}

describe("Drizzle migration connection configuration", () => {
  it("accepts DATABASE_DIRECT_URL", () => {
    const result = runMigrationConfig({
      directUrl,
      expectedUrl: directUrl,
    });

    expect(result.status).toBe(0);
  });

  it("rejects DATABASE_URL when DATABASE_DIRECT_URL is absent", () => {
    const result = runMigrationConfig({
      runtimeUrl,
      expectedUrl: runtimeUrl,
    });

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain(
      "DATABASE_DIRECT_URL is required for migration tooling.",
    );
  });

  it("never returns DATABASE_URL when both URLs are present", () => {
    const result = runMigrationConfig({
      directUrl,
      runtimeUrl,
      expectedUrl: directUrl,
      forbiddenUrl: runtimeUrl,
    });

    expect(result.status).toBe(0);
  });
});
