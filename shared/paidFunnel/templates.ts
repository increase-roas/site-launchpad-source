import {
  createColumn,
  createElement,
  createEmptyPage,
  createIdFactory,
  createRow,
  createSection,
  type PaidFunnelGraph,
  type PaidFunnelStep,
} from "./graph";
import { createSectionPreset } from "./presets";

export const OPT_IN_TEMPLATE_VALUES = [
  "hero-with-form",
  "split-image-form",
  "simple-button",
  "hot-tub-promotion",
] as const;
export type OptInTemplate = (typeof OPT_IN_TEMPLATE_VALUES)[number];

export const OPT_IN_TEMPLATE_LABELS: Record<OptInTemplate, string> = {
  "hero-with-form": "Hero + embedded form",
  "split-image-form": "Split image + form",
  "simple-button": "Simple opt-in button",
  "hot-tub-promotion": "Hot tub promotion",
};

function hotTubPromotion(nextId: () => string) {
  return createSection(nextId, {
    preset: "hero",
    layout: "full",
    minHeight: 560,
    alignment: "center",
    background: { kind: "color", color: "#eef5ff" },
    rows: [
      createRow(nextId, [
        createColumn(nextId, [
          createElement(nextId, "heading", {
            text: "This weekend only: in-stock hot tubs",
            tag: "h1",
          }),
          createElement(nextId, "text", {
            text: "See live inventory, get current pricing, and book a showroom visit.",
          }),
          createElement(nextId, "form", {
            formId: "hot-tub-opt-in",
            fields: ["zip", "firstName", "email", "phone", "consent"],
            submitLabel: "Check availability",
          }),
        ]),
      ]),
    ],
  });
}

function landingKey(graph: PaidFunnelGraph): string {
  return graph.steps.find(step => step.type === "landing")?.key ?? graph.steps[0]?.key ?? "landing";
}

export function applyOptInTemplate(
  graph: PaidFunnelGraph,
  template: OptInTemplate,
  nextId = createIdFactory(`optin-${template}`),
): PaidFunnelGraph {
  const key = landingKey(graph);
  const page = graph.pages[key];
  if (!page) return graph;
  const hero = createSectionPreset("hero", nextId);
  let sections = [hero];

  if (template === "hero-with-form") {
    sections = [hero, createSectionPreset("form", nextId)];
  } else if (template === "split-image-form") {
    sections = [
      createSection(nextId, {
        preset: "two-column",
        layout: "boxed",
        minHeight: 520,
        background: { kind: "color", color: "#ffffff" },
        rows: [
          createRow(nextId, [
            createColumn(nextId, [
              createElement(nextId, "image", {
                src: "",
                alt: "",
                filename: "",
                mediaSpecification: "hero",
              }),
            ], 2),
            createColumn(nextId, [
              createElement(nextId, "heading", { text: "Get your personalized recommendation", tag: "h1" }),
              createElement(nextId, "text", { text: "Answer a few quick questions and see the best option for you." }),
              createElement(nextId, "form", {
                formId: "opt-in-form",
                fields: ["firstName", "email", "consent"],
                submitLabel: "Start my recommendation",
              }),
            ], 2),
          ]),
        ],
      }),
    ];
  } else if (template === "simple-button") {
    sections = [
      createSection(nextId, {
        preset: "boxed",
        layout: "boxed",
        minHeight: 520,
        background: { kind: "color", color: "#eef5ff" },
        rows: [
          createRow(nextId, [
            createColumn(nextId, [
              createElement(nextId, "heading", { text: "Find the right option in under a minute", tag: "h1" }),
              createElement(nextId, "text", { text: "Take the short survey to get a personalized recommendation." }),
              createElement(nextId, "button", { label: "Start", action: { type: "nextStep" } }),
            ]),
          ]),
        ],
      }),
    ];
  } else {
    sections = [hotTubPromotion(nextId)];
  }

  return {
    ...graph,
    pages: { ...graph.pages, [key]: { ...page, sections } },
  };
}

export function createSurveyQuestionStep(input: {
  key: string;
  slug: string;
  title: string;
  question: string;
  field: string;
  options: string[];
  nextStepKey?: string;
  nextId?: () => string;
}): { step: PaidFunnelStep; page: ReturnType<typeof createEmptyPage> } {
  const nextId = input.nextId ?? createIdFactory(input.key);
  const slug = `/${input.slug.replace(/^\/+|\/+$/g, "")}`;
  const page = createEmptyPage(nextId, input.key);
  page.sections = [
    createSection(nextId, {
      preset: "boxed",
      layout: "boxed",
      minHeight: 520,
      background: { kind: "color", color: "#ffffff" },
      rows: [
        createRow(nextId, [
          createColumn(nextId, [
            createElement(nextId, "heading", { text: input.question, tag: "h1" }),
            createElement(nextId, "multipleChoice", {
              field: input.field,
              question: input.question,
              options: input.options,
              autoAdvance: true,
            }),
          ]),
        ]),
      ],
    }),
  ];
  return {
    step: {
      key: input.key,
      type: "survey",
      slug,
      title: input.title,
      seo: { title: input.title, description: input.question },
      nextStep: input.nextStepKey ? { type: "step", stepKey: input.nextStepKey } : { type: "none" },
      tracking: {
        browserEvent: "ViewContent",
        serverEvent: "LeadSurveyAnswer",
        answerField: input.field,
      },
      previewState: "draft",
      publishState: "draft",
    },
    page,
  };
}

export function reorderFunnelSteps(graph: PaidFunnelGraph, from: number, to: number): PaidFunnelGraph {
  if (from === to || from < 0 || to < 0 || from >= graph.steps.length || to >= graph.steps.length) return graph;
  const steps = [...graph.steps];
  const [moved] = steps.splice(from, 1);
  if (!moved) return graph;
  steps.splice(to, 0, moved);
  return { ...graph, steps };
}
