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
import { applyOptInTemplate, createSurveyQuestionStep } from "./templates";

export const GENERIC_PAID_FUNNEL_FIXTURE_KEY = "generic-paid-funnel";

function step(key: PaidFunnelStep["key"], type: PaidFunnelStep["type"], slug: string, title: string, next: PaidFunnelStep["nextStep"]): PaidFunnelStep {
  return {
    key,
    type,
    slug,
    title,
    seo: { title: `${title} | Paid offer`, description: `${title} step for the generic paid funnel.` },
    nextStep: next,
    tracking: {
      browserEvent: type === "thankYou" ? "PageView" : "ViewContent",
      serverEvent: type === "survey" ? "LeadSurveyAnswer" : type === "form" || type === "landing" ? "Lead" : "PageView",
    },
    previewState: "draft",
    publishState: "draft",
  };
}

export function createGenericPaidFunnelFixture(nextId: (() => string) | string = "fixture"): PaidFunnelGraph {
  const makeId = typeof nextId === "function" ? nextId : createIdFactory(nextId);
  const landing = createEmptyPage(makeId, "landing");
  landing.sections = [];
  const homeowner = createSurveyQuestionStep({
    key: "survey-homeowner",
    slug: "survey/homeowner",
    title: "Homeownership",
    question: "Do you own the property where this will be installed?",
    field: "homeowner",
    options: ["Yes", "No", "Not yet"],
    nextStepKey: "survey-timeline",
    nextId: makeId,
  });
  const timeline = createSurveyQuestionStep({
    key: "survey-timeline",
    slug: "survey/timeline",
    title: "Timeline",
    question: "When would you like to get started?",
    field: "timeline",
    options: ["As soon as possible", "Within 30 days", "Just researching"],
    nextStepKey: "form",
    nextId: makeId,
  });
  const form = createEmptyPage(makeId, "form");
  form.sections = [createSectionPreset("form", makeId), createSectionPreset("faq", makeId)];
  const thankYou = createEmptyPage(makeId, "thankYou");
  thankYou.sections = [createSectionPreset("hero", makeId)];
  const graph: PaidFunnelGraph = {
    schemaVersion: PAID_FUNNEL_GRAPH_SCHEMA_VERSION,
    kind: PAID_FUNNEL_KIND,
    funnelKey: GENERIC_PAID_FUNNEL_FIXTURE_KEY,
    name: "Generic multi-step paid funnel",
    version: 1,
    steps: [
      step("landing", "landing", "/", "Opt-in page", { type: "step", stepKey: "survey-homeowner" }),
      homeowner.step,
      timeline.step,
      step("form", "form", "/contact", "Contact form", { type: "step", stepKey: "thankYou" }),
      step("thankYou", "thankYou", "/thank-you", "Thank you", { type: "none" }),
    ],
    pages: {
      landing,
      "survey-homeowner": homeowner.page,
      "survey-timeline": timeline.page,
      form,
      thankYou,
    },
    globalStyles: defaultGlobalStyles(),
    reusableSections: [],
  };
  return applyOptInTemplate(graph, "hero-with-form", makeId);
}

export const GENERIC_PAID_FUNNEL_PACKAGE = {
  schemaVersion: 1 as const,
  templateKey: GENERIC_PAID_FUNNEL_FIXTURE_KEY,
  name: "Generic multi-step paid funnel",
  version: "1.0.0",
  kind: PAID_FUNNEL_KIND,
  framework: "astro" as const,
  previewEntry: "src/pages/index.astro",
  graph: true,
  sectionPresets: Object.keys(PAID_ADS_SECTION_PRESET_LABELS),
  integrations: ["meta-pixel", "ghl", "google-sheets"],
  resources: [{ type: "d1", name: "paid-funnel-events", binding: "FUNNEL_DB" }],
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
  flow: "Opt-in → Survey questions → Contact → Thank You",
  description: "Perspective-style visual funnel compiled to fast Astro pages, with one URL per survey question.",
};
