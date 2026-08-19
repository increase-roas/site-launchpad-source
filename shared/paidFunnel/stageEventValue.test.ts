import { readFileSync } from "node:fs";
import { ModuleKind, ScriptTarget, transpileModule } from "typescript";
import { afterEach, describe, expect, it, vi } from "vitest";
import { compilePaidFunnelToAstro } from "./astroCompiler";
import { createGenericPaidFunnelFixture } from "./fixture";
import { createIdFactory } from "./graph";

afterEach(() => vi.unstubAllGlobals());

const LEAD_UUID = "22222222-2222-4222-8222-222222222222";
const STAGE_SECRET = "stage-webhook-secret-CCC";
const REMOVED_META_VALUE_KEYS = [
  "META_VALUE_QUALIFIED",
  "META_VALUE_SCHEDULE",
  "META_VALUE_SHOWED",
] as const;

function leadStageSource(): string {
  return (
    compilePaidFunnelToAstro(
      createGenericPaidFunnelFixture(createIdFactory("stage-value")),
    ).find(file => file.path === "src/pages/api/lead-stage.ts")?.contents ?? ""
  );
}

async function loadLeadStageModule() {
  const javascript = transpileModule(leadStageSource(), {
    compilerOptions: {
      module: ModuleKind.ESNext,
      target: ScriptTarget.ES2022,
    },
  }).outputText;
  return (await import(
    `data:text/javascript;base64,${Buffer.from(javascript).toString("base64")}#${crypto.randomUUID()}`
  )) as {
    POST(input: { request: Request; locals: unknown }): Promise<Response>;
  };
}

function funnelDb() {
  return {
    prepare(sql: string) {
      const statement = {
        bind() {
          return statement;
        },
        async first() {
          if (sql.includes("FROM funnel_leads")) {
            return {
              first_url: "https://funnel.example/contact",
              original_query_string: "utm_source=meta",
              fbc: "fb.1.fbc",
              fbp: "fb.1.fbp",
              ip_address: "203.0.113.10",
              user_agent: "test-agent",
              email_hash: "e".repeat(64),
              phone_hash: "p".repeat(64),
              first_name_hash: "f".repeat(64),
              last_name_hash: "l".repeat(64),
            };
          }
          if (sql.includes("FROM downstream_conversions")) {
            return { status: "pending", event_id: "event-from-db" };
          }
          return null;
        },
        async run() {
          return { meta: { changes: 1 } };
        },
      };
      return statement;
    },
  };
}

function locals() {
  return {
    runtime: {
      env: {
        FUNNEL_DB: funnelDb(),
        STAGE_WEBHOOK_SECRET: STAGE_SECRET,
        META_PIXEL_ID: "123456789012345",
        META_CAPI_ACCESS_TOKEN: "test-meta-token",
        META_VALUE_QUALIFIED: "50",
        META_VALUE_SCHEDULE: "75",
        META_VALUE_SHOWED: "100",
      },
    },
  };
}

function stageRequest(body: Record<string, unknown>) {
  const payload = JSON.stringify(body);
  return new Request("https://funnel.example/api/lead-stage", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "content-length": String(Buffer.byteLength(payload)),
      authorization: `Bearer ${STAGE_SECRET}`,
    },
    body: payload,
  });
}

describe("generated stage events omit META_VALUE_* and GHL owns Purchase value", () => {
  it("keeps leftover wrangler META_VALUE columns in schema without using them", () => {
    const schema = readFileSync("drizzle/schema.ts", "utf8");
    expect(schema).toContain('metaValueQualifiedEncrypted: text("metaValueQualifiedEncrypted")');
    expect(schema).toContain('metaValueScheduleEncrypted: text("metaValueScheduleEncrypted")');
    expect(schema).toContain('metaValueShowedEncrypted: text("metaValueShowedEncrypted")');
    const source = leadStageSource();
    for (const key of REMOVED_META_VALUE_KEYS) {
      expect(source).not.toContain(key);
    }
    expect(source).not.toContain("configuredValues");
    expect(source).toContain('qualified: "QualifiedLead"');
    expect(source).toContain('appointment: "Schedule"');
    expect(source).toContain('show: "Showed"');
    expect(source).toContain('sale: "Purchase"');
  });

  it("sends QualifiedLead, Schedule, and Showed with no value or currency", async () => {
    const module = await loadLeadStageModule();
    const captured: Array<Record<string, unknown>> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
        captured.push(JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>);
        return new Response(null, { status: 200 });
      }),
    );

    const stages = [
      { stage: "qualified", eventName: "QualifiedLead" },
      { stage: "appointment", eventName: "Schedule" },
      { stage: "show", eventName: "Showed" },
    ] as const;
    for (const { stage, eventName } of stages) {
      captured.length = 0;
      const response = await module.POST({
        request: stageRequest({
          leadUuid: LEAD_UUID,
          stage,
          value: 50,
          currency: "USD",
        }),
        locals: locals(),
      });
      expect(response.status).toBe(202);
      expect(captured).toHaveLength(1);
      const event = (captured[0]?.data as Array<{ event_name: string; custom_data: Record<string, unknown> }>)[0];
      expect(event.event_name).toBe(eventName);
      expect(event.custom_data).not.toHaveProperty("value");
      expect(event.custom_data).not.toHaveProperty("currency");
      expect(event.custom_data.stage).toBe(stage);
      expect(event.custom_data.first_url).toBe("https://funnel.example/contact");
    }
  });

  it("rejects Purchase when GHL value is missing, zero, or negative", async () => {
    const module = await loadLeadStageModule();
    const fetchMock = vi.fn(async () => new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    for (const value of [undefined, 0, -25]) {
      const body: Record<string, unknown> = { leadUuid: LEAD_UUID, stage: "sale" };
      if (value !== undefined) body.value = value;
      const response = await module.POST({
        request: stageRequest(body),
        locals: locals(),
      });
      expect(response.status).toBe(422);
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends Purchase with the explicit positive GHL value and currency", async () => {
    const module = await loadLeadStageModule();
    let captured: Record<string, unknown> | null = null;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
        captured = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;
        return new Response(null, { status: 200 });
      }),
    );
    const response = await module.POST({
      request: stageRequest({
        leadUuid: LEAD_UUID,
        stage: "sale",
        value: 1999.5,
        currency: "USD",
      }),
      locals: locals(),
    });
    expect(response.status).toBe(202);
    const event = (captured?.data as Array<{ event_name: string; custom_data: Record<string, unknown> }>)[0];
    expect(event.event_name).toBe("Purchase");
    expect(event.custom_data.value).toBe(1999.5);
    expect(event.custom_data.currency).toBe("USD");
  });
});
