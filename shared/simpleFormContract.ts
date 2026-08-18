import { z } from "zod";
import simpleFormManifestJson from "../server/templates/simple-form/launchpad.template.json";

export const SIMPLE_FORM_TEMPLATE_KEY = "simple-form" as const;

export const simpleFormOfflineConversionContractSchema = z.strictObject({
  version: z.literal(1),
  joinKey: z.literal("leadUuid"),
  callback: z.strictObject({
    method: z.literal("POST"),
    route: z.literal("/api/lead-stage"),
    authentication: z.literal("Bearer STAGE_WEBHOOK_SECRET"),
  }),
  stageMappings: z.tuple([
    z.strictObject({
      pipelineStage: z.literal("Hot Pursuit"),
      callbackStage: z.literal("qualified"),
      metaEvent: z.literal("QualifiedLead"),
    }),
    z.strictObject({
      pipelineStage: z.literal("Appointment Set"),
      callbackStage: z.literal("appointment"),
      metaEvent: z.literal("Schedule"),
    }),
    z.strictObject({
      pipelineStage: z.literal("Showed"),
      callbackStage: z.literal("show"),
      metaEvent: z.literal("Showed"),
    }),
    z.strictObject({
      pipelineStage: z.literal("Sold"),
      callbackStage: z.literal("sale"),
      metaEvent: z.literal("Purchase"),
    }),
  ]),
  requiredRuntimeSecrets: z.tuple([
    z.literal("GHL_API_KEY"),
    z.literal("GHL_LOCATION_ID"),
    z.literal("GOOGLE_SHEETS_ID"),
    z.literal("GOOGLE_SERVICE_ACCOUNT_EMAIL"),
    z.literal("GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY"),
    z.literal("META_PIXEL_ID"),
    z.literal("META_CAPI_ACCESS_TOKEN"),
    z.literal("STAGE_WEBHOOK_SECRET"),
  ]),
  deduplication: z.strictObject({
    idempotencyKey: z.literal("downstream_conversions.external_id"),
    eventId: z.literal("downstream_conversions.event_id"),
  }),
  originalAttribution: z.strictObject({
    reuse: z.literal(true),
    fields: z.tuple([
      z.literal("first_url"),
      z.literal("original_query_string"),
      z.literal("fbc"),
      z.literal("fbp"),
      z.literal("ip_address"),
      z.literal("user_agent"),
    ]),
  }),
  purchase: z.strictObject({
    requiresExplicitPositiveValue: z.literal(true),
  }),
});
export type SimpleFormOfflineConversionContract = z.infer<
  typeof simpleFormOfflineConversionContractSchema
>;

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
  offlineConversionContract: simpleFormOfflineConversionContractSchema,
});

export const SIMPLE_FORM_MANIFEST = simpleFormManifestSchema.parse(
  simpleFormManifestJson,
);
export const SIMPLE_FORM_OFFLINE_CONVERSION_CONTRACT =
  SIMPLE_FORM_MANIFEST.offlineConversionContract;

export const SIMPLE_FORM_RUNTIME_SECRET_KEYS = [
  "GHL_API_KEY",
  "GHL_LOCATION_ID",
  "GOOGLE_SHEETS_ID",
  "GOOGLE_SERVICE_ACCOUNT_EMAIL",
  "GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY",
  "META_PIXEL_ID",
  "META_CAPI_ACCESS_TOKEN",
  "STAGE_WEBHOOK_SECRET",
  "ALERT_WEBHOOK_URL",
] as const;
export type SimpleFormRuntimeSecretKey = (typeof SIMPLE_FORM_RUNTIME_SECRET_KEYS)[number];

export const SIMPLE_FORM_CLIENT_INTEGRATION_FIELD_KEYS = [
  "GHL_LOCATION_ID",
  "GOOGLE_SHEETS_ID",
  "META_PIXEL_ID",
] as const;
export type SimpleFormClientIntegrationFieldKey =
  (typeof SIMPLE_FORM_CLIENT_INTEGRATION_FIELD_KEYS)[number];
export type SimpleFormClientIntegrationFields = Record<
  SimpleFormClientIntegrationFieldKey,
  string | null
>;

export const SIMPLE_FORM_CLIENT_SECRET_KEYS = [
  "GHL_API_KEY",
  "META_CAPI_ACCESS_TOKEN",
  "STAGE_WEBHOOK_SECRET",
  "ALERT_WEBHOOK_URL",
] as const;
export type SimpleFormClientSecretKey = (typeof SIMPLE_FORM_CLIENT_SECRET_KEYS)[number];

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
  runtimeKey: SimpleFormClientSecretKey;
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
    runtimeKey: "GHL_API_KEY",
    friendlyName: "GoHighLevel API Key",
    requirement: "required",
    requiredFor: "Creating or updating the lead and retaining its contact ID",
    whereToFind:
      "Create a private integration token for the client GHL location with contact access.",
    docsUrl: "https://marketplace.gohighlevel.com/docs/Authorization/PrivateIntegrationsToken/",
  },
  {
    runtimeKey: "STAGE_WEBHOOK_SECRET",
    friendlyName: "Lifecycle Callback Secret",
    requirement: "generated",
    requiredFor:
      "Bearer auth on POST /api/lead-stage for qualified, appointment, show, and sale",
    whereToFind:
      "Launchpad generates this per client. Regenerate it only when rotating the GHL lifecycle callback credential.",
    docsUrl: "https://developers.cloudflare.com/workers/configuration/secrets/",
  },
  {
    runtimeKey: "ALERT_WEBHOOK_URL",
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
  GHL_API_KEY: "ghlApiKeyEncrypted",
  META_CAPI_ACCESS_TOKEN: "metaCapiAccessTokenEncrypted",
  STAGE_WEBHOOK_SECRET: "stageWebhookSecretEncrypted",
  ALERT_WEBHOOK_URL: "alertWebhookUrlEncrypted",
} as const;
