import {
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { spawn } from "node:child_process";
import { build } from "esbuild";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const REPO_ROOT = path.resolve(import.meta.dirname, "../..");
const PACKAGE_SCRIPT = path.join(REPO_ROOT, "scripts/package-vercel-api.mjs");
const HEALTH_INPUT = encodeURIComponent(JSON.stringify({ json: { timestamp: 0 } }));
const HEALTH_PATH = `/api/trpc/system.health?input=${HEALTH_INPUT}`;
const FORBIDDEN_PRODUCTION_RUNTIME_DEPENDENCIES = [
  "vite",
  "vite.config",
  "@tailwindcss/vite",
  "lightningcss",
  "@tailwindcss/oxide",
] as const;

const DUMMY_PRODUCTION_ENV = {
  NODE_ENV: "production",
  VITE_SUPABASE_URL: "https://project-ref.supabase.co",
  VITE_SUPABASE_PUBLISHABLE_KEY: "publishable-test-key",
  AUTH_ALLOWED_EMAILS: "owner@example.com",
  AUTH_ADMIN_EMAILS: "owner@example.com",
  JWT_SECRET: "legacy-decryption-test-key",
  DATABASE_URL: "postgresql://runtime.invalid/site-launchpad",
  R2_ACCOUNT_ID: "0123456789abcdef0123456789abcdef",
  R2_ACCESS_KEY_ID: "test-access-key",
  R2_SECRET_ACCESS_KEY: "test-secret-key",
  R2_BUCKET: "site-launchpad-assets",
  R2_PUBLIC_ASSET_BASE_URL: "https://assets.example.com",
  SECRETS_ENCRYPTION_KEY: "encryption-test-key",
} as const;

type NodeCommandResult = {
  code: number;
  stdout: string;
  stderr: string;
};

type HandlerProbe = {
  status: number;
  contentType: string | null;
  body: string;
};

type HandlerProbeRequest = {
  url: string;
  method?: "GET" | "POST";
  body?: unknown;
};

const tempDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    tempDirectories.splice(0).map(directory =>
      rm(directory, { recursive: true, force: true }),
    ),
  );
});

function sanitizedNodeEnv(
  extra: NodeJS.ProcessEnv = {},
): NodeJS.ProcessEnv {
  return {
    PATH: process.env.PATH,
    TMPDIR: process.env.TMPDIR,
    HOME: process.env.HOME,
    ...DUMMY_PRODUCTION_ENV,
    ...extra,
  };
}

async function createTempDirectory(prefix: string): Promise<string> {
  const directory = await mkdtemp(path.join(process.env.TMPDIR ?? "/tmp", prefix));
  tempDirectories.push(directory);
  return directory;
}

function runNode(
  args: string[],
  cwd: string,
  extraEnv: NodeJS.ProcessEnv = {},
): Promise<NodeCommandResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, {
      cwd,
      env: sanitizedNodeEnv(extraEnv),
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", chunk => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", chunk => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", code => {
      resolve({ code: code ?? 1, stdout, stderr });
    });
  });
}

async function packageProductionApiLayout(outDir: string): Promise<{
  catchAllPath: string;
  handlerBundlePath: string;
  indexPath: string;
  serverBundlePath: string;
  trpcPath: string;
}> {
  await writeFile(
    path.join(outDir, "package.json"),
    JSON.stringify({ type: "module" }),
  );
  await symlink(
    path.join(REPO_ROOT, "node_modules"),
    path.join(outDir, "node_modules"),
    "dir",
  );
  await mkdir(path.join(outDir, "api"), { recursive: true });
  await mkdir(path.join(outDir, "api/trpc"), { recursive: true });
  await mkdir(path.join(outDir, "dist"), { recursive: true });

  const outfile = path.join(outDir, "dist/vercel-api-handler.js");
  const serverBundlePath = path.join(outDir, "dist/index.js");
  const packed = await runNode([PACKAGE_SCRIPT], REPO_ROOT, {
    VERCEL_API_HANDLER_OUTFILE: outfile,
  });
  if (packed.code !== 0) {
    throw new Error(
      `Production API packager failed (${packed.code}): ${packed.stderr || packed.stdout}`,
    );
  }
  await build({
    absWorkingDir: REPO_ROOT,
    entryPoints: [path.join(REPO_ROOT, "server/_core/index.ts")],
    bundle: true,
    format: "esm",
    platform: "node",
    packages: "external",
    outfile: serverBundlePath,
    logLevel: "silent",
  });

  await copyFile(path.join(REPO_ROOT, "api/index.js"), path.join(outDir, "api/index.js"));
  await copyFile(
    path.join(REPO_ROOT, "api/[...path].js"),
    path.join(outDir, "api/[...path].js"),
  );
  await copyFile(
    path.join(REPO_ROOT, "api/trpc/[procedure].js"),
    path.join(outDir, "api/trpc/[procedure].js"),
  );

  return {
    catchAllPath: path.join(outDir, "api/[...path].js"),
    handlerBundlePath: outfile,
    indexPath: path.join(outDir, "api/index.js"),
    serverBundlePath,
    trpcPath: path.join(outDir, "api/trpc/[procedure].js"),
  };
}

async function probeEmittedHandler(
  handlerFile: string,
  request: HandlerProbeRequest,
  cwd: string,
): Promise<HandlerProbe> {
  const runner = path.join(cwd, "probe-handler.mjs");
  await writeFile(
    runner,
    `${[
      'import http from "node:http";',
      'import { pathToFileURL } from "node:url";',
      "const handlerFile = process.argv[2];",
      "const requestUrl = process.argv[3];",
      'const method = process.argv[4] ?? "GET";',
      "const rawBody = process.argv[5] || undefined;",
      "const { default: handler } = await import(pathToFileURL(handlerFile).href);",
      "const server = http.createServer((incoming, response) => {",
      "  Promise.resolve(handler(incoming, response)).catch((error) => {",
      "    console.error(error);",
      "    process.exit(1);",
      "  });",
      "});",
      'await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));',
      "const address = server.address();",
      'if (!address || typeof address === "string") throw new Error("expected TCP address");',
      "const response = await fetch(`http://127.0.0.1:${address.port}${requestUrl}`, {",
      "  method,",
      '  headers: rawBody ? { "content-type": "application/json" } : undefined,',
      '  body: method === "GET" || method === "HEAD" ? undefined : rawBody,',
      "});",
      "const body = await response.text();",
      "process.stdout.write(JSON.stringify({",
      "  status: response.status,",
      "  contentType: response.headers.get(\"content-type\"),",
      "  body,",
      "}));",
      "await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));",
    ].join("\n")}\n`,
  );

  const result = await runNode(
    [
      runner,
      handlerFile,
      request.url,
      request.method ?? "GET",
      request.body === undefined ? "" : JSON.stringify(request.body),
    ],
    cwd,
  );
  if (result.code !== 0) {
    throw new Error(
      `Emitted handler probe failed (${result.code}): ${result.stderr || result.stdout}`,
    );
  }

  return JSON.parse(result.stdout) as HandlerProbe;
}

describe("emitted Vercel API function packaging", () => {
  it("invokes the exact, catch-all, and nested tRPC production artifacts", async () => {
    const outDir = await createTempDirectory("site-launchpad-vercel-api-");
    const {
      catchAllPath,
      handlerBundlePath,
      indexPath,
      serverBundlePath,
      trpcPath,
    } = await packageProductionApiLayout(outDir);

    for (const bundlePath of [serverBundlePath, handlerBundlePath]) {
      const bundle = await readFile(bundlePath, "utf8");
      for (const dependency of FORBIDDEN_PRODUCTION_RUNTIME_DEPENDENCIES) {
        expect(
          bundle,
          `${path.basename(bundlePath)} contains ${dependency}`,
        ).not.toContain(dependency);
      }
    }

    const missing = await probeEmittedHandler(
      catchAllPath,
      { url: "/api/not-a-route" },
      outDir,
    );
    expect(missing.status).toBe(404);
    expect(missing.contentType).toMatch(/json/i);
    expect(missing.body).not.toContain("<html");
    expect(JSON.parse(missing.body)).toEqual({ error: "Not Found" });

    const health = await probeEmittedHandler(
      trpcPath,
      { url: HEALTH_PATH },
      outDir,
    );
    expect(health.status).toBe(200);
    expect(health.contentType).toMatch(/json/i);
    expect(health.body).not.toContain("<html");
    expect(JSON.parse(health.body)).toMatchObject({
      result: { data: { json: { ok: true } } },
    });

    const healthPost = await probeEmittedHandler(
      trpcPath,
      {
        url: "/api/trpc/system.health",
        method: "POST",
        body: { json: { timestamp: 0 } },
      },
      outDir,
    );
    expect(healthPost.status).not.toBe(404);
    expect(healthPost.body).not.toContain("<html");
    expect(healthPost.body).not.toContain("<!doctype html>");
    expect(JSON.stringify(JSON.parse(healthPost.body))).not.toEqual(
      JSON.stringify({ error: "Not Found" }),
    );

    const exactApi = await probeEmittedHandler(
      indexPath,
      { url: "/api" },
      outDir,
    );
    expect(exactApi.status).toBe(404);
    expect(exactApi.contentType).toMatch(/json/i);
    expect(JSON.parse(exactApi.body)).toEqual({ error: "Not Found" });
  }, 15_000);
});
