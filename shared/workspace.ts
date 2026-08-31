import { z } from "zod";

export const FUNNEL_SHAPE_VALUES = ["A", "B", "C"] as const;
export type FunnelShape = (typeof FUNNEL_SHAPE_VALUES)[number];

export const FUNNEL_STEP_TYPE_VALUES = ["zip", "survey", "contact", "book", "thankYou"] as const;
export type FunnelStepType = (typeof FUNNEL_STEP_TYPE_VALUES)[number];

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
