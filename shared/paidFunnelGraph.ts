import { z } from "zod";

export const PAID_FUNNEL_GRAPH_VERSION = 1 as const;

export const PAID_FUNNEL_ELEMENT_TYPES = [
  "heading",
  "text",
  "image",
  "button",
  "icon",
  "video",
  "spacer",
  "divider",
  "list",
  "form",
  "phoneCta",
  "countdown",
  "testimonial",
  "faq",
  "inventory",
  "map",
  "html",
] as const;
export type PaidFunnelElementType = (typeof PAID_FUNNEL_ELEMENT_TYPES)[number];

export const PAID_FUNNEL_SECTION_PRESETS = [
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
  (typeof PAID_FUNNEL_SECTION_PRESETS)[number];

export const PAID_FUNNEL_BUTTON_ACTIONS = [
  "next-step",
  "url",
  "phone",
  "form-submit",
  "booking",
] as const;
export type PaidFunnelButtonAction =
  (typeof PAID_FUNNEL_BUTTON_ACTIONS)[number];

const stableIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(120)
  .regex(
    /^[a-zA-Z][a-zA-Z0-9_-]*$/,
    "Stable IDs must start with a letter and use letters, numbers, underscores, or hyphens."
  );

const styleTokensSchema = z
  .object({
    background: z.string().max(240).optional(),
    color: z.string().max(80).optional(),
    padding: z.string().max(80).optional(),
    margin: z.string().max(80).optional(),
    maxWidth: z.string().max(40).optional(),
    minHeight: z.string().max(40).optional(),
    alignment: z.enum(["start", "center", "end", "stretch"]).optional(),
    hiddenOn: z.array(z.enum(["desktop", "tablet", "mobile"])).optional(),
  })
  .strict();

export const paidFunnelElementSchema = z
  .object({
    id: stableIdSchema,
    type: z.enum(PAID_FUNNEL_ELEMENT_TYPES),
    props: z.record(z.string(), z.unknown()).default({}),
    styles: styleTokensSchema.optional(),
  })
  .strict();
export type PaidFunnelElement = z.infer<typeof paidFunnelElementSchema>;

export const paidFunnelColumnSchema = z
  .object({
    id: stableIdSchema,
    width: z
      .object({
        desktop: z.number().int().min(1).max(12),
        tablet: z.number().int().min(1).max(12).optional(),
        mobile: z.number().int().min(1).max(12).optional(),
      })
      .strict(),
    styles: styleTokensSchema.optional(),
    elements: z.array(paidFunnelElementSchema).max(100),
  })
  .strict();
export type PaidFunnelColumn = z.infer<typeof paidFunnelColumnSchema>;

export const paidFunnelRowSchema = z
  .object({
    id: stableIdSchema,
    gap: z.string().max(40).optional(),
    valign: z.enum(["start", "center", "end", "stretch"]).optional(),
    wrap: z.boolean().optional(),
    styles: styleTokensSchema.optional(),
    columns: z.array(paidFunnelColumnSchema).min(1).max(12),
  })
  .strict();
export type PaidFunnelRow = z.infer<typeof paidFunnelRowSchema>;

export const paidFunnelSectionSchema = z
  .object({
    id: stableIdSchema,
    preset: z.enum(PAID_FUNNEL_SECTION_PRESETS),
    styles: styleTokensSchema.optional(),
    rows: z.array(paidFunnelRowSchema).max(50),
  })
  .strict();
export type PaidFunnelSection = z.infer<typeof paidFunnelSectionSchema>;

export const paidFunnelPageSchema = z
  .object({
    id: stableIdSchema,
    stepKey: z.string().trim().min(1).max(80),
    sections: z.array(paidFunnelSectionSchema).max(50),
  })
  .strict();
export type PaidFunnelPage = z.infer<typeof paidFunnelPageSchema>;

export const paidFunnelGraphSchema = z
  .object({
    version: z.literal(PAID_FUNNEL_GRAPH_VERSION),
    pages: z.array(paidFunnelPageSchema).min(1).max(30),
  })
  .strict()
  .superRefine((graph, context) => {
    const seen = new Set<string>();
    const walk = (id: string, path: Array<string | number>) => {
      if (seen.has(id)) {
        context.addIssue({
          code: "custom",
          path,
          message: `Duplicate stable id "${id}".`,
        });
        return;
      }
      seen.add(id);
    };

    graph.pages.forEach((page, pageIndex) => {
      walk(page.id, ["pages", pageIndex, "id"]);
      page.sections.forEach((section, sectionIndex) => {
        walk(section.id, ["pages", pageIndex, "sections", sectionIndex, "id"]);
        section.rows.forEach((row, rowIndex) => {
          walk(row.id, [
            "pages",
            pageIndex,
            "sections",
            sectionIndex,
            "rows",
            rowIndex,
            "id",
          ]);
          row.columns.forEach((column, columnIndex) => {
            walk(column.id, [
              "pages",
              pageIndex,
              "sections",
              sectionIndex,
              "rows",
              rowIndex,
              "columns",
              columnIndex,
              "id",
            ]);
            column.elements.forEach((element, elementIndex) => {
              walk(element.id, [
                "pages",
                pageIndex,
                "sections",
                sectionIndex,
                "rows",
                rowIndex,
                "columns",
                columnIndex,
                "elements",
                elementIndex,
                "id",
              ]);
            });
          });
        });
      });
    });
  });
export type PaidFunnelGraph = z.infer<typeof paidFunnelGraphSchema>;

export function collectGraphElementTypes(
  graph: PaidFunnelGraph
): Set<PaidFunnelElementType> {
  const types = new Set<PaidFunnelElementType>();
  for (const page of graph.pages) {
    for (const section of page.sections) {
      for (const row of section.rows) {
        for (const column of row.columns) {
          for (const element of column.elements) {
            types.add(element.type);
          }
        }
      }
    }
  }
  return types;
}

export function migratePaidFunnelGraph(input: unknown): PaidFunnelGraph {
  if (!input || typeof input !== "object") {
    throw new Error("Paid funnel graph is missing.");
  }
  const record = input as { version?: unknown };
  const version = typeof record.version === "number" ? record.version : 0;
  if (version === 0) {
    return paidFunnelGraphSchema.parse({
      ...(input as Record<string, unknown>),
      version: PAID_FUNNEL_GRAPH_VERSION,
    });
  }
  if (version === PAID_FUNNEL_GRAPH_VERSION) {
    return paidFunnelGraphSchema.parse(input);
  }
  throw new Error(`Unsupported paid funnel graph version ${String(version)}.`);
}
