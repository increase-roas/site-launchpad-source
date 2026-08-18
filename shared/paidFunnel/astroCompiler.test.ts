import { describe, expect, it } from "vitest";
import { createGenericPaidFunnelFixture } from "./fixture";
import { createIdFactory, emptySpacing } from "./graph";
import { compilePaidFunnelToAstro } from "./astroCompiler";

describe("paid funnel Astro compiler", () => {
  it("creates one real Astro route per survey question", () => {
    const graph = createGenericPaidFunnelFixture(createIdFactory("astro"));
    const button = Object.values(graph.pages)
      .flatMap(page => page.sections)
      .flatMap(section => section.rows)
      .flatMap(row => row.columns)
      .flatMap(column => column.elements)
      .find(element => element.type === "button");
    expect(button).toBeDefined();
    if (button) button.styles.padding = undefined;
    const files = compilePaidFunnelToAstro(graph);
    const paths = files.map(file => file.path);
    expect(paths).toContain("src/pages/index.astro");
    expect(paths).toContain("src/pages/survey/homeowner.astro");
    expect(paths).toContain("src/pages/survey/timeline.astro");
    expect(paths).toContain("src/pages/contact.astro");
    expect(paths).toContain("src/pages/api/funnel-config.ts");
    expect(paths).toContain("src/pages/api/lead-stage.ts");
    expect(paths).toContain("migrations/0001_funnel_events.sql");
    expect(
      files.find(file => file.path === "src/layouts/FunnelLayout.astro")
        ?.contents
    ).toContain('<script is:inline src="/scripts/funnel-runtime.js">');
    const astroConfig =
      files.find(file => file.path === "astro.config.mjs")?.contents ?? "";
    const packageJson = JSON.parse(
      files.find(file => file.path === "package.json")?.contents ?? "{}"
    ) as { devDependencies?: Record<string, string> };
    expect(astroConfig).toContain("session: false");
    expect(astroConfig).toContain('imageService: "compile"');
    expect(packageJson.devDependencies?.wrangler).toBe("4.124.0");
    const css =
      files.find(file => file.path === "src/styles/funnel.css")?.contents ?? "";
    expect(css).toContain("--heading-text:#0f172a");
    expect(css).toContain("h1,h2,h3{color:var(--heading-text)");
    expect(css).toContain("p{color:var(--text)");
    expect(css).toContain("color:var(--muted)");
    expect(css.match(/padding:14px 22px/g)?.length ?? 0).toBeGreaterThan(1);
  });

  it("preserves attribution and reuses one event id for Pixel and CAPI deduplication", () => {
    const graph = createGenericPaidFunnelFixture(createIdFactory("meta"));
    const files = compilePaidFunnelToAstro(graph);
    const runtime =
      files.find(file => file.path === "public/scripts/funnel-runtime.js")
        ?.contents ?? "";
    const endpoint =
      files.find(file => file.path === "src/pages/api/funnel-event.ts")
        ?.contents ?? "";
    const stageEndpoint =
      files.find(file => file.path === "src/pages/api/lead-stage.ts")
        ?.contents ?? "";
    const migration =
      files.find(file => file.path === "migrations/0001_funnel_events.sql")
        ?.contents ?? "";
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
    expect(runtime).toContain(
      'kind === "answer" ? (tracking.serverEvent || "LeadSurveyAnswer") : (tracking.browserEvent || "ViewContent")'
    );
    expect(endpoint).toContain("event_id: text(payload.event_id)");
    expect(endpoint).toContain("custom_data");
    expect(endpoint).toContain("META_CAPI_ACCESS_TOKEN");
    expect(endpoint).toContain(
      'text(env.META_GRAPH_API_VERSION)) ? text(env.META_GRAPH_API_VERSION) : "v26.0"'
    );
    expect(endpoint).toContain(
      "https://services.leadconnectorhq.com/contacts/upsert"
    );
    expect(endpoint).toContain('version: "2021-04-15"');
    expect(endpoint).toContain("createNewIfDuplicateAllowed: false");
    expect(endpoint).toContain("https://oauth2.googleapis.com/token");
    expect(endpoint).toContain("sheets.googleapis.com/v4/spreadsheets");
    expect(endpoint).toContain(
      'const deliveryKey = "google-sheets:" + text(payload.event_id)'
    );
    expect(endpoint).toContain("INSERT OR IGNORE INTO delivery_claims");
    expect(endpoint).toContain(
      "DELETE FROM delivery_claims WHERE delivery_key = ? AND status = 'pending'"
    );
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS delivery_claims");
    expect(migration).toContain("delivery_key TEXT PRIMARY KEY");
    expect(endpoint).toContain("INSERT OR IGNORE INTO funnel_leads");
    expect(endpoint).toContain(
      'customFields: [{ key: "lead_uuid", fieldValue: text(payload.lead_uuid) }]'
    );
    expect(
      endpoint.indexOf("await storeOriginalLead(payload, fields, request, env)")
    ).toBeLessThan(endpoint.indexOf("Promise.allSettled(deliveries)"));
    expect(endpoint).toContain(
      "authorization: `Bearer ${env.META_CAPI_ACCESS_TOKEN}`"
    );
    expect(endpoint).not.toContain("?access_token=");
    expect(endpoint).toContain("const sameOrigin");
    expect(endpoint).toContain("if (!sameOrigin(origin, request.url))");
    expect(endpoint).toContain("client_ip_address");
    expect(endpoint).toContain("client_user_agent");
    expect(endpoint).toContain("user_data.em");
    expect(endpoint).toContain("user_data.ph");
    expect(endpoint).toContain("const { fields: _privateFields, ...safeData }");
    expect(endpoint).not.toContain("custom_data: { ...payload.data");
    expect(endpoint).not.toMatch(
      /EAAB|META_CAPI_ACCESS_TOKEN\s*[:=]\s*["'][^"']+/
    );
    expect(stageEndpoint).toContain("Bearer");
    expect(stageEndpoint).toContain("STAGE_WEBHOOK_SECRET");
    expect(stageEndpoint).toContain('qualified: "QualifiedLead"');
    expect(stageEndpoint).toContain('appointment: "Schedule"');
    expect(stageEndpoint).toContain('show: "Showed"');
    expect(stageEndpoint).toContain('sale: "Purchase"');
    expect(stageEndpoint).toContain('stage === "sale"');
    expect(stageEndpoint).toContain("META_VALUE_QUALIFIED");
    expect(stageEndpoint).toContain("META_VALUE_SCHEDULE");
    expect(stageEndpoint).toContain("META_VALUE_SHOWED");
    expect(stageEndpoint).toContain("Number.isFinite(configuredValue)");
    expect(stageEndpoint).toContain('conversion?.status === "sent"');
    expect(stageEndpoint).toContain("lead.fbc");
    expect(stageEndpoint).toContain("lead.fbp");
  });

  it("compiles editor styling and responsive visibility into the published Astro source", () => {
    const graph = createGenericPaidFunnelFixture(createIdFactory("styled"));
    const page = graph.pages[graph.steps[0]!.key]!;
    const section = page.sections[0]!;
    const row = section.rows[0]!;
    const column = row.columns[0]!;
    const element = column.elements[0]!;

    graph.globalStyles.colors.background = "#ffffff";
    graph.globalStyles.colors.surface = "#f8fafc";
    section.layout = "boxed";
    section.maxWidth = 986;
    section.minHeight = 321;
    section.alignment = "right";
    section.padding = {
      desktop: { top: 41, right: 42, bottom: 43, left: 44 },
      tablet: { top: 31, right: 32, bottom: 33, left: 34 },
      mobile: { top: 21, right: 22, bottom: 23, left: 24 },
    };
    section.margin = {
      desktop: emptySpacing(9),
      tablet: emptySpacing(7),
      mobile: emptySpacing(5),
    };
    section.background = {
      kind: "gradient",
      from: "#ffffff",
      to: "#dbeafe",
      angle: 135,
    };
    section.overlay = { color: "#0f172a", opacity: 0.2 };
    section.borderColor = "#2563eb";
    section.borderWidth = 3;
    section.borderRadius = 17;
    section.shadow = "0 12px 30px rgba(15, 23, 42, .16)";
    section.sticky = true;
    section.anchor = "styled-section";
    section.className = "campaign-highlight";
    section.visibility = { desktop: true, tablet: false, mobile: true };

    row.gap = 27;
    row.valign = "bottom";
    row.wrap = false;
    row.padding = {
      desktop: emptySpacing(8),
      tablet: emptySpacing(6),
      mobile: emptySpacing(4),
    };
    row.background = { kind: "color", color: "#eff6ff" };

    column.widths = { desktop: 61, tablet: 72, mobile: 100 };
    column.alignment = "center";
    column.padding = {
      desktop: emptySpacing(12),
      tablet: emptySpacing(10),
      mobile: emptySpacing(6),
    };
    column.background = { kind: "color", color: "#ffffff" };
    column.borderColor = "#93c5fd";
    column.borderWidth = 2;
    column.borderRadius = 11;
    column.visibility = { desktop: true, tablet: true, mobile: false };

    element.styles = {
      fontFamily: "Georgia",
      fontSize: { desktop: 44, tablet: 36, mobile: 28 },
      fontWeight: 700,
      lineHeight: 1.2,
      letterSpacing: 0.4,
      color: "#172554",
      textAlign: { desktop: "right", tablet: "center", mobile: "left" },
      padding: {
        desktop: emptySpacing(13),
        tablet: emptySpacing(11),
        mobile: emptySpacing(7),
      },
      margin: {
        desktop: emptySpacing(15),
        tablet: emptySpacing(9),
        mobile: emptySpacing(3),
      },
      background: { kind: "color", color: "#ffffff" },
      borderColor: "#60a5fa",
      borderWidth: 1,
      borderRadius: 14,
      shadow: "0 8px 20px rgba(37, 99, 235, .12)",
    };
    element.visibility = { desktop: true, tablet: false, mobile: true };

    const files = compilePaidFunnelToAstro(graph);
    const pageSource =
      files.find(file => file.path === "src/pages/index.astro")?.contents ?? "";
    const css =
      files.find(file => file.path === "src/styles/funnel.css")?.contents ?? "";

    expect(pageSource).toContain('id="styled-section"');
    expect(pageSource).toContain("campaign-highlight");
    expect(pageSource).toMatch(/class="section section-[^"]+ pf-section-/);
    expect(pageSource).toMatch(/class="row pf-row-/);
    expect(pageSource).toMatch(/class="column pf-column-/);
    expect(pageSource).toMatch(/class="funnel-element pf-element-/);
    expect(css).toContain("--background:#ffffff");
    expect(css).toContain("max-width:986px");
    expect(css).toContain("min-height:321px");
    expect(css).toContain("padding:41px 42px 43px 44px");
    expect(css).toContain("linear-gradient(135deg, #ffffff, #dbeafe)");
    expect(css).toContain("border:3px solid #2563eb");
    expect(css).toContain("position:sticky");
    expect(css).toContain("align-items:flex-end");
    expect(css).toContain("flex-wrap:nowrap");
    expect(css).toContain("width:61%");
    expect(css).toContain("font-size:44px");
    expect(css).toContain("line-height:1.2");
    expect(css).toContain("letter-spacing:0.4px");
    expect(css).toContain("@media(max-width:1024px)");
    expect(css).toContain("padding:31px 32px 33px 34px");
    expect(css).toContain("width:72%");
    expect(css).toContain("@media(max-width:720px)");
    expect(css).toContain("padding:21px 22px 23px 24px");
    expect(css).toContain("width:100%");
    expect(css).toMatch(/@media\(max-width:1024px\)[\s\S]*display:none/);
  });

  it("tracks question views separately from answers and avoids a second lead on thank-you", () => {
    const graph = createGenericPaidFunnelFixture(createIdFactory("events"));
    const survey = graph.steps.find(step => step.type === "survey");
    const form = graph.steps.find(step => step.type === "form");
    const thankYou = graph.steps.find(step => step.type === "thankYou");

    expect(survey?.tracking).toEqual(
      expect.objectContaining({
        browserEvent: "ViewContent",
        serverEvent: "LeadSurveyAnswer",
      })
    );
    expect(form?.tracking).toEqual({
      browserEvent: "ViewContent",
      serverEvent: "Lead",
    });
    expect(thankYou?.tracking).toEqual({
      browserEvent: "PageView",
      serverEvent: "PageView",
    });
  });

  it("is deterministic and rejects duplicate routes", () => {
    const graph = createGenericPaidFunnelFixture(createIdFactory("stable"));
    expect(compilePaidFunnelToAstro(graph)).toEqual(
      compilePaidFunnelToAstro(graph)
    );
    graph.steps[1] = { ...graph.steps[1]!, slug: graph.steps[0]!.slug };
    expect(() => compilePaidFunnelToAstro(graph)).toThrow(
      /Duplicate Astro page URL/
    );
  });
});
