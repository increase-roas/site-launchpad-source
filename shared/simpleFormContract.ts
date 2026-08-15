import { z } from "zod";

export const SIMPLE_FORM_TEMPLATE_KEY = "simple-form" as const;

export const SIMPLE_FORM_MANIFEST = {
  schemaVersion: 1,
  contractVersion: 1,
  templateKey: SIMPLE_FORM_TEMPLATE_KEY,
  name: "Simple Form Funnel",
  repo: "increase-roas/paid-funnel-simple-form-funnel",
  defaultBranch: "main",
  type: "paid-funnel",
  shape: "A",
  active: true,
} as const;

export const simpleFormManifestSchema = z.object({
  schemaVersion: z.literal(1),
  contractVersion: z.literal(1),
  templateKey: z.literal(SIMPLE_FORM_TEMPLATE_KEY),
  name: z.string().min(1),
  repo: z.string().min(1),
  defaultBranch: z.string().min(1),
  type: z.literal("paid-funnel"),
  shape: z.literal("A"),
  active: z.literal(true),
});

export const SIMPLE_FORM_RUNTIME_SECRET_KEYS = [
  "META_CAPI_ACCESS_TOKEN",
  "META_TEST_EVENT_CODE",
  "GHL_WEBHOOK_URL",
  "CRM_CALLBACK_SECRET",
  "SUBMISSION_ALERT_WEBHOOK_URL",
] as const;
export type SimpleFormRuntimeSecretKey = (typeof SIMPLE_FORM_RUNTIME_SECRET_KEYS)[number];

export const SIMPLE_FORM_CLOUDFLARE_VARS = ["ENVIRONMENT", "META_GRAPH_API_VERSION"] as const;
export const SIMPLE_FORM_CLOUDFLARE_BINDINGS = [
  "ASSETS",
  "FUNNEL_SESSIONS",
  "FUNNEL_DB",
  "CAPI_RETRY_QUEUE",
] as const;

export const SIMPLE_FORM_CLOUDFLARE_INFRA = {
  vars: {
    ENVIRONMENT: "production",
    META_GRAPH_API_VERSION: "v26.0",
  },
  bindings: [...SIMPLE_FORM_CLOUDFLARE_BINDINGS],
  kvNamespaces: [{ binding: "FUNNEL_SESSIONS" }],
  d1Databases: [{ binding: "FUNNEL_DB", databaseName: "paid-funnel-events" }],
  queues: {
    producers: [{ binding: "CAPI_RETRY_QUEUE", queue: "paid-funnel-capi-retries" }],
    consumers: [{ queue: "paid-funnel-capi-retries", deadLetterQueue: "paid-funnel-capi-dead-letter" }],
  },
} as const;

export type SecretRequirement = "required" | "optional" | "testing-only" | "generated";

export type SimpleFormSecretGuide = {
  runtimeKey: SimpleFormRuntimeSecretKey;
  friendlyName: string;
  requirement: SecretRequirement;
  requiredFor: string;
  whereToFind: string;
  docsUrl: string;
};

export const SIMPLE_FORM_SECRET_GUIDES: SimpleFormSecretGuide[] = [
  {
    runtimeKey: "META_CAPI_ACCESS_TOKEN",
    friendlyName: "Meta CAPI Access Token",
    requirement: "required",
    requiredFor: "Server-side Meta conversion tracking",
    whereToFind:
      "Open Meta Events Manager, select the client Pixel, then generate a Conversions API access token.",
    docsUrl: "https://developers.facebook.com/docs/marketing-api/conversions-api/get-started",
  },
  {
    runtimeKey: "META_TEST_EVENT_CODE",
    friendlyName: "Meta Test Event Code",
    requirement: "testing-only",
    requiredFor: "Sending events into Events Manager test mode during smoke tests",
    whereToFind:
      "Events Manager → Test events. Remove this before production. Configuration ready fails if it stays set.",
    docsUrl: "https://developers.facebook.com/docs/marketing-api/conversions-api/using-the-api",
  },
  {
    runtimeKey: "GHL_WEBHOOK_URL",
    friendlyName: "GoHighLevel Inbound Webhook",
    requirement: "required",
    requiredFor: "Creating or updating the lead in GoHighLevel",
    whereToFind:
      "In the client GHL location, open Automation → Workflows, add an Inbound Webhook trigger, and copy the URL.",
    docsUrl: "https://help.gohighlevel.com/support/solutions/articles/48001181454-workflow-trigger-inbound-webhook",
  },
  {
    runtimeKey: "CRM_CALLBACK_SECRET",
    friendlyName: "CRM Callback Secret",
    requirement: "generated",
    requiredFor: "Bearer auth on POST /api/funnel/{slug}/conversion for appointment, show, and sale",
    whereToFind: "Launchpad generates this per funnel. Use Show once to copy it into the GHL callback workflow.",
    docsUrl: "https://developers.cloudflare.com/workers/configuration/secrets/",
  },
  {
    runtimeKey: "SUBMISSION_ALERT_WEBHOOK_URL",
    friendlyName: "Submission Alert Webhook",
    requirement: "optional",
    requiredFor: "Operational alert when GHL delivery fails",
    whereToFind: "Use a Slack incoming webhook or similar HTTPS endpoint.",
    docsUrl: "https://api.slack.com/messaging/webhooks",
  },
];

export const SIMPLE_FORM_PREVIEW = {
  flow: "ZIP → Contact → Thank You",
  inventory: "5 Inventory Slots",
  imageUrl: "/templates/simple-form-preview.svg",
} as const;

export const SIMPLE_FORM_STEPS = [
  {
    stepType: "zip" as const,
    title: "ZIP",
    pathSuffix: "/step/1",
    capturedFields: ["ZIP Code"],
    trackingActions: ["PageView", "LeadStarted"],
  },
  {
    stepType: "contact" as const,
    title: "Contact",
    pathSuffix: "/step/2",
    capturedFields: ["First Name", "Last Name", "Email", "Phone", "Consent"],
    trackingActions: ["ContactSubmitted"],
  },
  {
    stepType: "thankYou" as const,
    title: "Thank You",
    pathSuffix: "/thank-you",
    capturedFields: [],
    trackingActions: ["Lead"],
  },
];

export const SIMPLE_FORM_SECRET_COLUMN = {
  META_CAPI_ACCESS_TOKEN: "metaCapiAccessTokenEncrypted",
  META_TEST_EVENT_CODE: "metaTestEventCodeEncrypted",
  GHL_WEBHOOK_URL: "ghlWebhookUrlEncrypted",
  CRM_CALLBACK_SECRET: "crmCallbackSecretEncrypted",
  SUBMISSION_ALERT_WEBHOOK_URL: "submissionAlertWebhookUrlEncrypted",
} as const;
