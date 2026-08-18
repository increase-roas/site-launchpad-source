import { z } from "zod";
import {
  SIMPLE_FORM_OFFLINE_CONVERSION_CONTRACT,
  simpleFormOfflineConversionContractSchema,
} from "../simpleFormContract";

export const PAID_FUNNEL_PACKAGE_SCHEMA_VERSION = 1 as const;
export const PAID_FUNNEL_KIND = "paid-funnel" as const;

export const paidFunnelFrameworkValues = [
  "static-html",
  "astro",
  "unknown",
] as const;
export type PaidFunnelFramework = (typeof paidFunnelFrameworkValues)[number];

export const paidFunnelPublishAdapterValues = [
  "generic-paid-funnel",
  "legacy-simple-form",
] as const;
export type PaidFunnelPublishAdapter =
  (typeof paidFunnelPublishAdapterValues)[number];

export const paidFunnelStepTypeValues = [
  "landing",
  "form",
  "thank-you",
  "booking",
  "upsell",
] as const;

export const paidFunnelSectionPresetValues = [
  "blank",
  "full-width",
  "boxed",
  "hero",
  "two-column",
  "three-column",
  "form",
  "testimonial",
  "faq",
  "cta",
  "pricing",
  "footer",
] as const;
export type PaidFunnelSectionPreset =
  (typeof paidFunnelSectionPresetValues)[number];

const kebabKey = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const pixelId = /^\d{8,20}$/;

export const paidFunnelSeoSchema = z.object({
  title: z.string().trim().min(1).max(180),
  description: z.string().trim().min(1).max(400).optional(),
  shareImage: z.string().trim().min(1).max(500).optional(),
});

export const paidFunnelFormFieldBindingSchema = z.object({
  leadField: z.string().trim().min(1).max(80),
  formField: z.string().trim().min(1).max(80),
});

export const paidFunnelFormMappingSchema = z.object({
  joinKey: z.literal("leadUuid"),
  fieldBindings: z.array(paidFunnelFormFieldBindingSchema).min(1),
});

export const paidFunnelStepSchema = z
  .object({
    key: z
      .string()
      .trim()
      .regex(kebabKey, "Use lowercase letters, numbers, and hyphens."),
    type: z
      .string()
      .trim()
      .min(1)
      .max(40)
      .regex(kebabKey, "Step type must be lowercase kebab-case."),
    slug: z
      .string()
      .trim()
      .regex(kebabKey, "Use lowercase letters, numbers, and hyphens."),
    title: z.string().trim().min(1).max(160),
    seo: paidFunnelSeoSchema.optional(),
    nextStep: z.string().trim().regex(kebabKey).nullable().optional(),
    formMapping: paidFunnelFormMappingSchema.optional(),
  })
  .strict();

export const paidFunnelGraphNodeSchema = z.object({
  id: z.string().trim().min(1).max(80),
  kind: z.enum(["page", "section", "row", "column", "element"]),
});

export const paidFunnelGraphSchema = z.object({
  version: z.number().int().positive(),
  nodes: z.array(paidFunnelGraphNodeSchema).min(1),
});

export const paidFunnelResourcesSchema = z
  .object({
    kvNamespaces: z
      .array(z.object({ binding: z.string().trim().min(1).max(80) }))
      .optional(),
    d1Databases: z
      .array(
        z.object({
          binding: z.string().trim().min(1).max(80),
          databaseName: z.string().trim().min(1).max(80),
        })
      )
      .optional(),
    queues: z
      .object({
        producers: z
          .array(
            z.object({
              binding: z.string().trim().min(1).max(80),
              queue: z.string().trim().min(1).max(80),
            })
          )
          .optional(),
        consumers: z
          .array(
            z.object({
              queue: z.string().trim().min(1).max(80),
              deadLetterQueue: z.string().trim().min(1).max(80).optional(),
            })
          )
          .optional(),
      })
      .optional(),
    assets: z
      .array(z.object({ binding: z.string().trim().min(1).max(80) }))
      .optional(),
  })
  .strict();

export const paidFunnelBuildSchema = z.object({
  command: z.string().max(240),
  outputDir: z.string().max(240),
});

export const paidFunnelIntegrationsSchema = z
  .object({
    ghl: z.boolean().optional(),
    googleSheets: z.boolean().optional(),
    meta: z.boolean().optional(),
  })
  .strict();

export const paidFunnelReadinessRulesSchema = z
  .object({
    requireOfflineConversionContract: z.literal(true),
    requireConsent: z.literal(true),
    requireTrackingPreservation: z.literal(true),
  })
  .strict();

export function isFormOrLeadStep(step: { type: string }): boolean {
  return step.type === "form" || step.type === "lead";
}

export const paidFunnelPackageSchema = z
  .object({
    schemaVersion: z.literal(PAID_FUNNEL_PACKAGE_SCHEMA_VERSION),
    templateKey: z
      .string()
      .trim()
      .regex(kebabKey, "Use lowercase letters, numbers, and hyphens."),
    name: z.string().trim().min(1).max(160),
    version: z.string().trim().min(1).max(40),
    kind: z.literal(PAID_FUNNEL_KIND),
    framework: z.enum(paidFunnelFrameworkValues),
    steps: z.array(paidFunnelStepSchema).min(1),
    previewEntry: z.string().trim().min(1).max(240),
    graph: paidFunnelGraphSchema.optional(),
    immutableRegions: z.array(z.string().trim().min(1)).optional(),
    editableSlots: z.array(z.string().trim().min(1)).optional(),
    sectionPresets: z.array(z.enum(paidFunnelSectionPresetValues)).min(1),
    assets: z.array(z.string().trim().min(1)).default([]),
    configSchema: z.record(z.string(), z.unknown()).default({}),
    defaults: z.record(z.string(), z.unknown()).default({}),
    integrations: paidFunnelIntegrationsSchema,
    requiredRuntimeSecrets: z.array(z.string().trim().min(1)).min(1),
    readinessRules: paidFunnelReadinessRulesSchema,
    build: paidFunnelBuildSchema,
    publishAdapter: z.enum(paidFunnelPublishAdapterValues),
    resources: paidFunnelResourcesSchema.optional(),
    offlineConversionContract: simpleFormOfflineConversionContractSchema,
  })
  .strict()
  .superRefine((pkg, context) => {
    const hasGraph = pkg.graph != null;
    const hasSlots =
      (pkg.immutableRegions?.length ?? 0) > 0 &&
      (pkg.editableSlots?.length ?? 0) > 0;
    if (!hasGraph && !hasSlots) {
      context.addIssue({
        code: "custom",
        message:
          "Package must declare a visual graph or immutableRegions + editableSlots.",
        path: ["graph"],
      });
    }

    const keys = pkg.steps.map(step => step.key);
    if (new Set(keys).size !== keys.length) {
      context.addIssue({
        code: "custom",
        message: "Every funnel step key must be unique.",
        path: ["steps"],
      });
    }

    const slugs = pkg.steps.map(step => step.slug);
    if (new Set(slugs).size !== slugs.length) {
      context.addIssue({
        code: "custom",
        message: "Every funnel step slug must be unique.",
        path: ["steps"],
      });
    }

    if (!pkg.steps.some(isFormOrLeadStep)) {
      context.addIssue({
        code: "custom",
        message: "A paid funnel must include at least one form or lead step.",
        path: ["steps"],
      });
    }
  });

export type PaidFunnelPackage = z.infer<typeof paidFunnelPackageSchema>;
export type PaidFunnelStep = z.infer<typeof paidFunnelStepSchema>;
export type PaidFunnelResources = z.infer<typeof paidFunnelResourcesSchema>;
export type PaidFunnelFormMapping = z.infer<typeof paidFunnelFormMappingSchema>;

export const paidFunnelStepStateSchema = z.object({
  stepKey: z.string().trim().min(1),
  previewReady: z.boolean(),
  publishReady: z.boolean(),
  published: z.boolean(),
});
export type PaidFunnelStepState = z.infer<typeof paidFunnelStepStateSchema>;

export const paidFunnelPublishSettingsSchema = z
  .object({
    audience: z.literal("qa"),
    clientKey: z.string().trim().min(1).max(80),
    templateKey: z.string().trim().min(1).max(80),
    domain: z.string().trim().min(1).max(253),
    path: z
      .string()
      .trim()
      .regex(/^\/[A-Za-z0-9/_-]*$/, "Path must start with /."),
    tracking: z.object({
      preserveUtm: z.boolean(),
      preserveClickIds: z.boolean(),
      metaPixelId: z.string().trim().nullable(),
      metaCapiPresent: z.boolean(),
    }),
    integrations: z.object({
      ghlLocationId: z.string().trim().nullable(),
      googleSheetsId: z.string().trim().nullable(),
    }),
    consent: z.object({
      version: z.string().trim().min(1).max(40),
      text: z.string().trim().min(40).max(700),
    }),
    navigationTargets: z.array(z.string().trim().min(1)).default([]),
    secretPresence: z.record(z.string(), z.boolean()),
    stepStates: z.array(paidFunnelStepStateSchema).min(1),
  })
  .strict();
export type PaidFunnelPublishSettings = z.infer<
  typeof paidFunnelPublishSettingsSchema
>;

export const REQUIRED_FORM_LEAD_FIELDS = [
  "email",
  "phone",
  "consent",
] as const;

export function isSunPoolName(value: string): boolean {
  return /sun[\s_-]*pool/i.test(value);
}

export function parsePaidFunnelPackage(input: unknown) {
  return paidFunnelPackageSchema.safeParse(input);
}

export function parsePaidFunnelPublishSettings(input: unknown) {
  return paidFunnelPublishSettingsSchema.safeParse(input);
}

export function emptyPaidFunnelResources(): PaidFunnelResources {
  return {};
}

export function declaredPaidFunnelResources(
  pkg: PaidFunnelPackage
): PaidFunnelResources {
  return pkg.resources ?? emptyPaidFunnelResources();
}

export function isValidMetaPixelId(value: string | null | undefined): boolean {
  return pixelId.test(value?.trim() ?? "");
}

const CANONICAL_FORM_MAPPING: PaidFunnelFormMapping = {
  joinKey: "leadUuid",
  fieldBindings: [
    { leadField: "email", formField: "email" },
    { leadField: "phone", formField: "phone" },
    { leadField: "consent", formField: "consent" },
    { leadField: "firstName", formField: "first-name" },
    { leadField: "lastName", formField: "last-name" },
  ],
};

export function buildGenericPaidFunnelPackageFixture(
  overrides: Partial<PaidFunnelPackage> = {}
): PaidFunnelPackage {
  const fixture: PaidFunnelPackage = {
    schemaVersion: 1,
    templateKey: "qa-generic-paid-funnel",
    name: "Generic Paid Ads Funnel",
    version: "1.0.0",
    kind: "paid-funnel",
    framework: "static-html",
    steps: [
      {
        key: "landing",
        type: "landing",
        slug: "offer",
        title: "Landing",
        seo: { title: "Local offer" },
        nextStep: "form",
      },
      {
        key: "form",
        type: "form",
        slug: "contact",
        title: "Form",
        seo: { title: "Contact" },
        nextStep: "thank-you",
        formMapping: CANONICAL_FORM_MAPPING,
      },
      {
        key: "thank-you",
        type: "thank-you",
        slug: "thank-you",
        title: "Thank You",
        seo: { title: "Thank you" },
        nextStep: "booking",
      },
      {
        key: "booking",
        type: "booking",
        slug: "book",
        title: "Booking",
        seo: { title: "Book a visit" },
        nextStep: "upsell",
      },
      {
        key: "upsell",
        type: "upsell",
        slug: "upgrade",
        title: "Upsell",
        seo: { title: "Upgrade" },
        nextStep: null,
      },
    ],
    previewEntry: "/offer",
    graph: {
      version: 1,
      nodes: [
        { id: "page-landing", kind: "page" },
        { id: "section-hero", kind: "section" },
        { id: "row-hero", kind: "row" },
        { id: "col-hero", kind: "column" },
        { id: "el-headline", kind: "element" },
      ],
    },
    sectionPresets: ["hero", "form", "testimonial", "faq", "cta", "footer"],
    assets: [],
    configSchema: {},
    defaults: {},
    integrations: {
      ghl: true,
      googleSheets: true,
      meta: true,
    },
    requiredRuntimeSecrets: [
      ...SIMPLE_FORM_OFFLINE_CONVERSION_CONTRACT.requiredRuntimeSecrets,
    ],
    readinessRules: {
      requireOfflineConversionContract: true,
      requireConsent: true,
      requireTrackingPreservation: true,
    },
    build: {
      command: "astro build",
      outputDir: "dist",
    },
    publishAdapter: "generic-paid-funnel",
    offlineConversionContract: SIMPLE_FORM_OFFLINE_CONVERSION_CONTRACT,
  };
  return paidFunnelPackageSchema.parse({ ...fixture, ...overrides });
}

export function buildGenericPaidFunnelSettingsFixture(
  pkg: PaidFunnelPackage = buildGenericPaidFunnelPackageFixture()
): PaidFunnelPublishSettings {
  const secretPresence = Object.fromEntries(
    pkg.requiredRuntimeSecrets.map(name => [name, true])
  );
  return paidFunnelPublishSettingsSchema.parse({
    audience: "qa",
    clientKey: "qa-client",
    templateKey: pkg.templateKey,
    domain: "qa-generic-funnel.example",
    path: "/offer",
    tracking: {
      preserveUtm: true,
      preserveClickIds: true,
      metaPixelId: "123456789012345",
      metaCapiPresent: true,
    },
    integrations: {
      ghlLocationId: "location-123",
      googleSheetsId: "sheet-123",
    },
    consent: {
      version: "2026-08-18",
      text: "I agree to receive calls and text messages about this request at the number provided. Consent is not a condition of purchase.",
    },
    navigationTargets: pkg.steps
      .map(step => step.nextStep)
      .filter((value): value is string => Boolean(value)),
    secretPresence,
    stepStates: pkg.steps.map(step => ({
      stepKey: step.key,
      previewReady: true,
      publishReady: true,
      published: false,
    })),
  });
}
