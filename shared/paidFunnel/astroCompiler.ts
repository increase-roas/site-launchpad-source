import type {
  ButtonAction,
  FunnelElement,
  FunnelPage,
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

function actionDestination(action: ButtonAction | undefined, step: PaidFunnelStep, graph: PaidFunnelGraph): string {
  if (!action || action.type === "nextStep" || action.type === "formSubmit") return destination(step.nextStep, graph);
  if (action.type === "step" || action.type === "booking") {
    return graph.steps.find(candidate => candidate.key === action.stepKey)?.slug ?? destination(step.nextStep, graph);
  }
  if (action.type === "url") return action.href;
  if (action.type === "phone") return `tel:${action.tel}`;
  return destination(step.nextStep, graph);
}

function renderElement(element: FunnelElement, step: PaidFunnelStep, graph: PaidFunnelGraph): string {
  const props = element.props;
  if (element.type === "heading") {
    const tag = props.tag === "h2" || props.tag === "h3" ? props.tag : "h1";
    return `<${tag} data-block-id="${html(element.id)}">${html(props.text)}</${tag}>`;
  }
  if (element.type === "text") return `<p data-block-id="${html(element.id)}">${html(props.text)}</p>`;
  if (element.type === "image") {
    return `<img data-block-id="${html(element.id)}" src="${html(props.src)}" alt="${html(props.alt)}" loading="lazy" decoding="async" />`;
  }
  if (element.type === "button" || element.type === "phoneCta") {
    const action = props.action as ButtonAction | undefined;
    const href = actionDestination(action, step, graph);
    return `<a class="funnel-button" data-funnel-link data-destination="${html(href)}" href="${html(href || "#")}">${html(props.label ?? "Continue")}</a>`;
  }
  if (element.type === "form") {
    const fields = Array.isArray(props.fields) ? props.fields.map(String) : ["firstName", "email", "phone"];
    return `<form class="funnel-form" data-funnel-form data-destination="${html(destination(step.nextStep, graph))}">
${fields.map(field => `<label><span>${html(field.replace(/([A-Z])/g, " $1"))}</span><input name="${html(field)}" ${field === "email" ? 'type="email"' : field === "phone" ? 'type="tel"' : 'type="text"'} required /></label>`).join("\n")}
<button class="funnel-button" type="submit">${html(props.submitLabel ?? "Continue")}</button>
</form>`;
  }
  if (element.type === "multipleChoice") {
    const field = String(props.field ?? step.tracking?.answerField ?? "answer");
    const options = Array.isArray(props.options) ? props.options.map(String) : [];
    return `<div class="survey-question" data-survey-question data-field="${html(field)}" data-destination="${html(destination(step.nextStep, graph))}" data-auto-advance="${props.autoAdvance === false ? "false" : "true"}">
${options.map(option => `<button type="button" class="choice" data-answer="${html(option)}">${html(option)}</button>`).join("\n")}
</div>`;
  }
  if (element.type === "shortAnswer") {
    const field = String(props.field ?? step.tracking?.answerField ?? "answer");
    return `<form class="funnel-form" data-funnel-form data-answer-field="${html(field)}" data-destination="${html(destination(step.nextStep, graph))}"><label><span>${html(props.question ?? "Your answer")}</span><input name="${html(field)}" required /></label><button class="funnel-button" type="submit">Continue</button></form>`;
  }
  if (element.type === "testimonial") return `<blockquote>${html(props.quote)}<footer>${html(props.author)}</footer></blockquote>`;
  if (element.type === "divider") return "<hr />";
  if (element.type === "spacer") return '<div class="spacer" aria-hidden="true"></div>';
  if (element.type === "list") {
    const items = Array.isArray(props.items) ? props.items.map(String) : [];
    return `<ul>${items.map(item => `<li>${html(item)}</li>`).join("")}</ul>`;
  }
  return `<div class="placeholder" data-block-type="${html(element.type)}">${html(props.label ?? element.type)}</div>`;
}

function renderPageBody(page: FunnelPage, step: PaidFunnelStep, graph: PaidFunnelGraph): string {
  return page.sections.map(section => {
    const rows = section.rows.map(row => {
      const columns = row.columns.map(column => `<div class="column" style="--desktop-width:${column.widths.desktop}%">${column.elements.map(element => renderElement(element, step, graph)).join("\n")}</div>`).join("\n");
      return `<div class="row">${columns}</div>`;
    }).join("\n");
    return `<section class="section section-${html(section.preset)}" data-section-id="${html(section.id)}">${rows}</section>`;
  }).join("\n");
}

function pageSource(step: PaidFunnelStep, page: FunnelPage, graph: PaidFunnelGraph): string {
  const tracking = step.tracking ?? {
    browserEvent: step.type === "thankYou" ? "PageView" : "ViewContent",
    serverEvent: step.type === "survey" ? "LeadSurveyAnswer" : step.type === "form" || step.type === "landing" ? "Lead" : "PageView",
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
function readContext() {
  let stored = {};
  try { stored = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || "{}"); } catch {}
  const params = new URLSearchParams(location.search);
  const attribution = { ...(stored.attribution || {}) };
  for (const key of ATTRIBUTION_KEYS) if (params.get(key)) attribution[key] = params.get(key);
  const fbp = cookie("_fbp") || stored.fbp || "";
  const fbc = cookie("_fbc") || stored.fbc || (attribution.fbclid ? "fb.1." + Date.now() + "." + attribution.fbclid : "");
  const context = { lead_uuid: stored.lead_uuid || id(), attribution, fbp, fbc };
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(context));
  return context;
}
const context = readContext();
async function emit(kind, data = {}, destination = "") {
  const event_id = id();
  const tracking = window.__FUNNEL_TRACKING__ || {};
  const eventName = kind === "answer" ? (tracking.serverEvent || "LeadSurveyAnswer") : (tracking.browserEvent || "ViewContent");
  const payload = { event_id, event_name: eventName, browser_event: eventName, lead_uuid: context.lead_uuid, step_key: tracking.stepKey, page_path: location.pathname, page_url: location.href, attribution: context.attribution, meta: { fbp: context.fbp, fbc: context.fbc }, data };
  if (typeof window.fbq === "function") {
    const standard = ["PageView","ViewContent","Lead","CompleteRegistration","Purchase"].includes(payload.browser_event);
    const browserData = data.fields ? { form_complete: true, field_names: Object.keys(data.fields) } : data;
    window.fbq(standard ? "track" : "trackCustom", payload.browser_event, { ...browserData, step_key: payload.step_key, page_path: payload.page_path }, { eventID: event_id });
  }
  try { await fetch("/api/funnel-event", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload), keepalive: true }); } catch {}
  if (destination) location.assign(destination);
}
emit("view");
document.querySelectorAll("[data-survey-question]").forEach(root => root.addEventListener("click", event => {
  const button = event.target.closest("[data-answer]");
  if (!button) return;
  root.querySelectorAll("[data-answer]").forEach(node => node.dataset.selected = String(node === button));
  if (root.dataset.autoAdvance !== "false") emit("answer", { field: root.dataset.field, value: button.dataset.answer }, root.dataset.destination || "");
}));
document.querySelectorAll("[data-funnel-form]").forEach(form => form.addEventListener("submit", event => {
  event.preventDefault();
  const values = Object.fromEntries(new FormData(form).entries());
  emit("answer", { fields: values, field: form.dataset.answerField || undefined }, form.dataset.destination || "");
}));
`;

const endpointSource = `import type { APIRoute } from "astro";
const sha256 = async (value: string) => Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value.trim().toLowerCase())))).map(byte => byte.toString(16).padStart(2, "0")).join("");
export const POST: APIRoute = async ({ request, locals }) => {
  const payload = await request.json();
  const env = (locals as any).runtime?.env ?? {};
  if (!env.META_PIXEL_ID || !env.META_CAPI_ACCESS_TOKEN) return new Response(null, { status: 202 });
  const user_data: Record<string, unknown> = { external_id: [await sha256(String(payload.lead_uuid))] };
  if (payload.meta?.fbp) user_data.fbp = payload.meta.fbp;
  if (payload.meta?.fbc) user_data.fbc = payload.meta.fbc;
  const clientIp = request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const userAgent = request.headers.get("user-agent");
  if (clientIp) user_data.client_ip_address = clientIp;
  if (userAgent) user_data.client_user_agent = userAgent;
  const fields = payload.data?.fields ?? {};
  if (fields.email) user_data.em = [await sha256(String(fields.email))];
  if (fields.phone) user_data.ph = [await sha256(String(fields.phone).replace(/\\D/g, ""))];
  if (fields.firstName) user_data.fn = [await sha256(String(fields.firstName))];
  if (fields.lastName) user_data.ln = [await sha256(String(fields.lastName))];
  const { fields: _privateFields, ...safeData } = payload.data ?? {};
  const event = { event_name: payload.event_name, event_time: Math.floor(Date.now() / 1000), event_id: payload.event_id, action_source: "website", event_source_url: payload.page_url, user_data, custom_data: { ...safeData, form_field_names: Object.keys(fields), step_key: payload.step_key, page_path: payload.page_path, ...payload.attribution } };
  const response = await fetch(\`https://graph.facebook.com/v20.0/\${env.META_PIXEL_ID}/events?access_token=\${encodeURIComponent(env.META_CAPI_ACCESS_TOKEN)}\`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ data: [event] }) });
  return new Response(null, { status: response.ok ? 202 : 502 });
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

function cssSource(graph: PaidFunnelGraph): string {
  const { colors, fonts, button, containers } = graph.globalStyles;
  return `:root{--background:${colors.background};--surface:${colors.surface};--text:${colors.text};--muted:${colors.muted};--primary:${colors.primary};--primary-text:${colors.primaryText};--border:${colors.border};--heading:${fonts.heading};--body:${fonts.body}}*{box-sizing:border-box}body{margin:0;background:var(--background);color:var(--text);font-family:var(--body),system-ui,sans-serif}main{min-height:100vh}.section{padding:64px 24px}.row{display:flex;gap:24px;max-width:${containers.boxedMaxWidth}px;margin:0 auto}.column{display:flex;flex-direction:column;gap:18px;width:var(--desktop-width)}h1,h2,h3{font-family:var(--heading),system-ui,sans-serif;margin:0;line-height:1.05}h1{font-size:clamp(2.25rem,6vw,4.5rem)}p{color:var(--muted);font-size:1.1rem;line-height:1.65}.funnel-button,.choice{display:inline-flex;justify-content:center;border:0;border-radius:${button.radius}px;background:${button.background};color:${button.color};padding:${button.paddingY}px ${button.paddingX}px;font-weight:${button.fontWeight};text-decoration:none;cursor:pointer}.funnel-form,.survey-question{display:grid;gap:12px;width:min(100%,520px);margin:0 auto}.funnel-form label{display:grid;gap:6px}.funnel-form input{min-height:48px;border:1px solid var(--border);border-radius:8px;padding:0 14px;font:inherit}.choice{width:100%;background:var(--surface);color:var(--text);border:1px solid var(--border);text-align:left}.choice[data-selected=true]{border-color:var(--primary);box-shadow:0 0 0 2px color-mix(in srgb,var(--primary) 20%,transparent)}img{display:block;max-width:100%;height:auto;border-radius:12px}@media(max-width:720px){.section{padding:40px 16px}.row{flex-direction:column}.column{width:100%}}`;
}

export function compilePaidFunnelToAstro(graph: PaidFunnelGraph): AstroOutputFile[] {
  const paths = new Set<string>();
  const pageFiles = graph.steps.map(step => {
    const page = graph.pages[step.key];
    if (!page) throw new Error(`Missing page graph for ${step.key}.`);
    const path = routePath(step.slug);
    if (paths.has(path)) throw new Error(`Duplicate Astro page URL: ${step.slug}`);
    paths.add(path);
    return { path, contents: pageSource(step, page, graph) };
  });
  return [
    { path: "package.json", contents: JSON.stringify({ private: true, type: "module", scripts: { build: "astro build" }, dependencies: { astro: "^5.0.0", "@astrojs/cloudflare": "^12.0.0" } }, null, 2) + "\n" },
    { path: "astro.config.mjs", contents: 'import { defineConfig } from "astro/config";\nimport cloudflare from "@astrojs/cloudflare";\nexport default defineConfig({ output: "server", adapter: cloudflare() });\n' },
    { path: "src/layouts/FunnelLayout.astro", contents: layoutSource() },
    { path: "src/styles/funnel.css", contents: cssSource(graph) },
    { path: "public/scripts/funnel-runtime.js", contents: runtimeSource },
    { path: "src/pages/api/funnel-event.ts", contents: endpointSource },
    ...pageFiles,
  ].sort((left, right) => left.path.localeCompare(right.path));
}
