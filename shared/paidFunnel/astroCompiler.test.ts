import { describe, expect, it } from "vitest";
import { createGenericPaidFunnelFixture } from "./fixture";
import { createIdFactory } from "./graph";
import { compilePaidFunnelToAstro } from "./astroCompiler";

describe("paid funnel Astro compiler", () => {
  it("creates one real Astro route per survey question", () => {
    const graph = createGenericPaidFunnelFixture(createIdFactory("astro"));
    const files = compilePaidFunnelToAstro(graph);
    const paths = files.map(file => file.path);
    expect(paths).toContain("src/pages/index.astro");
    expect(paths).toContain("src/pages/survey/homeowner.astro");
    expect(paths).toContain("src/pages/survey/timeline.astro");
    expect(paths).toContain("src/pages/contact.astro");
    expect(paths).toContain("src/pages/api/funnel-config.ts");
    expect(paths).toContain("src/pages/api/lead-stage.ts");
    expect(paths).toContain("migrations/0001_funnel_events.sql");
    expect(files.find(file => file.path === "src/layouts/FunnelLayout.astro")?.contents).toContain('<script is:inline src="/scripts/funnel-runtime.js">');
    const astroConfig = files.find(file => file.path === "astro.config.mjs")?.contents ?? "";
    expect(astroConfig).toContain("session: false");
    expect(astroConfig).toContain('imageService: "compile"');
  });

  it("preserves attribution and reuses one event id for Pixel and CAPI deduplication", () => {
    const graph = createGenericPaidFunnelFixture(createIdFactory("meta"));
    const files = compilePaidFunnelToAstro(graph);
    const runtime = files.find(file => file.path === "public/scripts/funnel-runtime.js")?.contents ?? "";
    const endpoint = files.find(file => file.path === "src/pages/api/funnel-event.ts")?.contents ?? "";
    const stageEndpoint = files.find(file => file.path === "src/pages/api/lead-stage.ts")?.contents ?? "";
    expect(runtime).toContain("lead_uuid");
    expect(runtime).toContain("fbclid");
    expect(runtime).toContain('cookie("_fbp")');
    expect(runtime).toContain("form_complete: true");
    expect(runtime).toContain("eventID: event_id");
    expect(runtime).toContain("/api/funnel-config");
    expect(runtime).toContain('window.fbq("init"');
    expect(runtime).toContain("answers: context.answers");
    expect(runtime).toContain("original_query_string");
    expect(runtime).toContain("for (let attempt = 0; attempt < 3");
    expect(runtime).toContain("event_id, event_name");
    expect(runtime).toContain('kind === "answer" ? (tracking.serverEvent || "LeadSurveyAnswer") : (tracking.browserEvent || "ViewContent")');
    expect(endpoint).toContain("event_id: text(payload.event_id)");
    expect(endpoint).toContain("custom_data");
    expect(endpoint).toContain("META_CAPI_ACCESS_TOKEN");
    expect(endpoint).toContain('text(env.META_GRAPH_API_VERSION)) ? text(env.META_GRAPH_API_VERSION) : "v26.0"');
    expect(endpoint).toContain("https://services.leadconnectorhq.com/contacts/upsert");
    expect(endpoint).toContain('version: "2021-04-15"');
    expect(endpoint).toContain("createNewIfDuplicateAllowed: false");
    expect(endpoint).toContain("https://oauth2.googleapis.com/token");
    expect(endpoint).toContain("sheets.googleapis.com/v4/spreadsheets");
    expect(endpoint).toContain("rows.some(row => text(row[1]) === text(payload.event_id))");
    expect(endpoint).toContain("INSERT OR IGNORE INTO funnel_leads");
    expect(endpoint).toContain("const sameOrigin");
    expect(endpoint).toContain("if (!sameOrigin(origin, request.url))");
    expect(endpoint).toContain("client_ip_address");
    expect(endpoint).toContain("client_user_agent");
    expect(endpoint).toContain("user_data.em");
    expect(endpoint).toContain("user_data.ph");
    expect(endpoint).toContain("const { fields: _privateFields, ...safeData }");
    expect(endpoint).not.toContain("custom_data: { ...payload.data");
    expect(endpoint).not.toMatch(/EAAB|META_CAPI_ACCESS_TOKEN\s*[:=]\s*["'][^"']+/);
    expect(stageEndpoint).toContain("Bearer");
    expect(stageEndpoint).toContain("STAGE_WEBHOOK_SECRET");
    expect(stageEndpoint).toContain('qualified: "QualifiedLead"');
    expect(stageEndpoint).toContain('appointment: "Schedule"');
    expect(stageEndpoint).toContain('show: "Showed"');
    expect(stageEndpoint).toContain('sale: "Purchase"');
    expect(stageEndpoint).toContain("stage === \"sale\"");
    expect(stageEndpoint).toContain("META_VALUE_QUALIFIED");
    expect(stageEndpoint).toContain("META_VALUE_SCHEDULE");
    expect(stageEndpoint).toContain("META_VALUE_SHOWED");
    expect(stageEndpoint).toContain("Number.isFinite(configuredValue)");
    expect(stageEndpoint).toContain("conversion?.status === \"sent\"");
    expect(stageEndpoint).toContain("lead.fbc");
    expect(stageEndpoint).toContain("lead.fbp");
  });

  it("tracks question views separately from answers and avoids a second lead on thank-you", () => {
    const graph = createGenericPaidFunnelFixture(createIdFactory("events"));
    const survey = graph.steps.find(step => step.type === "survey");
    const form = graph.steps.find(step => step.type === "form");
    const thankYou = graph.steps.find(step => step.type === "thankYou");

    expect(survey?.tracking).toEqual(expect.objectContaining({ browserEvent: "ViewContent", serverEvent: "LeadSurveyAnswer" }));
    expect(form?.tracking).toEqual({ browserEvent: "ViewContent", serverEvent: "Lead" });
    expect(thankYou?.tracking).toEqual({ browserEvent: "PageView", serverEvent: "PageView" });
  });

  it("is deterministic and rejects duplicate routes", () => {
    const graph = createGenericPaidFunnelFixture(createIdFactory("stable"));
    expect(compilePaidFunnelToAstro(graph)).toEqual(compilePaidFunnelToAstro(graph));
    graph.steps[1] = { ...graph.steps[1]!, slug: graph.steps[0]!.slug };
    expect(() => compilePaidFunnelToAstro(graph)).toThrow(/Duplicate Astro page URL/);
  });
});
