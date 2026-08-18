import type {
  Background,
  BoxSpacing,
  ButtonAction,
  DeviceVisibility,
  FunnelElement,
  FunnelPage,
  PaidFunnelBreakpoint,
  ResponsiveValue,
  FunnelStepNext,
  PaidFunnelGraph,
  PaidFunnelStep,
} from "./graph";

export type AstroOutputFile = { path: string; contents: string };

function html(value: unknown): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function styleClass(
  kind: "section" | "row" | "column" | "element",
  id: string
): string {
  const encoded = Array.from(id)
    .map(character => character.codePointAt(0)?.toString(16) ?? "0")
    .join("-");
  return `pf-${kind}-${encoded || "node"}`;
}

function classes(...values: Array<string | undefined>): string {
  return values
    .flatMap(value => String(value ?? "").split(/\s+/))
    .map(value => value.trim())
    .filter(Boolean)
    .join(" ");
}

function routePath(slug: string): string {
  const normalized = `/${slug.replace(/^\/+|\/+$/g, "")}`;
  if (normalized === "/") return "src/pages/index.astro";
  const segments = normalized.slice(1).split("/");
  if (segments.some(segment => !/^[a-z0-9][a-z0-9-]*$/i.test(segment))) {
    throw new Error(`Invalid Astro page URL: ${slug}`);
  }
  return `src/pages/${segments.join("/")}.astro`;
}

function destination(next: FunnelStepNext, graph: PaidFunnelGraph): string {
  if (next.type === "redirect") return next.url;
  if (next.type === "none") return "";
  return graph.steps.find(step => step.key === next.stepKey)?.slug ?? "";
}

function actionDestination(
  action: ButtonAction | undefined,
  step: PaidFunnelStep,
  graph: PaidFunnelGraph
): string {
  if (!action || action.type === "nextStep" || action.type === "formSubmit")
    return destination(step.nextStep, graph);
  if (action.type === "step" || action.type === "booking") {
    return (
      graph.steps.find(candidate => candidate.key === action.stepKey)?.slug ??
      destination(step.nextStep, graph)
    );
  }
  if (action.type === "url") return action.href;
  if (action.type === "phone") return `tel:${action.tel}`;
  return destination(step.nextStep, graph);
}

function renderElement(
  element: FunnelElement,
  step: PaidFunnelStep,
  graph: PaidFunnelGraph
): string {
  const props = element.props;
  const elementClass = styleClass("element", element.id);
  const blockAttributes = `class="${classes("funnel-element", elementClass)}" data-block-id="${html(element.id)}"`;
  if (element.type === "heading") {
    const tag = props.tag === "h2" || props.tag === "h3" ? props.tag : "h1";
    return `<${tag} ${blockAttributes}>${html(props.text)}</${tag}>`;
  }
  if (element.type === "text")
    return `<p ${blockAttributes}>${html(props.text)}</p>`;
  if (element.type === "image") {
    return `<img ${blockAttributes} src="${html(props.src)}" alt="${html(props.alt)}" loading="lazy" decoding="async" />`;
  }
  if (element.type === "button" || element.type === "phoneCta") {
    const action = props.action as ButtonAction | undefined;
    const href = actionDestination(action, step, graph);
    return `<a class="${classes("funnel-element", elementClass, "funnel-button")}" data-block-id="${html(element.id)}" data-funnel-link data-destination="${html(href)}" href="${html(href || "#")}">${html(props.label ?? "Continue")}</a>`;
  }
  if (element.type === "form") {
    const fields = Array.isArray(props.fields)
      ? props.fields.map(String)
      : ["firstName", "email", "phone"];
    return `<form class="${classes("funnel-element", elementClass, "funnel-form")}" data-block-id="${html(element.id)}" data-funnel-form data-destination="${html(destination(step.nextStep, graph))}">
${fields.map(field => (field === "consent" ? '<label class="consent"><input name="consent" type="checkbox" value="yes" required /><span>I agree to be contacted about this request. Consent is not a condition of purchase.</span></label>' : `<label><span>${html(field.replace(/([A-Z])/g, " $1"))}</span><input name="${html(field)}" ${field === "email" ? 'type="email"' : field === "phone" ? 'type="tel"' : 'type="text"'} required /></label>`)).join("\n")}
<button class="funnel-button" type="submit">${html(props.submitLabel ?? "Continue")}</button>
</form>`;
  }
  if (element.type === "multipleChoice") {
    const field = String(props.field ?? step.tracking?.answerField ?? "answer");
    const options = Array.isArray(props.options)
      ? props.options.map(String)
      : [];
    return `<div class="${classes("funnel-element", elementClass, "survey-question")}" data-block-id="${html(element.id)}" data-survey-question data-field="${html(field)}" data-destination="${html(destination(step.nextStep, graph))}" data-auto-advance="${props.autoAdvance === false ? "false" : "true"}">
${options.map(option => `<button type="button" class="choice" data-answer="${html(option)}">${html(option)}</button>`).join("\n")}
</div>`;
  }
  if (element.type === "shortAnswer") {
    const field = String(props.field ?? step.tracking?.answerField ?? "answer");
    return `<form class="${classes("funnel-element", elementClass, "funnel-form")}" data-block-id="${html(element.id)}" data-funnel-form data-answer-field="${html(field)}" data-destination="${html(destination(step.nextStep, graph))}"><label><span>${html(props.question ?? "Your answer")}</span><input name="${html(field)}" required /></label><button class="funnel-button" type="submit">Continue</button></form>`;
  }
  if (element.type === "testimonial")
    return `<blockquote ${blockAttributes}>${html(props.quote)}<footer>${html(props.author)}</footer></blockquote>`;
  if (element.type === "divider") return `<hr ${blockAttributes} />`;
  if (element.type === "spacer")
    return `<div class="${classes("funnel-element", elementClass, "spacer")}" data-block-id="${html(element.id)}" aria-hidden="true"></div>`;
  if (element.type === "list") {
    const items = Array.isArray(props.items) ? props.items.map(String) : [];
    return `<ul ${blockAttributes}>${items.map(item => `<li>${html(item)}</li>`).join("")}</ul>`;
  }
  return `<div class="${classes("funnel-element", elementClass, "placeholder")}" data-block-id="${html(element.id)}" data-block-type="${html(element.type)}">${html(props.label ?? element.type)}</div>`;
}

function renderPageBody(
  page: FunnelPage,
  step: PaidFunnelStep,
  graph: PaidFunnelGraph
): string {
  return page.sections
    .map(section => {
      const rows = section.rows
        .map(row => {
          const columns = row.columns
            .map(
              column =>
                `<div class="${classes("column", styleClass("column", column.id))}" data-column-id="${html(column.id)}">${column.elements.map(element => renderElement(element, step, graph)).join("\n")}</div>`
            )
            .join("\n");
          return `<div class="${classes("row", styleClass("row", row.id))}" data-row-id="${html(row.id)}">${columns}</div>`;
        })
        .join("\n");
      const anchor = section.anchor.trim()
        ? ` id="${html(section.anchor.trim())}"`
        : "";
      return `<section class="${html(classes("section", `section-${section.preset}`, styleClass("section", section.id), section.className))}" data-section-id="${html(section.id)}"${anchor}>${rows}</section>`;
    })
    .join("\n");
}

function pageSource(
  step: PaidFunnelStep,
  page: FunnelPage,
  graph: PaidFunnelGraph
): string {
  const tracking = step.tracking ?? {
    browserEvent: step.type === "thankYou" ? "PageView" : "ViewContent",
    serverEvent:
      step.type === "survey"
        ? "LeadSurveyAnswer"
        : step.type === "form" || step.type === "landing"
          ? "Lead"
          : "PageView",
  };
  return `---
import FunnelLayout from "../${step.slug === "/" ? "" : "../".repeat(step.slug.replace(/^\/+|\/+$/g, "").split("/").length - 1)}layouts/FunnelLayout.astro";
const tracking = ${JSON.stringify({ ...tracking, stepKey: step.key, path: step.slug })};
---
<FunnelLayout title=${JSON.stringify(step.seo.title || step.title)} description=${JSON.stringify(step.seo.description)} tracking={tracking}>
${renderPageBody(page, step, graph)}
</FunnelLayout>
`;
}

const runtimeSource = `const STORAGE_KEY = "launchpad_funnel_context_v1";
const ATTRIBUTION_KEYS = ["utm_source","utm_medium","utm_campaign","utm_content","utm_term","fbclid","gclid"];
function id() { return crypto.randomUUID(); }
function cookie(name) { return document.cookie.split(";").map(value => value.trim()).find(value => value.startsWith(name + "="))?.slice(name.length + 1) || ""; }
function saveContext(context) { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(context)); }
function readContext() {
  let stored = {};
  try { stored = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || "{}"); } catch {}
  const params = new URLSearchParams(location.search);
  const attribution = { ...(stored.attribution || {}) };
  for (const key of ATTRIBUTION_KEYS) if (params.get(key)) attribution[key] = params.get(key);
  const fbp = cookie("_fbp") || stored.fbp || "";
  const fbc = cookie("_fbc") || stored.fbc || (attribution.fbclid ? "fb.1." + Date.now() + "." + attribution.fbclid : "");
  const context = { lead_uuid: stored.lead_uuid || id(), attribution, fbp, fbc, answers: stored.answers || {}, first_url: stored.first_url || location.href, original_query_string: stored.original_query_string ?? location.search };
  saveContext(context);
  return context;
}
const context = readContext();
async function loadPixel() {
  try {
    const response = await fetch("/api/funnel-config", { headers: { accept: "application/json" } });
    const config = response.ok ? await response.json() : {};
    if (!/^\\d{8,20}$/.test(String(config.metaPixelId || ""))) return;
    if (typeof window.fbq !== "function") {
      const fbq = function(){ fbq.callMethod ? fbq.callMethod.apply(fbq, arguments) : fbq.queue.push(arguments); };
      fbq.queue = []; fbq.loaded = true; fbq.version = "2.0"; window.fbq = fbq;
      const script = document.createElement("script"); script.async = true; script.src = "https://connect.facebook.net/en_US/fbevents.js";
      document.head.appendChild(script);
    }
    window.fbq("init", String(config.metaPixelId));
  } catch {}
}
async function postEvent(payload) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetch("/api/funnel-event", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload), keepalive: true });
      if (response.ok) return true;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 250 * (attempt + 1)));
  }
  return false;
}
async function emit(kind, data = {}, destination = "") {
  const event_id = id();
  const tracking = window.__FUNNEL_TRACKING__ || {};
  const eventName = kind === "answer" ? (tracking.serverEvent || "LeadSurveyAnswer") : (tracking.browserEvent || "ViewContent");
  const payload = { event_id, event_name: eventName, browser_event: eventName, lead_uuid: context.lead_uuid, step_key: tracking.stepKey, page_path: location.pathname, page_url: location.href, original: { first_url: context.first_url, original_query_string: context.original_query_string }, attribution: context.attribution, meta: { fbp: context.fbp, fbc: context.fbc }, data };
  if (typeof window.fbq === "function") {
    const standard = ["PageView","ViewContent","Lead","CompleteRegistration","Purchase"].includes(payload.browser_event);
    const browserData = data.fields ? { form_complete: true, field_names: Object.keys(data.fields) } : data;
    window.fbq(standard ? "track" : "trackCustom", payload.browser_event, { ...browserData, step_key: payload.step_key, page_path: payload.page_path }, { eventID: event_id });
  }
  const delivered = await postEvent(payload);
  if (destination && (delivered || !data.fields)) location.assign(destination);
  if (!delivered && data.fields) {
    let error = document.querySelector("[data-funnel-error]");
    if (!error) { error = document.createElement("p"); error.dataset.funnelError = "true"; error.className = "funnel-error"; error.setAttribute("role", "alert"); document.querySelector("[data-funnel-form]")?.appendChild(error); }
    error.textContent = "We could not send your request yet. Please check your connection and try again.";
  }
}
function rememberAnswer(field, value) {
  if (!field) return;
  context.answers[field] = value;
  saveContext(context);
}
async function start() {
  await loadPixel();
  emit("view");
  document.querySelectorAll("[data-survey-question]").forEach(root => root.addEventListener("click", event => {
    const button = event.target.closest("[data-answer]");
    if (!button) return;
    root.querySelectorAll("[data-answer]").forEach(node => node.dataset.selected = String(node === button));
    rememberAnswer(root.dataset.field, button.dataset.answer);
    if (root.dataset.autoAdvance !== "false") emit("answer", { field: root.dataset.field, value: button.dataset.answer, answers: context.answers }, root.dataset.destination || "");
  }));
  document.querySelectorAll("[data-funnel-form]").forEach(form => form.addEventListener("submit", event => {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(form).entries());
    const answerField = form.dataset.answerField;
    if (answerField) {
      rememberAnswer(answerField, values[answerField]);
      emit("answer", { field: answerField, value: values[answerField], answers: context.answers }, form.dataset.destination || "");
      return;
    }
    emit("answer", { fields: values, answers: context.answers }, form.dataset.destination || "");
  }));
}
start();
`;

const endpointSource = `import type { APIRoute } from "astro";
type RuntimeEnv = Record<string, any>;
const sha256 = async (value: string) => Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value.trim().toLowerCase())))).map(byte => byte.toString(16).padStart(2, "0")).join("");
const text = (value: unknown) => typeof value === "string" ? value.trim().slice(0, 2_000) : "";
const ok = async (response: Promise<Response>) => { const result = await response; if (!result.ok) throw new Error("Integration delivery failed."); return result; };
const sameOrigin = (origin: string | null, requestUrl: string) => {
  if (!origin) return true;
  try { return new URL(origin).origin === new URL(requestUrl).origin; } catch { return false; }
};
const base64Url = (value: Uint8Array | string) => {
  const bytes = typeof value === "string" ? new TextEncoder().encode(value) : value;
  let binary = ""; for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/=/g, "").replace(/\\+/g, "-").replace(/\\//g, "_");
};
async function googleAccessToken(env: RuntimeEnv): Promise<string> {
  const email = text(env.GOOGLE_SERVICE_ACCOUNT_EMAIL);
  const pem = String(env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY ?? "").trim().replace(/\\\\n/g, "\\n");
  if (!email || !pem) throw new Error("Google service account is not configured.");
  const body = pem.replace(/-----BEGIN (?:RSA )?PRIVATE KEY-----|-----END (?:RSA )?PRIVATE KEY-----|\\s/g, "");
  const keyBytes = Uint8Array.from(atob(body), character => character.charCodeAt(0));
  const key = await crypto.subtle.importKey("pkcs8", keyBytes, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const now = Math.floor(Date.now() / 1000);
  const unsigned = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" })) + "." + base64Url(JSON.stringify({ iss: email, scope: "https://www.googleapis.com/auth/spreadsheets", aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600 }));
  const signature = new Uint8Array(await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(unsigned)));
  const tokenResponse = await ok(fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: unsigned + "." + base64Url(signature) }) }));
  const token = await tokenResponse.json() as { access_token?: string };
  if (!token.access_token) throw new Error("Google access token was not returned.");
  return token.access_token;
}
async function deliverMeta(payload: any, fields: Record<string, unknown>, request: Request, env: RuntimeEnv) {
  if (!env.META_PIXEL_ID || !env.META_CAPI_ACCESS_TOKEN) throw new Error("Meta is not configured.");
  const user_data: Record<string, unknown> = { external_id: [await sha256(text(payload.lead_uuid))] };
  if (payload.meta?.fbp) user_data.fbp = text(payload.meta.fbp);
  if (payload.meta?.fbc) user_data.fbc = text(payload.meta.fbc);
  const clientIp = request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const userAgent = request.headers.get("user-agent");
  if (clientIp) user_data.client_ip_address = clientIp;
  if (userAgent) user_data.client_user_agent = userAgent;
  if (fields.email) user_data.em = [await sha256(text(fields.email))];
  if (fields.phone) user_data.ph = [await sha256(text(fields.phone).replace(/\\D/g, ""))];
  if (fields.firstName) user_data.fn = [await sha256(text(fields.firstName))];
  if (fields.lastName) user_data.ln = [await sha256(text(fields.lastName))];
  const { fields: _privateFields, ...safeData } = payload.data ?? {};
  const event = { event_name: text(payload.event_name), event_time: Math.floor(Date.now() / 1000), event_id: text(payload.event_id), action_source: "website", event_source_url: text(payload.page_url), user_data, custom_data: { ...safeData, form_field_names: Object.keys(fields), step_key: text(payload.step_key), page_path: text(payload.page_path), ...(payload.attribution ?? {}) } };
  const version = /^v\\d+\\.\\d+$/.test(text(env.META_GRAPH_API_VERSION)) ? text(env.META_GRAPH_API_VERSION) : "v26.0";
  await ok(fetch(\`https://graph.facebook.com/\${version}/\${env.META_PIXEL_ID}/events\`, { method: "POST", headers: { authorization: \`Bearer \${env.META_CAPI_ACCESS_TOKEN}\`, "content-type": "application/json" }, body: JSON.stringify({ data: [event] }) }));
}
async function deliverGhl(payload: any, fields: Record<string, unknown>, env: RuntimeEnv) {
  if (!env.GHL_API_KEY || !env.GHL_LOCATION_ID) throw new Error("GHL is not configured.");
  await ok(fetch("https://services.leadconnectorhq.com/contacts/upsert", { method: "POST", headers: { authorization: \`Bearer \${env.GHL_API_KEY}\`, version: "2021-04-15", accept: "application/json", "content-type": "application/json" }, body: JSON.stringify({ locationId: env.GHL_LOCATION_ID, firstName: text(fields.firstName), lastName: text(fields.lastName), email: text(fields.email), phone: text(fields.phone), postalCode: text(fields.zip || fields.postalCode), source: "Site Launchpad funnel", tags: ["site-launchpad", "funnel-lead"], customFields: [{ key: "lead_uuid", fieldValue: text(payload.lead_uuid) }], createNewIfDuplicateAllowed: false }) }));
}
async function deliverSheet(payload: any, fields: Record<string, unknown>, env: RuntimeEnv) {
  if (!env.GOOGLE_SHEETS_ID || !env.FUNNEL_DB) throw new Error("Google Sheet is not configured.");
  const deliveryKey = "google-sheets:" + text(payload.event_id);
  const claimedAt = new Date().toISOString();
  const claim = await env.FUNNEL_DB.prepare("INSERT OR IGNORE INTO delivery_claims (delivery_key, event_id, destination, status, claimed_at) VALUES (?, ?, 'google-sheets', 'pending', ?)").bind(deliveryKey, text(payload.event_id), claimedAt).run();
  if (Number(claim?.meta?.changes ?? 0) !== 1) return;
  try {
    const token = await googleAccessToken(env);
    const range = "A:Z";
    const base = \`https://sheets.googleapis.com/v4/spreadsheets/\${encodeURIComponent(env.GOOGLE_SHEETS_ID)}/values/\${encodeURIComponent(range)}\`;
    const existing = await ok(fetch(base + "?majorDimension=ROWS", { headers: { authorization: \`Bearer \${token}\` } }));
    const rows = (await existing.json() as { values?: unknown[][] }).values ?? [];
    if (!rows.some(row => text(row[1]) === text(payload.event_id))) {
      const values = [[new Date().toISOString(), text(payload.event_id), text(payload.lead_uuid), text(fields.firstName), text(fields.lastName), text(fields.email), text(fields.phone), text(fields.zip || fields.postalCode), text(payload.page_url), JSON.stringify(payload.attribution ?? {}), JSON.stringify(payload.data?.answers ?? {})]];
      await ok(fetch(base + ":append?valueInputOption=RAW&insertDataOption=INSERT_ROWS", { method: "POST", headers: { authorization: \`Bearer \${token}\`, "content-type": "application/json" }, body: JSON.stringify({ majorDimension: "ROWS", values }) }));
    }
    await env.FUNNEL_DB.prepare("UPDATE delivery_claims SET status = 'delivered', delivered_at = ? WHERE delivery_key = ?").bind(new Date().toISOString(), deliveryKey).run();
  } catch (error) {
    await env.FUNNEL_DB.prepare("DELETE FROM delivery_claims WHERE delivery_key = ? AND status = 'pending'").bind(deliveryKey).run();
    throw error;
  }
}
async function deliverAlert(payload: any, fields: Record<string, unknown>, env: RuntimeEnv) {
  if (!env.ALERT_WEBHOOK_URL) return;
  await ok(fetch(env.ALERT_WEBHOOK_URL, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ eventId: text(payload.event_id), leadUuid: text(payload.lead_uuid), pageUrl: text(payload.page_url), fields, answers: payload.data?.answers ?? {}, attribution: payload.attribution ?? {} }) }));
}
async function ensureTables(env: RuntimeEnv) {
  if (!env.FUNNEL_DB) throw new Error("FUNNEL_DB is not configured.");
  await env.FUNNEL_DB.prepare("CREATE TABLE IF NOT EXISTS funnel_leads (lead_uuid TEXT PRIMARY KEY, first_event_id TEXT NOT NULL, first_url TEXT NOT NULL, original_query_string TEXT NOT NULL, fbc TEXT, fbp TEXT, ip_address TEXT, user_agent TEXT, email_hash TEXT, phone_hash TEXT, first_name_hash TEXT, last_name_hash TEXT, created_at TEXT NOT NULL)").run();
  await env.FUNNEL_DB.prepare("CREATE TABLE IF NOT EXISTS downstream_conversions (external_id TEXT PRIMARY KEY, event_id TEXT UNIQUE NOT NULL, lead_uuid TEXT NOT NULL, stage TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending', created_at TEXT NOT NULL, sent_at TEXT)").run();
  await env.FUNNEL_DB.prepare("CREATE TABLE IF NOT EXISTS delivery_claims (delivery_key TEXT PRIMARY KEY, event_id TEXT NOT NULL, destination TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending', claimed_at TEXT NOT NULL, delivered_at TEXT)").run();
}
async function storeOriginalLead(payload: any, fields: Record<string, unknown>, request: Request, env: RuntimeEnv) {
  await ensureTables(env);
  const ip = request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "";
  const userAgent = request.headers.get("user-agent") || "";
  await env.FUNNEL_DB.prepare("INSERT OR IGNORE INTO funnel_leads (lead_uuid, first_event_id, first_url, original_query_string, fbc, fbp, ip_address, user_agent, email_hash, phone_hash, first_name_hash, last_name_hash, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(text(payload.lead_uuid), text(payload.event_id), text(payload.original?.first_url || payload.page_url), text(payload.original?.original_query_string), text(payload.meta?.fbc), text(payload.meta?.fbp), ip, userAgent, fields.email ? await sha256(text(fields.email)) : "", fields.phone ? await sha256(text(fields.phone).replace(/\\D/g, "")) : "", fields.firstName ? await sha256(text(fields.firstName)) : "", fields.lastName ? await sha256(text(fields.lastName)) : "", new Date().toISOString()).run();
}
export const POST: APIRoute = async ({ request, locals }) => {
  if (Number(request.headers.get("content-length") || 0) > 65_536) return new Response(null, { status: 413 });
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) return new Response(null, { status: 415 });
  const origin = request.headers.get("origin");
  if (!sameOrigin(origin, request.url)) return new Response(null, { status: 403 });
  const payload = await request.json().catch(() => null) as any;
  if (!payload || !/^[0-9a-f-]{36}$/i.test(text(payload.event_id)) || !/^[0-9a-f-]{36}$/i.test(text(payload.lead_uuid))) return new Response(null, { status: 400 });
  const env = ((locals as any).runtime?.env ?? {}) as RuntimeEnv;
  const fields = payload.data?.fields && typeof payload.data.fields === "object" ? payload.data.fields as Record<string, unknown> : {};
  if (Object.keys(fields).length > 0) {
    try { await storeOriginalLead(payload, fields, request, env); }
    catch { return new Response(null, { status: 502 }); }
  }
  const deliveries: Promise<unknown>[] = [deliverMeta(payload, fields, request, env)];
  if (Object.keys(fields).length > 0) deliveries.push(deliverGhl(payload, fields, env), deliverSheet(payload, fields, env), deliverAlert(payload, fields, env));
  const results = await Promise.allSettled(deliveries);
  return new Response(null, { status: results.every(result => result.status === "fulfilled") ? 202 : 502 });
};
`;

const leadStageEndpointSource = `import type { APIRoute } from "astro";
type RuntimeEnv = Record<string, any>;
const text = (value: unknown) => typeof value === "string" ? value.trim().slice(0, 2_000) : "";
const sha256 = async (value: string) => Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value.trim().toLowerCase())))).map(byte => byte.toString(16).padStart(2, "0")).join("");
async function authorized(request: Request, expected: string) {
  const actual = request.headers.get("authorization")?.replace(/^Bearer\\s+/i, "") ?? "";
  if (!actual || !expected) return false;
  const [left, right] = await Promise.all([sha256(actual), sha256(expected)]);
  return left === right;
}
export const POST: APIRoute = async ({ request, locals }) => {
  if (Number(request.headers.get("content-length") || 0) > 65_536) return new Response(null, { status: 413 });
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) return new Response(null, { status: 415 });
  const env = ((locals as any).runtime?.env ?? {}) as RuntimeEnv;
  if (!(await authorized(request, text(env.STAGE_WEBHOOK_SECRET)))) return new Response(null, { status: 401 });
  if (!env.FUNNEL_DB || !env.META_PIXEL_ID || !env.META_CAPI_ACCESS_TOKEN) return new Response(null, { status: 503 });
  const payload = await request.json().catch(() => null) as any;
  const leadUuid = text(payload?.leadUuid);
  const stage = text(payload?.stage);
  const mappings: Record<string, string> = { qualified: "QualifiedLead", appointment: "Schedule", show: "Showed", sale: "Purchase" };
  const eventName = mappings[stage];
  if (!/^[0-9a-f-]{36}$/i.test(leadUuid) || !eventName) return new Response(null, { status: 400 });
  const value = Number(payload?.value);
  if (stage === "sale" && (!Number.isFinite(value) || value <= 0)) return new Response(null, { status: 422 });
  await env.FUNNEL_DB.prepare("CREATE TABLE IF NOT EXISTS funnel_leads (lead_uuid TEXT PRIMARY KEY, first_event_id TEXT NOT NULL, first_url TEXT NOT NULL, original_query_string TEXT NOT NULL, fbc TEXT, fbp TEXT, ip_address TEXT, user_agent TEXT, email_hash TEXT, phone_hash TEXT, first_name_hash TEXT, last_name_hash TEXT, created_at TEXT NOT NULL)").run();
  await env.FUNNEL_DB.prepare("CREATE TABLE IF NOT EXISTS downstream_conversions (external_id TEXT PRIMARY KEY, event_id TEXT UNIQUE NOT NULL, lead_uuid TEXT NOT NULL, stage TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending', created_at TEXT NOT NULL, sent_at TEXT)").run();
  const lead = await env.FUNNEL_DB.prepare("SELECT * FROM funnel_leads WHERE lead_uuid = ?").bind(leadUuid).first();
  if (!lead) return new Response(null, { status: 404 });
  const externalId = leadUuid + ":" + stage;
  const eventId = text(payload?.eventId) || await sha256(externalId);
  await env.FUNNEL_DB.prepare("INSERT OR IGNORE INTO downstream_conversions (external_id, event_id, lead_uuid, stage, status, created_at) VALUES (?, ?, ?, ?, 'pending', ?)").bind(externalId, eventId, leadUuid, stage, new Date().toISOString()).run();
  const conversion = await env.FUNNEL_DB.prepare("SELECT status, event_id FROM downstream_conversions WHERE external_id = ?").bind(externalId).first();
  if (conversion?.status === "sent") return new Response(null, { status: 202 });
  const user_data: Record<string, unknown> = { external_id: [await sha256(leadUuid)] };
  if (lead.fbc) user_data.fbc = lead.fbc;
  if (lead.fbp) user_data.fbp = lead.fbp;
  if (lead.ip_address) user_data.client_ip_address = lead.ip_address;
  if (lead.user_agent) user_data.client_user_agent = lead.user_agent;
  if (lead.email_hash) user_data.em = [lead.email_hash];
  if (lead.phone_hash) user_data.ph = [lead.phone_hash];
  if (lead.first_name_hash) user_data.fn = [lead.first_name_hash];
  if (lead.last_name_hash) user_data.ln = [lead.last_name_hash];
  const version = /^v\\d+\\.\\d+$/.test(text(env.META_GRAPH_API_VERSION)) ? text(env.META_GRAPH_API_VERSION) : "v26.0";
  const custom_data: Record<string, unknown> = { stage, first_url: lead.first_url, original_query_string: lead.original_query_string };
  const configuredValues: Record<string, unknown> = { qualified: env.META_VALUE_QUALIFIED, appointment: env.META_VALUE_SCHEDULE, show: env.META_VALUE_SHOWED };
  const configuredValue = Number(configuredValues[stage]);
  if (stage === "sale") custom_data.value = value;
  else if (Number.isFinite(configuredValue) && configuredValue >= 0) custom_data.value = configuredValue;
  if (custom_data.value !== undefined) custom_data.currency = text(payload?.currency) || "USD";
  const response = await fetch(\`https://graph.facebook.com/\${version}/\${env.META_PIXEL_ID}/events\`, { method: "POST", headers: { authorization: \`Bearer \${env.META_CAPI_ACCESS_TOKEN}\`, "content-type": "application/json" }, body: JSON.stringify({ data: [{ event_name: eventName, event_time: Math.floor(Date.now() / 1000), event_id: conversion?.event_id || eventId, action_source: "website", event_source_url: lead.first_url, user_data, custom_data }] }) });
  if (!response.ok) return new Response(null, { status: 502 });
  await env.FUNNEL_DB.prepare("UPDATE downstream_conversions SET status = 'sent', sent_at = ? WHERE external_id = ?").bind(new Date().toISOString(), externalId).run();
  return new Response(null, { status: 202 });
};
`;

const d1MigrationSource = `CREATE TABLE IF NOT EXISTS funnel_leads (
  lead_uuid TEXT PRIMARY KEY,
  first_event_id TEXT NOT NULL,
  first_url TEXT NOT NULL,
  original_query_string TEXT NOT NULL,
  fbc TEXT,
  fbp TEXT,
  ip_address TEXT,
  user_agent TEXT,
  email_hash TEXT,
  phone_hash TEXT,
  first_name_hash TEXT,
  last_name_hash TEXT,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS downstream_conversions (
  external_id TEXT PRIMARY KEY,
  event_id TEXT UNIQUE NOT NULL,
  lead_uuid TEXT NOT NULL,
  stage TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL,
  sent_at TEXT
);
CREATE TABLE IF NOT EXISTS delivery_claims (
  delivery_key TEXT PRIMARY KEY,
  event_id TEXT NOT NULL,
  destination TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  claimed_at TEXT NOT NULL,
  delivered_at TEXT
);
`;

const configEndpointSource = `import type { APIRoute } from "astro";
export const GET: APIRoute = async ({ locals }) => {
  const env = (locals as any).runtime?.env ?? {};
  const metaPixelId = /^\\d{8,20}$/.test(String(env.META_PIXEL_ID ?? "")) ? String(env.META_PIXEL_ID) : null;
  return Response.json({ metaPixelId }, { headers: { "cache-control": "public, max-age=300" } });
};
`;

function layoutSource(): string {
  return `---
import "../styles/funnel.css";
interface Props { title: string; description: string; tracking: Record<string, unknown>; }
const { title, description, tracking } = Astro.props;
---
<!doctype html><html lang="en"><head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width" /><meta name="description" content={description} /><title>{title}</title></head><body><main><slot /></main><script is:inline define:vars={{ tracking }}>window.__FUNNEL_TRACKING__ = tracking;</script><script is:inline src="/scripts/funnel-runtime.js"></script></body></html>`;
}

function responsiveValue<T>(
  value: ResponsiveValue<T> | undefined,
  breakpoint: PaidFunnelBreakpoint
): T | undefined {
  if (!value) return undefined;
  if (breakpoint === "mobile")
    return value.mobile ?? value.tablet ?? value.desktop;
  if (breakpoint === "tablet") return value.tablet ?? value.desktop;
  return value.desktop;
}

function finite(
  value: unknown,
  fallback = 0,
  minimum = 0,
  maximum = 100_000
): number {
  const parsed = Number(value);
  return Number.isFinite(parsed)
    ? Math.min(maximum, Math.max(minimum, parsed))
    : fallback;
}

function cssText(value: unknown, fallback: string): string {
  const sanitized = String(value ?? "")
    .replace(/[{};\r\n]/g, " ")
    .trim();
  return sanitized || fallback;
}

function spacing(spacingValue: BoxSpacing | undefined): string {
  if (!spacingValue) return "0";
  return [
    spacingValue.top,
    spacingValue.right,
    spacingValue.bottom,
    spacingValue.left,
  ]
    .map(value => `${finite(value)}px`)
    .join(" ");
}

function background(
  backgroundValue: Background | undefined,
  fallback: string
): string {
  if (
    !backgroundValue ||
    backgroundValue.kind === "none" ||
    backgroundValue.kind === "video"
  )
    return fallback;
  if (backgroundValue.kind === "color")
    return cssText(backgroundValue.color, fallback);
  if (backgroundValue.kind === "gradient") {
    return `linear-gradient(${finite(backgroundValue.angle, 0, -360, 360)}deg, ${cssText(backgroundValue.from, fallback)}, ${cssText(backgroundValue.to, fallback)})`;
  }
  const position = cssText(backgroundValue.position, "center");
  const url = JSON.stringify(String(backgroundValue.url ?? ""));
  return `${position} / ${backgroundValue.size} url(${url})`;
}

function rule(
  selector: string,
  declarations: Array<[string, string | number]>
): string {
  return `${selector}{${declarations.map(([property, value]) => `${property}:${value}`).join(";")}}`;
}

function visibilityDisplay(
  visibility: DeviceVisibility,
  breakpoint: PaidFunnelBreakpoint,
  visibleDisplay: string
): string {
  return visibility[breakpoint] ? visibleDisplay : "none";
}

function graphRules(
  graph: PaidFunnelGraph,
  breakpoint: PaidFunnelBreakpoint
): string[] {
  const rules: string[] = [];
  for (const page of Object.values(graph.pages)) {
    for (const section of page.sections) {
      const sectionSelector = `.${styleClass("section", section.id)}`;
      const sectionPadding =
        responsiveValue(section.padding, breakpoint) ??
        (breakpoint === "mobile"
          ? graph.globalStyles.mobile.sectionPadding
          : undefined);
      rules.push(
        rule(sectionSelector, [
          [
            "display",
            visibilityDisplay(section.visibility, breakpoint, "block"),
          ],
          ["width", "100%"],
          [
            "max-width",
            `${finite(section.layout === "boxed" ? section.maxWidth : graph.globalStyles.containers.fullMaxWidth)}px`,
          ],
          ["min-height", `${finite(section.minHeight)}px`],
          ["padding", spacing(sectionPadding)],
          ["margin", spacing(responsiveValue(section.margin, breakpoint))],
          ["background", background(section.background, "transparent")],
          ["text-align", section.alignment],
          [
            "border",
            `${finite(section.borderWidth)}px solid ${cssText(section.borderColor, "transparent")}`,
          ],
          ["border-radius", `${finite(section.borderRadius)}px`],
          ["box-shadow", cssText(section.shadow, "none")],
          ["position", section.sticky ? "sticky" : "relative"],
          ["top", section.sticky ? "0" : "auto"],
          ["z-index", section.sticky ? "10" : "auto"],
        ])
      );
      if (section.overlay && finite(section.overlay.opacity, 0, 0, 1) > 0) {
        rules.push(
          rule(`${sectionSelector}::before`, [
            ["content", '""'],
            ["position", "absolute"],
            ["inset", "0"],
            ["border-radius", "inherit"],
            ["background", cssText(section.overlay.color, "transparent")],
            ["opacity", finite(section.overlay.opacity, 0, 0, 1)],
            ["pointer-events", "none"],
            ["z-index", "0"],
          ])
        );
        rules.push(
          rule(`${sectionSelector}>*`, [
            ["position", "relative"],
            ["z-index", "1"],
          ])
        );
      }

      for (const row of section.rows) {
        const rowSelector = `.${styleClass("row", row.id)}`;
        rules.push(
          rule(rowSelector, [
            ["display", "flex"],
            ["flex-wrap", row.wrap ? "wrap" : "nowrap"],
            [
              "align-items",
              row.valign === "center"
                ? "center"
                : row.valign === "bottom"
                  ? "flex-end"
                  : "flex-start",
            ],
            [
              "gap",
              `${finite(breakpoint === "mobile" ? graph.globalStyles.mobile.rowGap : row.gap)}px`,
            ],
            ["padding", spacing(responsiveValue(row.padding, breakpoint))],
            ["background", background(row.background, "transparent")],
          ])
        );

        for (const column of row.columns) {
          const columnSelector = `.${styleClass("column", column.id)}`;
          rules.push(
            rule(columnSelector, [
              [
                "display",
                visibilityDisplay(column.visibility, breakpoint, "flex"),
              ],
              ["flex-direction", "column"],
              ["width", `${finite(column.widths[breakpoint], 100, 0, 100)}%`],
              ["padding", spacing(responsiveValue(column.padding, breakpoint))],
              ["background", background(column.background, "transparent")],
              ["text-align", column.alignment],
              [
                "border",
                `${finite(column.borderWidth)}px solid ${cssText(column.borderColor, "transparent")}`,
              ],
              ["border-radius", `${finite(column.borderRadius)}px`],
            ])
          );

          for (const element of column.elements) {
            const elementSelector = `.${styleClass("element", element.id)}`;
            const isButton =
              element.type === "button" || element.type === "phoneCta";
            const visibleDisplay =
              element.type === "form" ||
              element.type === "shortAnswer" ||
              element.type === "multipleChoice"
                ? "grid"
                : isButton
                  ? "inline-flex"
                  : "block";
            rules.push(
              rule(elementSelector, [
                [
                  "display",
                  visibilityDisplay(
                    element.visibility,
                    breakpoint,
                    visibleDisplay
                  ),
                ],
                [
                  "font-family",
                  cssText(
                    element.styles.fontFamily,
                    element.type === "heading"
                      ? graph.globalStyles.fonts.heading
                      : graph.globalStyles.fonts.body
                  ),
                ],
                [
                  "font-size",
                  `${finite(responsiveValue(element.styles.fontSize, breakpoint), 16, 1, 500)}px`,
                ],
                [
                  "font-weight",
                  finite(
                    element.styles.fontWeight,
                    isButton ? graph.globalStyles.button.fontWeight : 500,
                    1,
                    1000
                  ),
                ],
                [
                  "line-height",
                  finite(
                    element.styles.lineHeight,
                    element.type === "heading" ? 1.05 : 1.65,
                    0.1,
                    10
                  ),
                ],
                [
                  "letter-spacing",
                  `${finite(element.styles.letterSpacing, 0, -20, 100)}px`,
                ],
                [
                  "color",
                  cssText(
                    element.styles.color,
                    isButton
                      ? graph.globalStyles.button.color
                      : element.type === "heading"
                        ? graph.globalStyles.colors.heading
                        : graph.globalStyles.colors.text
                  ),
                ],
                [
                  "text-align",
                  responsiveValue(element.styles.textAlign, breakpoint) ??
                    "left",
                ],
                [
                  "padding",
                  spacing(
                    responsiveValue(element.styles.padding, breakpoint)
                  ) ||
                    (isButton
                      ? `${finite(graph.globalStyles.button.paddingY)}px ${finite(graph.globalStyles.button.paddingX)}px`
                      : "0"),
                ],
                [
                  "margin",
                  spacing(responsiveValue(element.styles.margin, breakpoint)),
                ],
                [
                  "background",
                  background(
                    element.styles.background,
                    isButton
                      ? graph.globalStyles.button.background
                      : "transparent"
                  ),
                ],
                [
                  "border",
                  `${finite(element.styles.borderWidth)}px solid ${cssText(element.styles.borderColor, "transparent")}`,
                ],
                [
                  "border-radius",
                  `${finite(element.styles.borderRadius, isButton ? graph.globalStyles.button.radius : 0)}px`,
                ],
                ["box-shadow", cssText(element.styles.shadow, "none")],
              ])
            );
          }
        }
      }
    }
  }
  return rules;
}

function cssSource(graph: PaidFunnelGraph): string {
  const { colors, fonts, button } = graph.globalStyles;
  const base = `:root{--background:${cssText(colors.background, "#ffffff")};--surface:${cssText(colors.surface, "#f8fafc")};--heading-text:${cssText(colors.heading, "#0f172a")};--text:${cssText(colors.text, "#172033")};--muted:${cssText(colors.muted, "#64748b")};--primary:${cssText(colors.primary, "#1463f3")};--primary-text:${cssText(colors.primaryText, "#ffffff")};--border:${cssText(colors.border, "#d8e0ec")};--heading:${cssText(fonts.heading, "Inter")};--body:${cssText(fonts.body, "Inter")}}*{box-sizing:border-box}body{margin:0;background:var(--background);color:var(--text);font-family:var(--body),system-ui,sans-serif}main{min-height:100vh}.section{isolation:isolate}.row{display:flex}.column{display:flex;flex-direction:column;gap:18px}h1,h2,h3{color:var(--heading-text);font-family:var(--heading),system-ui,sans-serif;margin:0;line-height:1.05}h1{font-size:clamp(2.25rem,6vw,4.5rem)}p{color:var(--text);font-size:1.1rem;line-height:1.65}.funnel-button,.choice{display:inline-flex;justify-content:center;border:0;border-radius:${finite(button.radius)}px;background:${cssText(button.background, "#1463f3")};color:${cssText(button.color, "#ffffff")};padding:${finite(button.paddingY)}px ${finite(button.paddingX)}px;font-weight:${finite(button.fontWeight, 800, 1, 1000)};text-decoration:none;cursor:pointer}.funnel-form,.survey-question{display:grid;gap:12px;width:min(100%,520px);margin:0 auto}.funnel-form label{display:grid;gap:6px}.funnel-form input{min-height:48px;border:1px solid var(--border);border-radius:8px;padding:0 14px;font:inherit}.funnel-form .consent{grid-template-columns:auto 1fr;align-items:start;color:var(--muted)}.funnel-form .consent input{min-height:0;margin-top:4px}blockquote footer,input::placeholder{color:var(--muted)}.funnel-error{color:#b91c1c;font-size:.95rem;font-weight:700}.choice{width:100%;background:var(--surface);color:var(--text);border:1px solid var(--border);text-align:left}.choice[data-selected=true]{border-color:var(--primary);box-shadow:0 0 0 2px color-mix(in srgb,var(--primary) 20%,transparent)}img{display:block;max-width:100%;height:auto}`;
  const desktop = graphRules(graph, "desktop").join("");
  const tablet = graphRules(graph, "tablet").join("");
  const mobile = graphRules(graph, "mobile").join("");
  return `${base}${desktop}@media(max-width:1024px){${tablet}}@media(max-width:720px){${mobile}}`;
}

export function compilePaidFunnelToAstro(
  graph: PaidFunnelGraph
): AstroOutputFile[] {
  const paths = new Set<string>();
  const pageFiles = graph.steps.map(step => {
    const page = graph.pages[step.key];
    if (!page) throw new Error(`Missing page graph for ${step.key}.`);
    const path = routePath(step.slug);
    if (paths.has(path))
      throw new Error(`Duplicate Astro page URL: ${step.slug}`);
    paths.add(path);
    return { path, contents: pageSource(step, page, graph) };
  });
  return [
    {
      path: "package.json",
      contents:
        JSON.stringify(
          {
            private: true,
            type: "module",
            scripts: {
              build: "astro build",
              deploy: "npm run build && wrangler deploy",
            },
            dependencies: { astro: "7.2.1", "@astrojs/cloudflare": "14.2.1" },
            devDependencies: { wrangler: "4.124.0" },
          },
          null,
          2
        ) + "\n",
    },
    {
      path: "astro.config.mjs",
      contents:
        'import { defineConfig } from "astro/config";\nimport cloudflare from "@astrojs/cloudflare";\nexport default defineConfig({ output: "server", session: false, adapter: cloudflare({ imageService: "compile" }) });\n',
    },
    { path: "src/layouts/FunnelLayout.astro", contents: layoutSource() },
    { path: "src/styles/funnel.css", contents: cssSource(graph) },
    { path: "public/scripts/funnel-runtime.js", contents: runtimeSource },
    { path: "src/pages/api/funnel-config.ts", contents: configEndpointSource },
    { path: "src/pages/api/funnel-event.ts", contents: endpointSource },
    { path: "src/pages/api/lead-stage.ts", contents: leadStageEndpointSource },
    { path: "migrations/0001_funnel_events.sql", contents: d1MigrationSource },
    ...pageFiles,
  ].sort((left, right) => left.path.localeCompare(right.path));
}
