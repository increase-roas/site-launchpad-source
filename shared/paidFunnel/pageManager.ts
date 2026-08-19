import {
  cloneNode,
  createEmptyPage,
  createIdFactory,
  type ButtonAction,
  type FunnelPage,
  type FunnelStepNext,
  type PaidFunnelGraph,
  type PaidFunnelStep,
  type PaidFunnelStepType,
} from "./graph";
import { addFunnelStep, updateStep } from "./ops";
import { reorderFunnelSteps } from "./templates";

const KEY_RE = /^[a-z][a-z0-9-]*$/;

function slugify(value: string, fallback: string): string {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || fallback;
}

export function normalizePageSlug(raw: string, fallback = "page"): string {
  const trimmed = raw.trim();
  if (trimmed === "/" || trimmed === "") return "/";
  const body = slugify(trimmed.replace(/^\/+/, ""), fallback);
  return `/${body}`;
}

export function uniquePageSlug(
  graph: PaidFunnelGraph,
  desired: string,
  excludeKey?: string,
): string {
  const used = new Set(
    graph.steps.filter(step => step.key !== excludeKey).map(step => step.slug),
  );
  const start = normalizePageSlug(desired);
  if (start === "/") return used.has("/") ? uniquePageSlug(graph, "/page", excludeKey) : "/";
  if (!used.has(start)) return start;
  let index = 2;
  while (used.has(`${start}-${index}`)) index += 1;
  return `${start}-${index}`;
}

export function uniquePageKey(graph: PaidFunnelGraph, desired: string): string {
  const base = slugify(desired, "page").replace(/[^a-z0-9-]/g, "") || "page";
  const safe = KEY_RE.test(base) ? base : `page-${base}`.replace(/[^a-z0-9-]/g, "");
  const used = new Set(graph.steps.map(step => step.key));
  if (!used.has(safe)) return safe;
  let index = 2;
  while (used.has(`${safe}-${index}`)) index += 1;
  return `${safe}-${index}`;
}

export function uniquePageTitle(graph: PaidFunnelGraph, desired: string): string {
  const base = desired.trim() || "Page";
  const used = new Set(graph.steps.map(step => step.title));
  if (!used.has(base)) return base;
  let index = 2;
  while (used.has(`${base} ${index}`)) index += 1;
  return `${base} ${index}`;
}

function replacementForDeleted(deleted: PaidFunnelStep): FunnelStepNext {
  if (deleted.nextStep.type === "step" && deleted.nextStep.stepKey === deleted.key) {
    return { type: "none" };
  }
  return deleted.nextStep;
}

function buttonActionForNext(next: FunnelStepNext): ButtonAction {
  if (next.type === "step") return { type: "step", stepKey: next.stepKey };
  if (next.type === "redirect") return { type: "url", href: next.url, openInNewTab: false };
  return { type: "url", href: "", openInNewTab: false };
}

function repairDeletedStepAction(
  action: ButtonAction | undefined,
  deletedStepKey: string,
  replacement: FunnelStepNext,
): ButtonAction | undefined {
  if (!action) return action;
  if (action.type === "step" && action.stepKey === deletedStepKey) {
    return buttonActionForNext(replacement);
  }
  if (action.type === "booking" && action.stepKey === deletedStepKey) {
    return replacement.type === "step" ? { ...action, stepKey: replacement.stepKey } : { type: "booking" };
  }
  if (action.type === "conditional") {
    const replacementKey = replacement.type === "step" ? replacement.stepKey : null;
    const rules = action.rules.flatMap(rule => {
      if (rule.stepKey !== deletedStepKey) return [rule];
      return replacementKey ? [{ ...rule, stepKey: replacementKey }] : [];
    });
    const fallbackStepKey =
      action.fallbackStepKey === deletedStepKey ? replacementKey ?? undefined : action.fallbackStepKey;
    return { ...action, rules, fallbackStepKey };
  }
  return action;
}

function repairDeletedStepActions(
  graph: PaidFunnelGraph,
  deletedStepKey: string,
  replacement: FunnelStepNext,
): PaidFunnelGraph["pages"] {
  return Object.fromEntries(
    Object.entries(graph.pages).map(([stepKey, page]) => [
      stepKey,
      {
        ...page,
        sections: page.sections.map(section => ({
          ...section,
          rows: section.rows.map(row => ({
            ...row,
            columns: row.columns.map(column => ({
              ...column,
              elements: column.elements.map(element => {
                if (element.type !== "button" && element.type !== "phoneCta") return element;
                const action = element.props.action as ButtonAction | undefined;
                const repaired = repairDeletedStepAction(action, deletedStepKey, replacement);
                return repaired === action
                  ? element
                  : { ...element, props: { ...element.props, action: repaired } };
              }),
            })),
          })),
        })),
      },
    ]),
  );
}

function retargetIds(page: FunnelPage, nextId: () => string): FunnelPage {
  const walk = (node: unknown): unknown => {
    if (Array.isArray(node)) return node.map(walk);
    if (!node || typeof node !== "object") return node;
    const record = node as Record<string, unknown>;
    const copy: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(record)) {
      copy[key] = key === "id" && typeof child === "string" ? nextId() : walk(child);
    }
    return copy;
  };
  return walk(page) as FunnelPage;
}

export function addBlankPage(
  graph: PaidFunnelGraph,
  input: { title?: string; type?: PaidFunnelStepType } = {},
): { graph: PaidFunnelGraph; stepKey: string } {
  const title = uniquePageTitle(graph, input.title ?? "Page");
  const key = uniquePageKey(graph, title);
  const slug = uniquePageSlug(graph, title);
  const type = input.type ?? "landing";
  const page = createEmptyPage(createIdFactory(`${key}-pg`), key);
  const step: PaidFunnelStep = {
    key,
    type,
    slug,
    title,
    seo: { title, description: "" },
    nextStep: { type: "none" },
    tracking:
      type === "form"
        ? { browserEvent: "Lead", serverEvent: "Lead" }
        : { browserEvent: "ViewContent", serverEvent: "ViewContent" },
    previewState: "draft",
    publishState: "draft",
  };
  let next = addFunnelStep(graph, step, page);
  const previous = next.steps[next.steps.length - 2];
  if (previous && previous.nextStep.type === "none") {
    next = {
      ...next,
      steps: next.steps.map(entry =>
        entry.key === previous.key ? { ...entry, nextStep: { type: "step", stepKey: key } } : entry,
      ),
    };
  }
  return { graph: next, stepKey: key };
}

export function renamePage(graph: PaidFunnelGraph, stepKey: string, title: string): PaidFunnelGraph {
  const step = graph.steps.find(entry => entry.key === stepKey);
  if (!step) return graph;
  const nextTitle = uniquePageTitle(
    { ...graph, steps: graph.steps.filter(entry => entry.key !== stepKey) },
    title,
  );
  return updateStep(graph, stepKey, {
    title: nextTitle,
    seo: { ...step.seo, title: nextTitle },
  });
}

export function setPageSlug(graph: PaidFunnelGraph, stepKey: string, slug: string): PaidFunnelGraph {
  if (!graph.steps.some(step => step.key === stepKey)) return graph;
  return updateStep(graph, stepKey, { slug: uniquePageSlug(graph, slug, stepKey) });
}

export function setPageNext(
  graph: PaidFunnelGraph,
  stepKey: string,
  nextStep: FunnelStepNext,
): PaidFunnelGraph {
  if (nextStep.type === "step" && nextStep.stepKey === stepKey) {
    return updateStep(graph, stepKey, { nextStep: { type: "none" } });
  }
  if (nextStep.type === "step" && !graph.pages[nextStep.stepKey]) return graph;
  return updateStep(graph, stepKey, { nextStep });
}

export function duplicatePage(
  graph: PaidFunnelGraph,
  stepKey: string,
): { graph: PaidFunnelGraph; stepKey: string } {
  const step = graph.steps.find(entry => entry.key === stepKey);
  const page = graph.pages[stepKey];
  if (!step || !page) return { graph, stepKey };
  const title = uniquePageTitle(graph, `${step.title} copy`);
  const key = uniquePageKey(graph, `${step.key}-copy`);
  const slug = uniquePageSlug(graph, `${step.slug}-copy`);
  const used = new Set<string>();
  const visit = (value: unknown) => {
    if (!value || typeof value !== "object") return;
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    const record = value as Record<string, unknown>;
    if (typeof record.id === "string") used.add(record.id);
    Object.values(record).forEach(visit);
  };
  Object.values(graph.pages).forEach(visit);
  const nextId = createIdFactory(`dup-${key}`);
  const takeId = () => {
    let id = nextId();
    while (used.has(id)) id = nextId();
    used.add(id);
    return id;
  };
  const cloned = retargetIds(cloneNode(page), takeId);
  cloned.stepKey = key;
  const created = addFunnelStep(graph, {
    ...step,
    key,
    title,
    slug,
    seo: { ...step.seo, title },
    previewState: "draft",
    publishState: "draft",
  }, cloned);
  const insertAt = created.steps.findIndex(entry => entry.key === key);
  const from = insertAt;
  const to = graph.steps.findIndex(entry => entry.key === stepKey) + 1;
  return {
    graph: from >= 0 && to >= 0 ? reorderFunnelSteps(created, from, to) : created,
    stepKey: key,
  };
}

export function deletePageSafely(
  graph: PaidFunnelGraph,
  stepKey: string,
): { graph: PaidFunnelGraph; stepKey: string } {
  if (graph.steps.length <= 1) {
    throw new Error("A funnel must keep at least one page.");
  }
  const deletedIndex = graph.steps.findIndex(step => step.key === stepKey);
  const deleted = graph.steps[deletedIndex];
  if (!deleted) return { graph, stepKey: graph.steps[0]!.key };
  const replacement = replacementForDeleted(deleted);
  const steps = graph.steps
    .filter(step => step.key !== stepKey)
    .map(step =>
      step.nextStep.type === "step" && step.nextStep.stepKey === stepKey
        ? { ...step, nextStep: replacement }
        : step,
    );
  const repaired = repairDeletedStepActions(graph, stepKey, replacement);
  const { [stepKey]: _removed, ...pages } = repaired;
  const nextGraph = { ...graph, steps, pages };
  const selected =
    (replacement.type === "step" ? steps.find(step => step.key === replacement.stepKey) : undefined) ??
    steps[Math.min(deletedIndex, steps.length - 1)] ??
    steps[0];
  return { graph: nextGraph, stepKey: selected!.key };
}

export function reorderPages(graph: PaidFunnelGraph, from: number, to: number): PaidFunnelGraph {
  return reorderFunnelSteps(graph, from, to);
}
