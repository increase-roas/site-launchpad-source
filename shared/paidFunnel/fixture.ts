import {
  CANONICAL_OFFLINE_CONVERSION_CONTRACT,
  createColumn,
  createElement,
  createEmptyPage,
  createIdFactory,
  createRow,
  createSection,
  defaultGlobalStyles,
  PAID_FUNNEL_GRAPH_SCHEMA_VERSION,
  PAID_FUNNEL_KIND,
  type PaidFunnelGraph,
  type PaidFunnelStep,
} from "./graph";
import { createSectionPreset, PAID_ADS_SECTION_PRESET_LABELS } from "./presets";

export const GENERIC_PAID_FUNNEL_FIXTURE_KEY = "generic-paid-funnel";

function step(key: PaidFunnelStep["key"], type: PaidFunnelStep["type"], slug: string, title: string, next: PaidFunnelStep["nextStep"]): PaidFunnelStep {
  return {
    key,
    type,
    slug,
    title,
    seo: { title: `${title} | Paid offer`, description: `${title} step for the generic paid funnel.` },
    nextStep: next,
    previewState: "draft",
    publishState: "draft",
  };
}

export function createGenericPaidFunnelFixture(nextId: (() => string) | string = "fixture"): PaidFunnelGraph {
  const makeId = typeof nextId === "function" ? nextId : createIdFactory(nextId);
  const landing = createEmptyPage(makeId, "landing");
  landing.sections = [
    createSectionPreset("hero", makeId),
    createSectionPreset("three-column", makeId),
    createSection(makeId, {
      preset: "boxed",
      rows: [createRow(makeId, [createColumn(makeId, [createElement(makeId, "inventory", { slots: 5, heading: "This week's floor models" })])])],
    }),
    createSectionPreset("testimonial", makeId),
    createSectionPreset("cta", makeId),
  ];
  const form = createEmptyPage(makeId, "form");
  form.sections = [createSectionPreset("form", makeId), createSectionPreset("faq", makeId)];
  const thankYou = createEmptyPage(makeId, "thankYou");
  thankYou.sections = [createSectionPreset("hero", makeId)];
  const booking = createEmptyPage(makeId, "booking");
  booking.sections = [createSectionPreset("cta", makeId)];
  const upsell = createEmptyPage(makeId, "upsell");
  upsell.sections = [createSectionPreset("pricing", makeId), createSectionPreset("footer", makeId)];
  return {
    schemaVersion: PAID_FUNNEL_GRAPH_SCHEMA_VERSION,
    kind: PAID_FUNNEL_KIND,
    funnelKey: GENERIC_PAID_FUNNEL_FIXTURE_KEY,
    name: "Generic multi-step paid funnel",
    version: 1,
    steps: [
      step("landing", "landing", "/", "Landing", { type: "step", stepKey: "form" }),
      step("form", "form", "/form", "Form", { type: "step", stepKey: "thankYou" }),
      step("thankYou", "thankYou", "/thank-you", "Thank You", { type: "step", stepKey: "booking" }),
      step("booking", "booking", "/book", "Booking", { type: "step", stepKey: "upsell" }),
      step("upsell", "upsell", "/upgrade", "Upsell", { type: "none" }),
    ],
    pages: { landing, form, thankYou, booking, upsell },
    globalStyles: defaultGlobalStyles(),
    reusableSections: [],
  };
}

export const GENERIC_PAID_FUNNEL_PACKAGE = {
  schemaVersion: 1 as const,
  templateKey: GENERIC_PAID_FUNNEL_FIXTURE_KEY,
  name: "Generic multi-step paid funnel",
  version: "1.0.0",
  kind: PAID_FUNNEL_KIND,
  framework: "static-html" as const,
  previewEntry: "landing/index.html",
  graph: true,
  sectionPresets: Object.keys(PAID_ADS_SECTION_PRESET_LABELS),
  integrations: ["meta-pixel", "ghl", "google-sheets"],
  requiredRuntimeSecrets: CANONICAL_OFFLINE_CONVERSION_CONTRACT.requiredRuntimeSecrets,
  readinessRules: ["steps", "form-mapping", "navigation", "package", "adapter"],
  publishAdapter: "generic-paid-funnel" as const,
  offlineConversionContract: CANONICAL_OFFLINE_CONVERSION_CONTRACT,
};

export function fixtureRequiresOfflineConversion(graph: PaidFunnelGraph): boolean {
  return graph.steps.some(step => step.type === "form" || step.type === "landing");
}

export const GENERIC_PAID_FUNNEL_LIBRARY_CARD = {
  templateKey: GENERIC_PAID_FUNNEL_FIXTURE_KEY,
  name: GENERIC_PAID_FUNNEL_PACKAGE.name,
  kind: PAID_FUNNEL_KIND,
  flow: "Landing → Form → Thank You → Booking → Upsell",
  description: "Complete GHL-style paid ads funnel with a visual graph on every step.",
};
