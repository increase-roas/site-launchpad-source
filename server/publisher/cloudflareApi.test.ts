import { describe, expect, it } from "vitest";
import type { FetchFunction } from "../../shared/requestTimeout";
import {
  CLOUDFLARE_REQUEST_TIMEOUT_MS,
  CloudflareApiError,
  createCloudflareApiClient,
} from "./cloudflareApi";

type RecordedRequest = {
  url: string;
  init: RequestInit | undefined;
};

function jsonResponse(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function successEnvelope(
  result: unknown,
  resultInfo?: Record<string, number>
): Response {
  return jsonResponse({
    success: true,
    errors: [],
    messages: [],
    result,
    ...(resultInfo ? { result_info: resultInfo } : {}),
  });
}

function createMockFetch(responses: readonly Response[]): {
  fetchFn: FetchFunction;
  requests: RecordedRequest[];
} {
  const pending = [...responses];
  const requests: RecordedRequest[] = [];
  const fetchFn: FetchFunction = async (input, init) => {
    requests.push({ url: String(input), init });
    const response = pending.shift();
    if (!response) throw new Error("Unexpected mocked request.");
    return response;
  };
  return { fetchFn, requests };
}

function parseRequestBody(
  request: RecordedRequest | undefined
): Record<string, unknown> {
  if (!request || typeof request.init?.body !== "string") {
    throw new Error("Expected a JSON request body.");
  }
  const parsed: unknown = JSON.parse(request.init.body);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Expected a JSON object request body.");
  }
  return parsed as Record<string, unknown>;
}

function createClient(fetchFn: FetchFunction) {
  return createCloudflareApiClient({
    accountId: "0123456789abcdef0123456789abcdef",
    apiToken: "opaque-cloudflare-credential",
    fetchFn,
  });
}

function activeSignal(): AbortSignal {
  return new AbortController().signal;
}

describe("Cloudflare publisher client", () => {
  it("uses the ten-second publisher request deadline", () => {
    expect(CLOUDFLARE_REQUEST_TIMEOUT_MS).toBe(10_000);
  });

  it("paginates KV namespaces and reuses an existing namespace before creating", async () => {
    const { fetchFn, requests } = createMockFetch([
      successEnvelope([{ id: "kv-unrelated", title: "unrelated" }], {
        page: 1,
        per_page: 1,
        total_count: 2,
        count: 1,
      }),
      successEnvelope(
        [{ id: "kv-target", title: "northland-funnel-sessions" }],
        { page: 2, per_page: 1, total_count: 2, count: 1 }
      ),
    ]);

    const result = await createClient(fetchFn).ensureKvNamespace(
      "northland-funnel-sessions",
      activeSignal()
    );

    expect(result).toEqual({
      id: "kv-target",
      title: "northland-funnel-sessions",
      created: false,
    });
    expect(requests).toHaveLength(2);
    expect(requests.every(request => request.init?.method === "GET")).toBe(
      true
    );
    expect(requests[1]?.url).toContain("page=2");
  });

  it("continues a full page when result metadata is omitted", async () => {
    const firstPage = Array.from({ length: 100 }, (_, index) => ({
      id: `kv-${index}`,
      title: `namespace-${index}`,
    }));
    const { fetchFn, requests } = createMockFetch([
      successEnvelope(firstPage),
      successEnvelope([
        { id: "kv-target", title: "northland-funnel-sessions" },
      ]),
    ]);

    const result = await createClient(fetchFn).ensureKvNamespace(
      "northland-funnel-sessions",
      activeSignal()
    );

    expect(result.created).toBe(false);
    expect(result.id).toBe("kv-target");
    expect(requests).toHaveLength(2);
  });

  it("lists D1 databases first and creates only when no name matches", async () => {
    const { fetchFn, requests } = createMockFetch([
      successEnvelope([], {
        page: 1,
        per_page: 100,
        total_pages: 1,
        total_count: 0,
        count: 0,
      }),
      successEnvelope({
        uuid: "00000000-0000-0000-0000-000000000001",
        name: "northland-paid-funnel-events",
      }),
    ]);

    const result = await createClient(fetchFn).ensureD1Database(
      "northland-paid-funnel-events",
      activeSignal()
    );

    expect(result).toEqual({
      id: "00000000-0000-0000-0000-000000000001",
      name: "northland-paid-funnel-events",
      created: true,
    });
    expect(requests.map(request => request.init?.method)).toEqual([
      "GET",
      "POST",
    ]);
    expect(parseRequestBody(requests[1])).toEqual({
      name: "northland-paid-funnel-events",
    });
  });

  it("reuses an R2 bucket and idempotently enables its managed public domain", async () => {
    const { fetchFn, requests } = createMockFetch([
      successEnvelope({ buckets: [{ name: "northland-product-images" }] }),
      successEnvelope({
        bucketId: "0123456789abcdef0123456789abcdef",
        domain: "pub-example.r2.dev",
        enabled: true,
      }),
    ]);

    const result = await createClient(fetchFn).ensureR2Bucket(
      "northland-product-images",
      activeSignal(),
    );

    expect(result).toEqual({
      id: "0123456789abcdef0123456789abcdef",
      name: "northland-product-images",
      publicUrl: "https://pub-example.r2.dev",
      created: false,
    });
    expect(requests.map(request => request.init?.method)).toEqual([
      "GET",
      "PUT",
    ]);
    expect(parseRequestBody(requests[1])).toEqual({ enabled: true });
  });

  it("creates a missing R2 bucket before enabling public access", async () => {
    const { fetchFn, requests } = createMockFetch([
      successEnvelope({ buckets: [] }),
      successEnvelope({ name: "northland-product-images" }),
      successEnvelope({
        bucketId: "0123456789abcdef0123456789abcdef",
        domain: "pub-example.r2.dev",
        enabled: true,
      }),
    ]);

    const result = await createClient(fetchFn).ensureR2Bucket(
      "northland-product-images",
      activeSignal(),
    );

    expect(result.created).toBe(true);
    expect(requests.map(request => request.init?.method)).toEqual([
      "GET",
      "POST",
      "PUT",
    ]);
    expect(parseRequestBody(requests[1])).toEqual({
      name: "northland-product-images",
    });
  });

  it("provisions exactly one primary and one dead-letter queue list-first", async () => {
    const { fetchFn, requests } = createMockFetch([
      successEnvelope(
        [{ queue_id: "queue-primary", queue_name: "northland-capi-retries" }],
        { page: 1, per_page: 1, total_pages: 2, total_count: 2, count: 1 }
      ),
      successEnvelope([{ queue_id: "queue-other", queue_name: "unrelated" }], {
        page: 2,
        per_page: 1,
        total_pages: 2,
        total_count: 2,
        count: 1,
      }),
      successEnvelope({
        queue_id: "queue-dead-letter",
        queue_name: "northland-capi-dead-letter",
      }),
    ]);

    const result = await createClient(fetchFn).ensureQueues({
      primary: "northland-capi-retries",
      deadLetter: "northland-capi-dead-letter",
      signal: activeSignal(),
    });

    expect(result).toEqual({
      primary: {
        id: "queue-primary",
        name: "northland-capi-retries",
        created: false,
      },
      deadLetter: {
        id: "queue-dead-letter",
        name: "northland-capi-dead-letter",
        created: true,
      },
    });
    expect(requests.map(request => request.init?.method)).toEqual([
      "GET",
      "GET",
      "POST",
    ]);
    expect(
      requests.filter(request => request.init?.method === "POST")
    ).toHaveLength(1);
  });

  it("sends every supplied runtime secret in one bulk PATCH request", async () => {
    const { fetchFn, requests } = createMockFetch([successEnvelope(null)]);

    const result = await createClient(fetchFn).patchWorkerSecrets({
      scriptName: "northland-simple-form",
      secrets: [
        {
          name: "META_CAPI_ACCESS_TOKEN",
          value: "opaque-meta-credential",
        },
        {
          name: "GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY",
          value: "opaque-google-private-key",
        },
      ],
      signal: activeSignal(),
    });

    expect(result).toEqual({
      updatedSecretNames: [
        "META_CAPI_ACCESS_TOKEN",
        "GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY",
      ],
    });
    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({
      url: "https://api.cloudflare.com/client/v4/accounts/0123456789abcdef0123456789abcdef/workers/scripts/northland-simple-form/secrets-bulk",
      init: {
        method: "PATCH",
        headers: { "Content-Type": "application/merge-patch+json" },
      },
    });
    expect(parseRequestBody(requests[0])).toMatchObject({
      secrets: {
        META_CAPI_ACCESS_TOKEN: {
          name: "META_CAPI_ACCESS_TOKEN",
          type: "secret_text",
          text: expect.any(String),
        },
        GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY: {
          name: "GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY",
          type: "secret_text",
          text: expect.any(String),
        },
      },
    });
  });

  it("retains only the numeric Cloudflare API code from a failed secret update", async () => {
    const { fetchFn } = createMockFetch([
      jsonResponse(
        {
          success: false,
          errors: [
            {
              code: 10215,
              message: "secret-shaped upstream response must not escape",
            },
          ],
        },
        400,
      ),
    ]);

    const failure = await createClient(fetchFn)
      .patchWorkerSecrets({
        scriptName: "northland-simple-form",
        secrets: [{ name: "RUNTIME_SECRET", value: "opaque-secret-value" }],
        signal: activeSignal(),
      })
      .catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(CloudflareApiError);
    expect(failure).toMatchObject({
      status: 400,
      apiCode: 10215,
      message:
        "Cloudflare bulk secret update failed with HTTP 400 (code 10215).",
    });
    expect(JSON.stringify(failure)).not.toContain("secret-shaped");
    expect(JSON.stringify(failure)).not.toContain("opaque-secret-value");
  });

  it("looks up the workers.dev enablement and URL without exposing credentials", async () => {
    const { fetchFn, requests } = createMockFetch([
      successEnvelope({ enabled: true, previews_enabled: false }),
      successEnvelope({ subdomain: "customer-subdomain" }),
    ]);

    const result = await createClient(fetchFn).getWorkersDevStatus({
      scriptName: "northland-simple-form",
      signal: activeSignal(),
    });

    expect(result).toEqual({
      enabled: true,
      previewsEnabled: false,
      url: "https://northland-simple-form.customer-subdomain.workers.dev",
    });
    expect(requests.map(request => request.init?.method)).toEqual([
      "GET",
      "GET",
    ]);
    expect(requests[0]?.url).toContain(
      "/workers/scripts/northland-simple-form/subdomain"
    );
    expect(requests[1]?.url).toContain("/workers/subdomain");
  });

  it("rejects duplicate queue names before making a request", async () => {
    const { fetchFn, requests } = createMockFetch([]);

    await expect(
      createClient(fetchFn).ensureQueues({
        primary: "same-queue",
        deadLetter: "same-queue",
        signal: activeSignal(),
      })
    ).rejects.toThrow("Primary and dead-letter queue names must differ.");
    expect(requests).toHaveLength(0);
  });

  it("does not start another pagination request after cancellation", async () => {
    const controller = new AbortController();
    const requests: RecordedRequest[] = [];
    const fetchFn: FetchFunction = async (input, init) => {
      requests.push({ url: String(input), init });
      controller.abort(new DOMException("cancelled", "AbortError"));
      return successEnvelope([{ id: "kv-unrelated", title: "unrelated" }], {
        page: 1,
        per_page: 1,
        total_pages: 2,
        total_count: 2,
        count: 1,
      });
    };

    await expect(
      createClient(fetchFn).ensureKvNamespace(
        "northland-funnel-sessions",
        controller.signal
      )
    ).rejects.toMatchObject({ name: "AbortError" });
    expect(requests).toHaveLength(1);
  });

  it("does not start the workers.dev subdomain lookup after cancellation", async () => {
    const controller = new AbortController();
    const requests: RecordedRequest[] = [];
    const fetchFn: FetchFunction = async (input, init) => {
      requests.push({ url: String(input), init });
      controller.abort(new DOMException("cancelled", "AbortError"));
      return successEnvelope({ enabled: true, previews_enabled: false });
    };

    await expect(
      createClient(fetchFn).getWorkersDevStatus({
        scriptName: "northland-simple-form",
        signal: controller.signal,
      })
    ).rejects.toMatchObject({ name: "AbortError" });
    expect(requests).toHaveLength(1);
  });
});
