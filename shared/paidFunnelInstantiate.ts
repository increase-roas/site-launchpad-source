import type { PaidFunnelPackage } from "./paidFunnelContract";
import type { PaidFunnelGraph } from "./paidFunnelGraph";

export type PaidFunnelInsertStep = {
  position: number;
  key: string;
  stepType: PaidFunnelPackage["steps"][number]["type"];
  slug: string;
  title: string;
  seo: PaidFunnelPackage["steps"][number]["seo"];
  nextStep: string | null;
  previewState: "draft";
  publishState: "draft";
};

export type PaidFunnelInsertGraph = {
  stepKey: string;
  graphVersion: number;
  graph: PaidFunnelGraph;
};

export type PaidFunnelInstantiation = {
  name: string;
  slug: string;
  templateKey: string;
  templateVersion: string;
  source: "fixture" | "zip" | "template";
  publishAdapter: PaidFunnelPackage["publishAdapter"];
  framework: PaidFunnelPackage["framework"];
  package: PaidFunnelPackage;
  steps: PaidFunnelInsertStep[];
  graphs: PaidFunnelInsertGraph[];
};

export function instantiatePaidFunnel(
  pkg: PaidFunnelPackage,
  input: {
    name: string;
    slug: string;
    source: PaidFunnelInstantiation["source"];
  }
): PaidFunnelInstantiation {
  const graphs: PaidFunnelInsertGraph[] = [];
  if (pkg.graph) {
    for (const page of pkg.graph.pages) {
      graphs.push({
        stepKey: page.stepKey,
        graphVersion: pkg.graph.version,
        graph: {
          version: pkg.graph.version,
          pages: [page],
        },
      });
    }
  }

  return {
    name: input.name,
    slug: input.slug,
    templateKey: pkg.templateKey,
    templateVersion: pkg.version,
    source: input.source,
    publishAdapter: pkg.publishAdapter,
    framework: pkg.framework,
    package: pkg,
    steps: pkg.steps.map((step, index) => ({
      position: index,
      key: step.key,
      stepType: step.type,
      slug: step.slug,
      title: step.title,
      seo: step.seo,
      nextStep: step.nextStep ?? null,
      previewState: "draft",
      publishState: "draft",
    })),
    graphs,
  };
}
