import {
  describeHostnameAttachedToOtherWorker,
  liveUrlForHostname,
  zoneNameCandidates,
} from "../../shared/liveSiteHostname";
import {
  RequestTimeoutError,
  fetchAwaitingCancellation,
  type FetchFunction,
} from "../../shared/requestTimeout";

export const CLOUDFLARE_REQUEST_TIMEOUT_MS = 10_000;

export type ProvisionedKvNamespace = {
  id: string;
  title: string;
  created: boolean;
};

export type ProvisionedD1Database = {
  id: string;
  name: string;
  created: boolean;
};

export type ProvisionedR2Bucket = {
  id: string;
  name: string;
  publicUrl: string;
  created: boolean;
};

export type ProvisionedQueue = {
  id: string;
  name: string;
  created: boolean;
};

export type ProvisionedQueues = {
  primary: ProvisionedQueue;
  deadLetter: ProvisionedQueue;
};

export type WorkerSecretInput = {
  name: string;
  value: string;
};

export type WorkersDevStatus = {
  enabled: boolean;
  previewsEnabled: boolean;
  url: string | null;
};

export type AttachedWorkerCustomDomain = {
  hostname: string;
  liveUrl: string;
};

export type CloudflareApiClient = {
  ensureKvNamespace(
    title: string,
    signal: AbortSignal
  ): Promise<ProvisionedKvNamespace>;
  ensureD1Database(
    name: string,
    signal: AbortSignal
  ): Promise<ProvisionedD1Database>;
  ensureR2Bucket(
    name: string,
    signal: AbortSignal,
  ): Promise<ProvisionedR2Bucket>;
  ensureQueues(input: {
    primary: string;
    deadLetter: string;
    signal: AbortSignal;
  }): Promise<ProvisionedQueues>;
  patchWorkerSecrets(input: {
    scriptName: string;
    secrets: readonly WorkerSecretInput[];
    signal: AbortSignal;
  }): Promise<{ updatedSecretNames: string[] }>;
  getWorkersDevStatus(input: {
    scriptName: string;
    signal: AbortSignal;
  }): Promise<WorkersDevStatus>;
  attachWorkerCustomDomain(input: {
    scriptName: string;
    hostname: string;
    reassign?: boolean;
    signal: AbortSignal;
  }): Promise<AttachedWorkerCustomDomain>;
  putR2Object(input: {
    bucket: string;
    key: string;
    body: Buffer;
    contentType: string;
    signal: AbortSignal;
  }): Promise<void>;
  getR2Object(input: {
    bucket: string;
    key: string;
    signal: AbortSignal;
  }): Promise<{ body: Buffer; contentType: string } | null>;
  deleteR2Object(input: {
    bucket: string;
    key: string;
    signal: AbortSignal;
  }): Promise<void>;
};

export class CloudflareApiError extends Error {
  readonly code = "CLOUDFLARE_API_ERROR";

  constructor(
    readonly operation: string,
    readonly status?: number,
    readonly apiCode?: number
  ) {
    super(
      status === undefined
        ? `Cloudflare ${operation} failed.`
        : `Cloudflare ${operation} failed with HTTP ${status}${
            apiCode === undefined ? "" : ` (code ${apiCode})`
          }.`
    );
    this.name = "CloudflareApiError";
  }
}

type CloudflareRequest = (
  operation: string,
  path: string,
  init: RequestInit
) => Promise<Record<string, unknown>>;

type KvNamespace = {
  id: string;
  title: string;
};

type D1Database = {
  id: string;
  name: string;
};

type Queue = {
  id: string;
  name: string;
};

type R2Bucket = { name: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function parseCloudflareApiCode(value: unknown): number | undefined {
  if (!isRecord(value) || !Array.isArray(value.errors)) return undefined;
  const firstError = value.errors[0];
  if (!isRecord(firstError)) return undefined;
  const code = firstError.code;
  return typeof code === "number" && Number.isSafeInteger(code)
    ? code
    : undefined;
}

function requireRecord(
  value: unknown,
  operation: string
): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new CloudflareApiError(`${operation} response validation`);
  }
  return value;
}

function requireString(
  record: Record<string, unknown>,
  field: string,
  operation: string
): string {
  const value = record[field];
  if (typeof value !== "string" || !value) {
    throw new CloudflareApiError(`${operation} response validation`);
  }
  return value;
}

function parseEnvelope(
  value: unknown,
  operation: string
): Record<string, unknown> {
  const envelope = requireRecord(value, operation);
  if (envelope.success !== true) {
    throw new CloudflareApiError(operation);
  }
  return envelope;
}

function parseResultRecord(
  envelope: Record<string, unknown>,
  operation: string
): Record<string, unknown> {
  return requireRecord(envelope.result, operation);
}

function resultTotalPages(
  envelope: Record<string, unknown>,
  requestedPage: number,
  resultCount: number,
  operation: string
): number {
  if (envelope.result_info === undefined) {
    return resultCount === 100 ? requestedPage + 1 : requestedPage;
  }
  const resultInfo = requireRecord(envelope.result_info, operation);
  const page = resultInfo.page;
  if (
    typeof page !== "number" ||
    !Number.isSafeInteger(page) ||
    page !== requestedPage
  ) {
    throw new CloudflareApiError(`${operation} response validation`);
  }
  let totalPages: number;
  if (resultInfo.total_pages !== undefined) {
    const suppliedTotalPages = resultInfo.total_pages;
    if (
      typeof suppliedTotalPages !== "number" ||
      !Number.isSafeInteger(suppliedTotalPages) ||
      suppliedTotalPages < 0
    ) {
      throw new CloudflareApiError(`${operation} response validation`);
    }
    totalPages = suppliedTotalPages;
  } else {
    const perPage = resultInfo.per_page;
    const totalCount = resultInfo.total_count;
    if (
      typeof perPage !== "number" ||
      !Number.isSafeInteger(perPage) ||
      perPage <= 0 ||
      typeof totalCount !== "number" ||
      !Number.isSafeInteger(totalCount) ||
      totalCount < 0
    ) {
      throw new CloudflareApiError(`${operation} response validation`);
    }
    totalPages = Math.ceil(totalCount / perPage);
  }
  return Math.max(page, totalPages);
}

function parseKvNamespace(value: unknown, operation: string): KvNamespace {
  const record = requireRecord(value, operation);
  return {
    id: requireString(record, "id", operation),
    title: requireString(record, "title", operation),
  };
}

function parseD1Database(value: unknown, operation: string): D1Database {
  const record = requireRecord(value, operation);
  return {
    id: requireString(record, "uuid", operation),
    name: requireString(record, "name", operation),
  };
}

function parseQueue(value: unknown, operation: string): Queue {
  const record = requireRecord(value, operation);
  return {
    id: requireString(record, "queue_id", operation),
    name: requireString(record, "queue_name", operation),
  };
}

function parseR2Bucket(value: unknown, operation: string): R2Bucket {
  const record = requireRecord(value, operation);
  return { name: requireString(record, "name", operation) };
}

function createObjectRequest(options: {
  accountId: string;
  apiToken: string;
  fetchFn: FetchFunction;
}) {
  const fetchObject = createObjectFetch(options);
  return async (
    operation: string,
    path: string,
    init: RequestInit,
  ): Promise<void> => {
    await fetchObject(operation, path, init);
  };
}

function createObjectFetch(options: {
  accountId: string;
  apiToken: string;
  fetchFn: FetchFunction;
}) {
  return async (
    operation: string,
    path: string,
    init: RequestInit,
  ): Promise<Response> => {
    init.signal?.throwIfAborted();
    let response: Response;
    try {
      response = await fetchAwaitingCancellation(
        options.fetchFn,
        `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(options.accountId)}${path}`,
        {
          ...init,
          headers: {
            Authorization: `Bearer ${options.apiToken}`,
            ...(init.headers ?? {}),
          },
        },
        CLOUDFLARE_REQUEST_TIMEOUT_MS,
      );
    } catch (error) {
      if (error instanceof RequestTimeoutError) throw error;
      if (init.signal?.aborted) throw init.signal.reason ?? error;
      throw new CloudflareApiError(operation);
    }
    if (!response.ok) {
      throw new CloudflareApiError(operation, response.status);
    }
    return response;
  };
}

function createRequest(options: {
  baseUrl: string;
  apiToken: string;
  fetchFn: FetchFunction;
}): CloudflareRequest {
  return async (operation, path, init) => {
    init.signal?.throwIfAborted();
    let response: Response;
    try {
      response = await fetchAwaitingCancellation(
        options.fetchFn,
        `${options.baseUrl}${path}`,
        {
          ...init,
          headers: {
            Authorization: `Bearer ${options.apiToken}`,
            "Content-Type": "application/json",
            ...(init.headers ?? {}),
          },
        },
        CLOUDFLARE_REQUEST_TIMEOUT_MS
      );
    } catch (error) {
      if (error instanceof RequestTimeoutError) throw error;
      if (init.signal?.aborted) throw init.signal.reason ?? error;
      throw new CloudflareApiError(operation);
    }
    if (!response.ok) {
      let apiCode: number | undefined;
      try {
        apiCode = parseCloudflareApiCode(await response.json());
      } catch {
        // Error bodies are deliberately discarded. Only a numeric API code is
        // safe and useful enough to carry into publisher diagnostics.
      }
      throw new CloudflareApiError(operation, response.status, apiCode);
    }
    try {
      const body: unknown = await response.json();
      return parseEnvelope(body, operation);
    } catch (error) {
      if (error instanceof CloudflareApiError) throw error;
      throw new CloudflareApiError(`${operation} response validation`);
    }
  };
}

async function listPaginated<T>(
  request: CloudflareRequest,
  operation: string,
  path: string,
  parseItem: (value: unknown, operationName: string) => T,
  signal: AbortSignal
): Promise<T[]> {
  const items: T[] = [];
  let page = 1;
  while (true) {
    signal.throwIfAborted();
    const separator = path.includes("?") ? "&" : "?";
    const envelope = await request(
      operation,
      `${path}${separator}page=${page}&per_page=100`,
      { method: "GET", signal }
    );
    if (!Array.isArray(envelope.result)) {
      throw new CloudflareApiError(`${operation} response validation`);
    }
    items.push(...envelope.result.map(value => parseItem(value, operation)));
    const totalPages = resultTotalPages(
      envelope,
      page,
      envelope.result.length,
      operation
    );
    if (page >= totalPages) return items;
    page += 1;
  }
}

function provisionedKv(
  namespace: KvNamespace,
  created: boolean
): ProvisionedKvNamespace {
  return { ...namespace, created };
}

function provisionedD1(
  database: D1Database,
  created: boolean
): ProvisionedD1Database {
  return { ...database, created };
}

function provisionedQueue(queue: Queue, created: boolean): ProvisionedQueue {
  return { ...queue, created };
}

const WORKER_NAME_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
const HOSTNAME_PATTERN =
  /^(?=.{1,253}$)[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/;

type WorkerCustomDomain = {
  hostname: string;
  service: string;
  id?: string;
};

function parseWorkerCustomDomain(
  value: unknown,
  operation: string,
): WorkerCustomDomain {
  const record = requireRecord(value, operation);
  const id = typeof record.id === "string" ? record.id.trim() : "";
  return {
    hostname: requireString(record, "hostname", operation).toLowerCase(),
    service: requireString(record, "service", operation),
    ...(id ? { id } : {}),
  };
}

function r2ObjectPath(bucket: string, key: string): string {
  const encodedKey = key.split("/").map(encodeURIComponent).join("/");
  return `/r2/buckets/${encodeURIComponent(bucket)}/objects/${encodedKey}`;
}

export function createCloudflareApiClient(options: {
  accountId: string;
  apiToken: string;
  fetchFn?: FetchFunction;
}): CloudflareApiClient {
  const fetchFn = options.fetchFn ?? globalThis.fetch;
  const request = createRequest({
    baseUrl: `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(options.accountId)}`,
    apiToken: options.apiToken,
    fetchFn,
  });
  const platformRequest = createRequest({
    baseUrl: "https://api.cloudflare.com/client/v4",
    apiToken: options.apiToken,
    fetchFn,
  });
  const objectRequest = createObjectRequest({
    accountId: options.accountId,
    apiToken: options.apiToken,
    fetchFn,
  });
  const objectFetch = createObjectFetch({
    accountId: options.accountId,
    apiToken: options.apiToken,
    fetchFn,
  });

  return {
    async ensureKvNamespace(title, signal) {
      const operation = "KV namespace listing";
      const namespaces = await listPaginated(
        request,
        operation,
        "/storage/kv/namespaces",
        parseKvNamespace,
        signal
      );
      const existing = namespaces.find(namespace => namespace.title === title);
      if (existing) return provisionedKv(existing, false);

      signal.throwIfAborted();
      const envelope = await request(
        "KV namespace creation",
        "/storage/kv/namespaces",
        {
          method: "POST",
          body: JSON.stringify({ title }),
          signal,
        }
      );
      return provisionedKv(
        parseKvNamespace(
          parseResultRecord(envelope, "KV namespace creation"),
          "KV namespace creation"
        ),
        true
      );
    },
    async ensureD1Database(name, signal) {
      const operation = "D1 database listing";
      const databases = await listPaginated(
        request,
        operation,
        "/d1/database",
        parseD1Database,
        signal
      );
      const existing = databases.find(database => database.name === name);
      if (existing) return provisionedD1(existing, false);

      signal.throwIfAborted();
      const envelope = await request("D1 database creation", "/d1/database", {
        method: "POST",
        body: JSON.stringify({ name }),
        signal,
      });
      return provisionedD1(
        parseD1Database(
          parseResultRecord(envelope, "D1 database creation"),
          "D1 database creation"
        ),
        true
      );
    },
    async ensureR2Bucket(name, signal) {
      const listOperation = "R2 bucket listing";
      const listEnvelope = await request(
        listOperation,
        `/r2/buckets?name_contains=${encodeURIComponent(name)}&per_page=1000`,
        { method: "GET", signal },
      );
      const listResult = parseResultRecord(listEnvelope, listOperation);
      if (!Array.isArray(listResult.buckets)) {
        throw new CloudflareApiError(`${listOperation} response validation`);
      }
      const buckets = listResult.buckets.map(value =>
        parseR2Bucket(value, listOperation),
      );
      let created = false;
      if (!buckets.some(bucket => bucket.name === name)) {
        signal.throwIfAborted();
        const createdEnvelope = await request(
          "R2 bucket creation",
          "/r2/buckets",
          {
            method: "POST",
            body: JSON.stringify({ name }),
            signal,
          },
        );
        const bucket = parseR2Bucket(
          parseResultRecord(createdEnvelope, "R2 bucket creation"),
          "R2 bucket creation",
        );
        if (bucket.name !== name) {
          throw new CloudflareApiError(
            "R2 bucket creation response validation",
          );
        }
        created = true;
      }

      signal.throwIfAborted();
      const publicEnvelope = await request(
        "R2 managed domain enablement",
        `/r2/buckets/${encodeURIComponent(name)}/domains/managed`,
        {
          method: "PUT",
          body: JSON.stringify({ enabled: true }),
          signal,
        },
      );
      const publicResult = parseResultRecord(
        publicEnvelope,
        "R2 managed domain enablement",
      );
      if (publicResult.enabled !== true) {
        throw new CloudflareApiError(
          "R2 managed domain enablement response validation",
        );
      }
      const id = requireString(
        publicResult,
        "bucketId",
        "R2 managed domain enablement",
      );
      const domain = requireString(
        publicResult,
        "domain",
        "R2 managed domain enablement",
      );
      return { id, name, publicUrl: `https://${domain}`, created };
    },
    async ensureQueues(input) {
      if (input.primary === input.deadLetter) {
        throw new Error("Primary and dead-letter queue names must differ.");
      }
      const operation = "Queue listing";
      const queues = await listPaginated(
        request,
        operation,
        "/queues",
        parseQueue,
        input.signal
      );
      const ensureQueue = async (name: string): Promise<ProvisionedQueue> => {
        input.signal.throwIfAborted();
        const existing = queues.find(queue => queue.name === name);
        if (existing) return provisionedQueue(existing, false);
        const envelope = await request("Queue creation", "/queues", {
          method: "POST",
          body: JSON.stringify({ queue_name: name }),
          signal: input.signal,
        });
        return provisionedQueue(
          parseQueue(
            parseResultRecord(envelope, "Queue creation"),
            "Queue creation"
          ),
          true
        );
      };
      const primary = await ensureQueue(input.primary);
      const deadLetter = await ensureQueue(input.deadLetter);
      return { primary, deadLetter };
    },
    async patchWorkerSecrets(input) {
      if (input.secrets.length === 0) {
        throw new Error("At least one runtime secret is required.");
      }
      const names = input.secrets.map(secret => secret.name);
      if (new Set(names).size !== names.length) {
        throw new Error("Runtime secret names must be unique.");
      }
      if (input.secrets.some(secret => !secret.value)) {
        throw new Error("Runtime secret values must not be empty.");
      }
      const secrets: Record<
        string,
        { name: string; type: "secret_text"; text: string }
      > = {};
      for (const secret of input.secrets) {
        secrets[secret.name] = {
          name: secret.name,
          type: "secret_text",
          text: secret.value,
        };
      }
      await request(
        "bulk secret update",
        `/workers/scripts/${encodeURIComponent(input.scriptName)}/secrets-bulk`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/merge-patch+json",
          },
          body: JSON.stringify({ secrets }),
          signal: input.signal,
        }
      );
      return { updatedSecretNames: names };
    },
    async getWorkersDevStatus(input) {
      if (!WORKER_NAME_PATTERN.test(input.scriptName)) {
        throw new Error(
          "Worker script name must be a valid workers.dev label."
        );
      }
      const statusEnvelope = await request(
        "workers.dev status lookup",
        `/workers/scripts/${encodeURIComponent(input.scriptName)}/subdomain`,
        { method: "GET", signal: input.signal }
      );
      const status = parseResultRecord(
        statusEnvelope,
        "workers.dev status lookup"
      );
      if (
        typeof status.enabled !== "boolean" ||
        typeof status.previews_enabled !== "boolean"
      ) {
        throw new CloudflareApiError(
          "workers.dev status lookup response validation"
        );
      }
      if (!status.enabled) {
        return {
          enabled: false,
          previewsEnabled: status.previews_enabled,
          url: null,
        };
      }
      input.signal.throwIfAborted();
      const subdomainEnvelope = await request(
        "workers.dev subdomain lookup",
        "/workers/subdomain",
        { method: "GET", signal: input.signal }
      );
      const subdomain = requireString(
        parseResultRecord(subdomainEnvelope, "workers.dev subdomain lookup"),
        "subdomain",
        "workers.dev subdomain lookup"
      );
      return {
        enabled: true,
        previewsEnabled: status.previews_enabled,
        url: `https://${input.scriptName}.${subdomain}.workers.dev`,
      };
    },
    async attachWorkerCustomDomain(input) {
      if (!WORKER_NAME_PATTERN.test(input.scriptName)) {
        throw new Error("Worker script name must be a valid workers.dev label.");
      }
      const hostname = input.hostname.trim().toLowerCase();
      if (!HOSTNAME_PATTERN.test(hostname)) {
        throw new Error("Site URL must be a real domain, such as www.theclient.com.");
      }
      const existingEnvelope = await request(
        "Worker custom domain lookup",
        `/workers/domains?hostname=${encodeURIComponent(hostname)}`,
        { method: "GET", signal: input.signal },
      );
      const existingDomains = Array.isArray(existingEnvelope.result)
        ? existingEnvelope.result.map(value =>
            parseWorkerCustomDomain(value, "Worker custom domain lookup"),
          )
        : existingEnvelope.result === undefined || existingEnvelope.result === null
          ? []
          : [parseWorkerCustomDomain(existingEnvelope.result, "Worker custom domain lookup")];
      const existing = existingDomains.find(domain => domain.hostname === hostname);
      if (existing) {
        if (existing.service === input.scriptName) {
          return { hostname, liveUrl: liveUrlForHostname(hostname) };
        }
        if (input.reassign !== true) {
          throw new Error(
            describeHostnameAttachedToOtherWorker(hostname, existing.service),
          );
        }
        if (!existing.id) {
          throw new Error(
            `Cannot move ${hostname} from ${existing.service}: Cloudflare did not return a domain id.`,
          );
        }
        input.signal.throwIfAborted();
        await request(
          "Worker custom domain detach",
          `/workers/domains/${encodeURIComponent(existing.id)}`,
          { method: "DELETE", signal: input.signal },
        );
      }
      let zoneId: string | null = null;
      for (const zoneName of zoneNameCandidates(hostname)) {
        input.signal.throwIfAborted();
        const zoneEnvelope = await platformRequest(
          "zone lookup",
          `/zones?name=${encodeURIComponent(zoneName)}&account.id=${encodeURIComponent(options.accountId)}&status=active`,
          { method: "GET", signal: input.signal },
        );
        if (!Array.isArray(zoneEnvelope.result)) {
          throw new CloudflareApiError("zone lookup response validation");
        }
        const zone = zoneEnvelope.result.find(value => {
          if (!isRecord(value)) return false;
          return value.name === zoneName && typeof value.id === "string" && value.id.length > 0;
        });
        if (zone && isRecord(zone) && typeof zone.id === "string") {
          zoneId = zone.id;
          break;
        }
      }
      if (!zoneId) {
        throw new Error(
          `No Cloudflare zone matches ${hostname}. Add that domain to this Cloudflare account first.`,
        );
      }
      input.signal.throwIfAborted();
      const attachedEnvelope = await request(
        "Worker custom domain attach",
        "/workers/domains",
        {
          method: "PUT",
          body: JSON.stringify({
            hostname,
            service: input.scriptName,
            environment: "production",
            zone_id: zoneId,
          }),
          signal: input.signal,
        },
      );
      const attached = parseWorkerCustomDomain(
        parseResultRecord(attachedEnvelope, "Worker custom domain attach"),
        "Worker custom domain attach",
      );
      if (attached.hostname !== hostname || attached.service !== input.scriptName) {
        throw new CloudflareApiError("Worker custom domain attach response validation");
      }
      return { hostname, liveUrl: liveUrlForHostname(hostname) };
    },
    async putR2Object(input) {
      await objectRequest(
        "R2 object upload",
        r2ObjectPath(input.bucket, input.key),
        {
          method: "PUT",
          headers: {
            "Content-Type": input.contentType,
          },
          body: new Uint8Array(input.body),
          signal: input.signal,
        },
      );
    },
    async getR2Object(input) {
      try {
        const response = await objectFetch(
          "R2 object download",
          r2ObjectPath(input.bucket, input.key),
          {
            method: "GET",
            signal: input.signal,
          },
        );
        return {
          body: Buffer.from(await response.arrayBuffer()),
          contentType: response.headers.get("content-type") || "application/octet-stream",
        };
      } catch (error) {
        if (error instanceof CloudflareApiError && error.status === 404) return null;
        throw error;
      }
    },
    async deleteR2Object(input) {
      await objectRequest(
        "R2 object deletion",
        r2ObjectPath(input.bucket, input.key),
        {
          method: "DELETE",
          signal: input.signal,
        },
      );
    },
  };
}
