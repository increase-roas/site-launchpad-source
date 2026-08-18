import {
  PAID_FUNNEL_GRAPH_SCHEMA_VERSION,
  PAID_FUNNEL_KIND,
  PAID_FUNNEL_STEP_TYPES,
  defaultGlobalStyles,
  type FunnelPage,
  type PaidFunnelGraph as StudioGraph,
  type PaidFunnelStep,
  type PaidFunnelStepType,
} from "./graph";
import {
  PAID_FUNNEL_GRAPH_VERSION,
  migratePaidFunnelGraph,
  type PaidFunnelGraph as StorageGraph,
} from "../paidFunnelGraph";

export type PersistStep = {
  id: number;
  key: string;
  stepType: string;
  slug: string;
  title: string;
  seo: Record<string, unknown> | null;
  nextStep: string | null;
  previewState: string;
  publishState: string;
  position: number;
};

export type PersistFunnel = {
  id: number;
  name: string;
  slug: string;
};

export type PersistGraphRow = {
  stepId: number;
  updatedAt: Date | string;
  graph: unknown;
};

const STEP_TYPES = new Set<string>(PAID_FUNNEL_STEP_TYPES);

function asStepType(value: string): PaidFunnelStepType {
  return STEP_TYPES.has(value) ? (value as PaidFunnelStepType) : "landing";
}

function asState(value: string): PaidFunnelStep["previewState"] {
  if (value === "preview" || value === "published") return value;
  return "draft";
}

function seoFrom(raw: Record<string, unknown> | null, title: string): PaidFunnelStep["seo"] {
  return {
    title: typeof raw?.title === "string" && raw.title.trim() ? raw.title : title,
    description: typeof raw?.description === "string" ? raw.description : "",
    shareImage:
      typeof raw?.shareImage === "string"
        ? raw.shareImage
        : typeof raw?.ogImage === "string"
          ? raw.ogImage
          : undefined,
  };
}

export function studioToStorageGraph(graph: StudioGraph): StorageGraph {
  const pages = graph.steps
    .map(step => graph.pages[step.key])
    .filter((page): page is FunnelPage => Boolean(page));
  const leftover = Object.values(graph.pages).filter(
    page => !pages.some(existing => existing.id === page.id)
  );
  return migratePaidFunnelGraph({
    version: PAID_FUNNEL_GRAPH_VERSION,
    pages: [...pages, ...leftover],
    funnelKey: graph.funnelKey,
    name: graph.name,
    globalStyles: graph.globalStyles,
    reusableSections: graph.reusableSections,
  });
}

export function storageToStudioGraph(
  storage: StorageGraph,
  input: {
    funnel: PersistFunnel;
    steps: PersistStep[];
  }
): StudioGraph {
  const pages: Record<string, FunnelPage> = {};
  for (const page of storage.pages) {
    pages[page.stepKey] = page;
  }
  const orderedSteps = [...input.steps].sort((a, b) => a.position - b.position);
  const steps: PaidFunnelStep[] =
    orderedSteps.length > 0
      ? orderedSteps.map(step => ({
          key: step.key,
          type: asStepType(step.stepType),
          slug: step.slug.startsWith("/") ? step.slug : `/${step.slug}`,
          title: step.title,
          seo: seoFrom(step.seo, step.title),
          nextStep: step.nextStep
            ? { type: "step", stepKey: step.nextStep }
            : { type: "none" },
          previewState: asState(step.previewState),
          publishState: asState(step.publishState),
        }))
      : storage.pages.map((page, index) => ({
          key: page.stepKey,
          type: asStepType(page.stepKey),
          slug: `/${page.stepKey}`,
          title: page.stepKey,
          seo: { title: page.stepKey, description: "" },
          nextStep:
            index < storage.pages.length - 1
              ? { type: "step" as const, stepKey: storage.pages[index + 1]!.stepKey }
              : { type: "none" as const },
          previewState: "draft" as const,
          publishState: "draft" as const,
        }));
  for (const step of steps) {
    if (!pages[step.key]) {
      pages[step.key] = {
        id: `page-${step.key}`.replace(/[^a-zA-Z0-9_-]/g, "-"),
        kind: "page",
        stepKey: step.key,
        sections: [],
      };
    }
  }
  return {
    schemaVersion: PAID_FUNNEL_GRAPH_SCHEMA_VERSION,
    kind: PAID_FUNNEL_KIND,
    funnelKey: storage.funnelKey ?? input.funnel.slug,
    name: storage.name ?? input.funnel.name,
    version: 1,
    steps,
    pages,
    globalStyles: storage.globalStyles ?? defaultGlobalStyles(),
    reusableSections: storage.reusableSections ?? [],
  };
}

export function assembleStudioGraph(input: {
  funnel: PersistFunnel;
  steps: PersistStep[];
  graphs: PersistGraphRow[];
}): { graph: StudioGraph; stepId: number; expectedUpdatedAt: Date } {
  const rows = [...input.graphs].sort((left, right) => {
    const leftAt = new Date(left.updatedAt).getTime();
    const rightAt = new Date(right.updatedAt).getTime();
    return rightAt - leftAt;
  });
  const byStepKey = new Map<string, FunnelPage>();
  let extras: StorageGraph | null = null;
  for (const row of rows) {
    const storage = migratePaidFunnelGraph(row.graph);
    if (!extras) extras = storage;
    for (const page of storage.pages) {
      if (!byStepKey.has(page.stepKey)) byStepKey.set(page.stepKey, page);
    }
  }
  const merged: StorageGraph = {
    version: PAID_FUNNEL_GRAPH_VERSION,
    pages: [...byStepKey.values()],
    funnelKey: extras?.funnelKey,
    name: extras?.name,
    globalStyles: extras?.globalStyles,
    reusableSections: extras?.reusableSections,
  };
  if (merged.pages.length < 1) {
    throw new Error("Paid funnel graph is missing.");
  }
  const newest = rows[0];
  if (!newest) throw new Error("Graph not found.");
  return {
    graph: storageToStudioGraph(merged, input),
    stepId: newest.stepId,
    expectedUpdatedAt: new Date(newest.updatedAt),
  };
}

export function persistGraphInput(graph: unknown): StorageGraph {
  return migratePaidFunnelGraph(graph);
}
