import { z } from "zod";
import { simpleFormOfflineConversionContractSchema } from "./simpleFormContract";
import {
  PAID_FUNNEL_SECTION_PRESETS,
  collectGraphElementTypes,
  paidFunnelGraphSchema,
  type PaidFunnelGraph,
} from "./paidFunnelGraph";

export const PAID_FUNNEL_SCHEMA_VERSION = 1 as const;
export const PAID_FUNNEL_KIND = "paid-funnel" as const;
export const GENERIC_PAID_FUNNEL_TEMPLATE_KEY = "generic-paid-funnel" as const;

export const PAID_FUNNEL_FRAMEWORKS = [
  "static-html",
  "astro",
  "unknown",
] as const;
export type PaidFunnelFramework = (typeof PAID_FUNNEL_FRAMEWORKS)[number];

export const PAID_FUNNEL_STEP_TYPES = [
  "landing",
  "form",
  "thankYou",
  "booking",
  "upsell",
  "custom",
] as const;
export type PaidFunnelStepType = (typeof PAID_FUNNEL_STEP_TYPES)[number];

export const PAID_FUNNEL_LEAD_STEP_TYPES = ["form", "landing"] as const;

export const PAID_FUNNEL_PUBLISH_ADAPTERS = [
  "generic-paid-funnel",
  "legacy-simple-form",
] as const;
export type PaidFunnelPublishAdapter =
  (typeof PAID_FUNNEL_PUBLISH_ADAPTERS)[number];

export const paidFunnelOfflineConversionContractSchema =
  simpleFormOfflineConversionContractSchema;
export type PaidFunnelOfflineConversionContract = z.infer<
  typeof paidFunnelOfflineConversionContractSchema
>;

const slugSchema = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    "Use lowercase letters, numbers, and hyphens only."
  );

export const paidFunnelSeoSchema = z
  .object({
    title: z.string().trim().min(1).max(160).optional(),
    description: z.string().trim().max(500).optional(),
    ogImage: z.string().trim().max(500).optional(),
  })
  .strict();

export const paidFunnelStepSchema = z
  .object({
    key: z.string().trim().min(1).max(80),
    type: z.enum(PAID_FUNNEL_STEP_TYPES),
    slug: slugSchema,
    title: z.string().trim().min(1).max(160),
    seo: paidFunnelSeoSchema.default({}),
    nextStep: z.string().trim().min(1).max(80).nullable().optional(),
  })
  .strict();
export type PaidFunnelStep = z.infer<typeof paidFunnelStepSchema>;

export const paidFunnelImmutableRegionSchema = z
  .object({
    id: z.string().trim().min(1).max(120),
    path: z.string().trim().min(1).max(400),
    reason: z.string().trim().min(1).max(400),
  })
  .strict();

export const paidFunnelEditableSlotSchema = z
  .object({
    id: z.string().trim().min(1).max(120),
    path: z.string().trim().min(1).max(400),
    label: z.string().trim().min(1).max(160),
  })
  .strict();

export const paidFunnelSectionPresetDefinitionSchema = z
  .object({
    key: z.enum(PAID_FUNNEL_SECTION_PRESETS),
    name: z.string().trim().min(1).max(80),
    description: z.string().trim().max(240).optional(),
  })
  .strict();

export const paidFunnelAssetRefSchema = z
  .object({
    key: z.string().trim().min(1).max(80),
    path: z.string().trim().min(1).max(400),
    mimeType: z.string().trim().max(120).optional(),
  })
  .strict();

export const paidFunnelIntegrationSchema = z
  .object({
    key: z.string().trim().min(1).max(80),
    kind: z.enum(["ghl", "sheets", "meta", "consent", "custom"]),
  })
  .strict();

export const paidFunnelReadinessRuleSchema = z
  .object({
    id: z.string().trim().min(1).max(80),
    description: z.string().trim().min(1).max(240),
    check: z.enum([
      "step-complete",
      "form-mapping",
      "navigation-target",
      "integration",
      "tracking",
      "runtime-secret-presence",
      "package",
      "build",
      "adapter",
    ]),
  })
  .strict();

export const paidFunnelResourceSchema = z
  .object({
    type: z.string().trim().min(1).max(80),
    name: z.string().trim().min(1).max(120),
    binding: z.string().trim().min(1).max(80).optional(),
  })
  .strict();

export const paidFunnelUnsupportedRegionErrorSchema = z
  .object({
    path: z.string().trim().min(1).max(400),
    reason: z.string().trim().min(1).max(400),
  })
  .strict();
export type PaidFunnelUnsupportedRegionError = z.infer<
  typeof paidFunnelUnsupportedRegionErrorSchema
>;

const secretNameSchema = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .regex(/^[A-Z][A-Z0-9_]*$/, "Runtime secret names only; never values.");

export const paidFunnelPackageSchema = z
  .object({
    schemaVersion: z.literal(PAID_FUNNEL_SCHEMA_VERSION),
    templateKey: z.string().trim().min(1).max(80),
    name: z.string().trim().min(1).max(160),
    version: z.string().trim().min(1).max(40),
    kind: z.literal(PAID_FUNNEL_KIND),
    framework: z.enum(PAID_FUNNEL_FRAMEWORKS),
    steps: z.array(paidFunnelStepSchema).min(1).max(20),
    previewEntry: z.string().trim().min(1).max(400),
    graph: paidFunnelGraphSchema.optional(),
    immutableRegions: z
      .array(paidFunnelImmutableRegionSchema)
      .max(200)
      .optional(),
    editableSlots: z.array(paidFunnelEditableSlotSchema).max(200).optional(),
    sectionPresets: z
      .array(paidFunnelSectionPresetDefinitionSchema)
      .min(1)
      .max(20),
    assets: z.array(paidFunnelAssetRefSchema).max(200).default([]),
    configSchema: z.record(z.string(), z.unknown()).default({}),
    defaults: z.record(z.string(), z.unknown()).default({}),
    integrations: z.array(paidFunnelIntegrationSchema).max(20).default([]),
    requiredRuntimeSecrets: z.array(secretNameSchema).max(40).default([]),
    readinessRules: z.array(paidFunnelReadinessRuleSchema).min(1).max(40),
    build: z
      .object({
        command: z.string().trim().min(1).max(240),
        outputDir: z.string().trim().min(1).max(240),
      })
      .strict(),
    publishAdapter: z.enum(PAID_FUNNEL_PUBLISH_ADAPTERS),
    resources: z.array(paidFunnelResourceSchema).max(40).default([]),
    offlineConversionContract:
      paidFunnelOfflineConversionContractSchema.optional(),
  })
  .strict()
  .superRefine((pkg, context) => {
    const stepKeys = pkg.steps.map(step => step.key);
    if (new Set(stepKeys).size !== stepKeys.length) {
      context.addIssue({
        code: "custom",
        path: ["steps"],
        message: "Step keys must be unique.",
      });
    }
    const slugs = pkg.steps.map(step => step.slug);
    if (new Set(slugs).size !== slugs.length) {
      context.addIssue({
        code: "custom",
        path: ["steps"],
        message: "Step slugs must be unique.",
      });
    }
    for (const [index, step] of pkg.steps.entries()) {
      if (step.nextStep && !stepKeys.includes(step.nextStep)) {
        context.addIssue({
          code: "custom",
          path: ["steps", index, "nextStep"],
          message: `Unknown next step "${step.nextStep}".`,
        });
      }
    }

    const hasGraph = pkg.graph !== undefined;
    const hasSlots =
      (pkg.immutableRegions?.length ?? 0) > 0 ||
      (pkg.editableSlots?.length ?? 0) > 0;
    if (!hasGraph && !hasSlots) {
      context.addIssue({
        code: "custom",
        path: ["graph"],
        message:
          "Package must include a visual graph or immutableRegions + editableSlots.",
      });
    }

    if (pkg.graph) {
      const pageStepKeys = new Set(pkg.graph.pages.map(page => page.stepKey));
      for (const [index, step] of pkg.steps.entries()) {
        if (!pageStepKeys.has(step.key)) {
          context.addIssue({
            code: "custom",
            path: ["steps", index, "key"],
            message: `Graph is missing a page for step "${step.key}".`,
          });
        }
      }
    }

    const needsOfflineContract =
      pkg.steps.some(step =>
        (PAID_FUNNEL_LEAD_STEP_TYPES as readonly string[]).includes(step.type)
      ) ||
      (pkg.graph ? collectGraphElementTypes(pkg.graph).has("form") : false);
    if (needsOfflineContract && !pkg.offlineConversionContract) {
      context.addIssue({
        code: "custom",
        path: ["offlineConversionContract"],
        message:
          "offlineConversionContract must be present for any form/lead step.",
      });
    }
  });
export type PaidFunnelPackage = z.infer<typeof paidFunnelPackageSchema>;

export function parsePaidFunnelPackage(input: unknown): PaidFunnelPackage {
  return paidFunnelPackageSchema.parse(input);
}

export function packageHasLeadStep(pkg: PaidFunnelPackage): boolean {
  if (
    pkg.steps.some(step =>
      (PAID_FUNNEL_LEAD_STEP_TYPES as readonly string[]).includes(step.type)
    )
  ) {
    return true;
  }
  return pkg.graph ? collectGraphElementTypes(pkg.graph).has("form") : false;
}

export function assertNoSecretValues(pkg: PaidFunnelPackage): void {
  const serialized = JSON.stringify(pkg);
  for (const name of pkg.requiredRuntimeSecrets) {
    const assignment = new RegExp(`${name}\\s*[:=]\\s*[^\\s"]+`);
    if (assignment.test(serialized)) {
      throw new Error("Runtime secret values must never be stored.");
    }
  }
}

export type PaidFunnelPackageIntake =
  | {
      status: "ready";
      pkg: PaidFunnelPackage;
      unsupportedRegions: [];
    }
  | {
      status: "draft";
      pkg: PaidFunnelPackage | null;
      unsupportedRegions: PaidFunnelUnsupportedRegionError[];
    };

export function graphStepKeys(graph: PaidFunnelGraph): string[] {
  return graph.pages.map(page => page.stepKey);
}
