import { z } from "zod";

export const SITE_PAGE_TYPE_VALUES = [
  "homepage",
  "inventory",
  "categories",
  "visitUs",
  "financing",
] as const;
export type SitePageType = (typeof SITE_PAGE_TYPE_VALUES)[number];

export const FUNNEL_SHAPE_VALUES = ["A", "B", "C"] as const;
export type FunnelShape = (typeof FUNNEL_SHAPE_VALUES)[number];

export const FUNNEL_STEP_TYPE_VALUES = ["zip", "survey", "contact", "book", "thankYou"] as const;
export type FunnelStepType = (typeof FUNNEL_STEP_TYPE_VALUES)[number];

export const HOMEPAGE_SECTION_TYPE_VALUES = [
  "hero",
  "categories",
  "visitShowroom",
  "deliveryInstall",
  "testimonials",
  "financing",
  "faq",
  "contact",
  "map",
] as const;
export type HomepageSectionType = (typeof HOMEPAGE_SECTION_TYPE_VALUES)[number];

export const SITE_PAGE_LABELS: Record<SitePageType, string> = {
  homepage: "Homepage",
  inventory: "Inventory",
  categories: "Category Pages",
  visitUs: "Visit Us",
  financing: "Financing",
};

export const DEFAULT_SITE_PAGES: Array<{
  pageType: SitePageType;
  title: string;
  slug: string;
  description: string;
}> = [
  {
    pageType: "homepage",
    title: "Homepage",
    slug: "/",
    description: "The main page customers see first.",
  },
  {
    pageType: "inventory",
    title: "Inventory",
    slug: "/inventory",
    description: "Available products and current inventory.",
  },
  {
    pageType: "categories",
    title: "Category Pages",
    slug: "/categories",
    description: "Hot tubs, swim spas, saunas, and cold plunge pages.",
  },
  {
    pageType: "visitUs",
    title: "Visit Us",
    slug: "/visit-us",
    description: "Showroom address, hours, map, and directions.",
  },
  {
    pageType: "financing",
    title: "Financing",
    slug: "/financing",
    description: "Financing options and the next step for shoppers.",
  },
];

export const HOMEPAGE_SECTION_LABELS: Record<HomepageSectionType, string> = {
  hero: "Hero",
  categories: "Categories",
  visitShowroom: "Visit Showroom",
  deliveryInstall: "Delivery / Install",
  testimonials: "Testimonials",
  financing: "Financing",
  faq: "FAQ",
  contact: "Contact",
  map: "Map",
};

export const HOMEPAGE_SECTION_DESCRIPTIONS: Record<HomepageSectionType, string> = {
  hero: "Main headline, offer, and call to action.",
  categories: "Product categories customers can browse.",
  visitShowroom: "Showroom information and a reason to visit.",
  deliveryInstall: "Delivery and installation promise.",
  testimonials: "Approved customer feedback when available.",
  financing: "Financing promise and next step.",
  faq: "Common customer questions and answers.",
  contact: "Phone, email, and contact action.",
  map: "Showroom map and directions.",
};

export const DEFAULT_HOMEPAGE_SECTIONS: Array<{
  sectionType: HomepageSectionType;
  enabled: number;
}> = [
  { sectionType: "hero", enabled: 1 },
  { sectionType: "categories", enabled: 1 },
  { sectionType: "visitShowroom", enabled: 1 },
  { sectionType: "deliveryInstall", enabled: 1 },
  { sectionType: "testimonials", enabled: 0 },
  { sectionType: "financing", enabled: 1 },
  { sectionType: "faq", enabled: 1 },
  { sectionType: "contact", enabled: 1 },
  { sectionType: "map", enabled: 1 },
];

export type FunnelStepDefinition = {
  stepType: FunnelStepType;
  title: string;
  pathSuffix: string;
  capturedFields: string[];
  trackingActions: string[];
};

export const FUNNEL_SHAPE_LABELS: Record<FunnelShape, string> = {
  A: "Shape A · Quick lead",
  B: "Shape B · Qualified lead",
  C: "Shape C · Booked call",
};

export const FUNNEL_SHAPES: Record<FunnelShape, FunnelStepDefinition[]> = {
  A: [
    {
      stepType: "zip",
      title: "ZIP",
      pathSuffix: "",
      capturedFields: ["ZIP Code"],
      trackingActions: ["PageView", "LeadStarted"],
    },
    {
      stepType: "thankYou",
      title: "Thank You",
      pathSuffix: "/thank-you",
      capturedFields: [],
      trackingActions: ["Lead"],
    },
  ],
  B: [
    {
      stepType: "zip",
      title: "ZIP",
      pathSuffix: "",
      capturedFields: ["ZIP Code"],
      trackingActions: ["PageView", "LeadStarted"],
    },
    {
      stepType: "survey",
      title: "Survey",
      pathSuffix: "/survey",
      capturedFields: ["Product Interest", "Purchase Timeframe"],
      trackingActions: ["SurveyStarted"],
    },
    {
      stepType: "contact",
      title: "Contact",
      pathSuffix: "/contact",
      capturedFields: ["First Name", "Last Name", "Email", "Phone"],
      trackingActions: ["ContactSubmitted"],
    },
    {
      stepType: "thankYou",
      title: "Thank You",
      pathSuffix: "/thank-you",
      capturedFields: [],
      trackingActions: ["Lead"],
    },
  ],
  C: [
    {
      stepType: "zip",
      title: "ZIP",
      pathSuffix: "",
      capturedFields: ["ZIP Code"],
      trackingActions: ["PageView", "LeadStarted"],
    },
    {
      stepType: "survey",
      title: "Survey",
      pathSuffix: "/survey",
      capturedFields: ["Product Interest", "Purchase Timeframe"],
      trackingActions: ["SurveyStarted"],
    },
    {
      stepType: "contact",
      title: "Contact",
      pathSuffix: "/contact",
      capturedFields: ["First Name", "Last Name", "Email", "Phone"],
      trackingActions: ["ContactSubmitted"],
    },
    {
      stepType: "book",
      title: "Book",
      pathSuffix: "/book",
      capturedFields: ["Appointment Date", "Appointment Time"],
      trackingActions: ["Schedule"],
    },
    {
      stepType: "thankYou",
      title: "Thank You",
      pathSuffix: "/thank-you",
      capturedFields: [],
      trackingActions: ["Lead", "CompleteRegistration"],
    },
  ],
};

export const DEFAULT_FUNNELS: Array<{
  name: string;
  slug: string;
  shape: FunnelShape;
}> = [
  { name: "Quick Lead", slug: "quick-lead", shape: "A" },
  { name: "Qualified Lead", slug: "qualified-lead", shape: "B" },
  { name: "Booked Call", slug: "booked-call", shape: "C" },
];

export const funnelShapeSchema = z.enum(FUNNEL_SHAPE_VALUES);
export const funnelStepTypeSchema = z.enum(FUNNEL_STEP_TYPE_VALUES);
export const sitePageTypeSchema = z.enum(SITE_PAGE_TYPE_VALUES);
export const homepageSectionTypeSchema = z.enum(HOMEPAGE_SECTION_TYPE_VALUES);

export const funnelStepUpdateSchema = z.object({
  stepId: z.number().int().positive(),
  title: z.string().trim().min(1, "Enter a step name.").max(160),
  path: z
    .string()
    .trim()
    .min(1, "Enter a page path.")
    .max(500)
    .regex(/^\/[a-z0-9/_-]*$/i, "Use a path that starts with / and contains no spaces."),
  capturedFields: z.array(z.string().trim().min(1).max(80)).max(20),
  trackingActions: z.array(z.string().trim().min(1).max(80)).max(20),
});

export const sectionOrderSchema = z
  .array(
    z.object({
      id: z.number().int().positive(),
      sectionType: homepageSectionTypeSchema,
      enabled: z.boolean(),
    }),
  )
  .length(DEFAULT_HOMEPAGE_SECTIONS.length)
  .superRefine((sections, context) => {
    const ids = new Set(sections.map(section => section.id));
    const types = new Set(sections.map(section => section.sectionType));
    if (ids.size !== sections.length || types.size !== sections.length) {
      context.addIssue({ code: "custom", message: "Each homepage section must appear once." });
    }
  });
