import {
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import {
  funnelPublishStatusValues,
  funnelPublishStepValues,
} from "../shared/simpleFormPublish";
import {
  astroSitePublishStatusValues,
  astroSitePublishStepValues,
} from "../shared/astroSitePublish";

export const userRoleEnum = pgEnum("user_role", ["user", "admin"]);

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = pgTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: serial("id").primaryKey(),
  /** Verified Supabase Auth subject. Unique per authenticated user. */
  authUserId: uuid("authUserId").notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: userRoleEnum("role").default("user").notNull(),
  createdAt: timestamp("createdAt", { withTimezone: true, mode: "date" })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true, mode: "date" })
    .defaultNow()
    .notNull(),
  lastSignedIn: timestamp("lastSignedIn", { withTimezone: true, mode: "date" })
    .defaultNow()
    .notNull(),
}).enableRLS();

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export const themeValues = ["aqua", "luxury", "natural", "mono"] as const;
export type ThemeValue = (typeof themeValues)[number];

export const productCategoryValues = [
  "hotTubs",
  "swimSpas",
  "saunas",
  "coldPlunge",
  "massageChairs",
] as const;
export type ProductCategory = (typeof productCategoryValues)[number];

export const businessDayValues = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;
export type BusinessDay = (typeof businessDayValues)[number];

export type BusinessHour = {
  day: BusinessDay;
  isOpen: boolean;
  opensAt: string;
  closesAt: string;
};

export const clientStatusValues = ["draft", "ready", "live", "issue"] as const;
export type ClientStatus = (typeof clientStatusValues)[number];

export const schemaTypeValues = [
  "HomeAndConstructionBusiness",
  "Store",
  "LocalBusiness",
] as const;
export type SchemaTypeValue = (typeof schemaTypeValues)[number];

export const clientSchemaTypeEnum = pgEnum(
  "client_schema_type",
  schemaTypeValues
);
export const clientThemeEnum = pgEnum("client_theme", themeValues);
export const clientStatusEnum = pgEnum("client_status", clientStatusValues);

export const clients = pgTable(
  "clients",
  {
    id: serial("id").primaryKey(),
    businessName: varchar("businessName", { length: 160 }).notNull(),
    shortName: varchar("shortName", { length: 80 }).notNull(),
    phone: varchar("phone", { length: 24 }),
    smsPhone: varchar("smsPhone", { length: 24 }),
    phoneDisplayOverride: varchar("phoneDisplayOverride", { length: 80 }),
    email: varchar("email", { length: 320 }),
    streetAddress: varchar("streetAddress", { length: 240 }),
    street2: varchar("street2", { length: 240 }),
    city: varchar("city", { length: 120 }),
    state: varchar("state", { length: 120 }),
    postalCode: varchar("postalCode", { length: 24 }),
    country: varchar("country", { length: 120 }).default("US").notNull(),
    latitude: varchar("latitude", { length: 32 }),
    longitude: varchar("longitude", { length: 32 }),
    googlePlaceId: varchar("googlePlaceId", { length: 300 }),
    websiteUrl: varchar("websiteUrl", { length: 500 }),
    schemaType: clientSchemaTypeEnum("schemaType")
      .default("HomeAndConstructionBusiness")
      .notNull(),
    foundedYear: integer("foundedYear"),
    tagline: varchar("tagline", { length: 240 }),
    theme: clientThemeEnum("theme").notNull(),
    businessHours: jsonb("businessHours").$type<BusinessHour[]>().notNull(),
    facebookUrl: varchar("facebookUrl", { length: 500 }),
    googleMapsUrl: varchar("googleMapsUrl", { length: 1000 }),
    productCategories: jsonb("productCategories")
      .$type<ProductCategory[]>()
      .notNull(),
    primaryOffer: text("primaryOffer"),
    financingPromise: text("financingPromise"),
    deliveryPromise: text("deliveryPromise"),
    status: clientStatusEnum("status").default("draft").notNull(),
    readyAt: timestamp("readyAt", { withTimezone: true, mode: "date" }),
    createdAt: timestamp("createdAt", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updatedAt", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
  },
  table => [
    uniqueIndex("clients_short_name_unique").on(table.shortName),
    index("clients_status_idx").on(table.status),
    index("clients_updated_at_idx").on(table.updatedAt),
  ]
).enableRLS();

export type Client = typeof clients.$inferSelect;
export type InsertClient = typeof clients.$inferInsert;

export const clientSecretSetups = pgTable(
  "clientSecretSetups",
  {
    id: serial("id").primaryKey(),
    clientId: integer("clientId")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    metaPixelIdEncrypted: text("metaPixelIdEncrypted"),
    ga4MeasurementIdEncrypted: text("ga4MeasurementIdEncrypted"),
    clarityIdEncrypted: text("clarityIdEncrypted"),
    ghlApiKeyEncrypted: text("ghlApiKeyEncrypted"),
    ghlWebhookUrlEncrypted: text("ghlWebhookUrlEncrypted"),
    cloudflareProjectNameEncrypted: text("cloudflareProjectNameEncrypted"),
    createdAt: timestamp("createdAt", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updatedAt", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
  },
  table => [
    uniqueIndex("client_secret_setups_client_unique").on(table.clientId),
  ]
).enableRLS();

export type ClientSecretSetup = typeof clientSecretSetups.$inferSelect;
export type InsertClientSecretSetup = typeof clientSecretSetups.$inferInsert;

export const clientLeadIntegrations = pgTable(
  "clientLeadIntegrations",
  {
    clientId: integer("clientId")
      .primaryKey()
      .references(() => clients.id, { onDelete: "cascade" }),
    ghlLocationId: text("ghlLocationId"),
    googleSheetsId: text("googleSheetsId"),
    metaPixelId: text("metaPixelId"),
    ghlApiKeyEncrypted: text("ghlApiKeyEncrypted"),
    metaCapiAccessTokenEncrypted: text("metaCapiAccessTokenEncrypted"),
    stageWebhookSecretEncrypted: text("stageWebhookSecretEncrypted"),
    alertWebhookUrlEncrypted: text("alertWebhookUrlEncrypted"),
    createdAt: timestamp("createdAt", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updatedAt", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
  },
  table => [
    index("client_lead_integrations_updated_at_idx").on(table.updatedAt),
  ]
).enableRLS();

export type ClientLeadIntegration = typeof clientLeadIntegrations.$inferSelect;
export type InsertClientLeadIntegration =
  typeof clientLeadIntegrations.$inferInsert;

export const assetSlotValues = [
  "logo",
  "hero",
  "hotTubs",
  "swimSpas",
  "showroom",
  "product",
  "delivery",
  "navLogo",
  "footerLogo",
  "inventoryLogo",
  "favicon",
  "ogImage",
  "categoryHotTubs",
  "categorySwimSpas",
  "categorySaunas",
  "categoryColdPlunge",
  "categoryMassageChairs",
] as const;
export type AssetSlot = (typeof assetSlotValues)[number];

export const assetSlotEnum = pgEnum("asset_slot", assetSlotValues);

export const clientAssets = pgTable(
  "clientAssets",
  {
    id: serial("id").primaryKey(),
    clientId: integer("clientId")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    slot: assetSlotEnum("slot").notNull(),
    storageKey: varchar("storageKey", { length: 800 }).notNull(),
    storageUrl: varchar("storageUrl", { length: 1000 }).notNull(),
    filename: varchar("filename", { length: 240 }).notNull(),
    originalFilename: varchar("originalFilename", { length: 500 }).notNull(),
    mimeType: varchar("mimeType", { length: 120 }).notNull(),
    byteSize: integer("byteSize").notNull(),
    width: integer("width").notNull(),
    height: integer("height").notNull(),
    createdAt: timestamp("createdAt", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updatedAt", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
  },
  table => [
    uniqueIndex("client_assets_client_slot_unique").on(
      table.clientId,
      table.slot
    ),
    index("client_assets_client_idx").on(table.clientId),
  ]
).enableRLS();

export type ClientAsset = typeof clientAssets.$inferSelect;
export type InsertClientAsset = typeof clientAssets.$inferInsert;

export const assetUploadKindEnum = pgEnum("asset_upload_kind", [
  "client",
  "astro",
]);
export const assetUploadStatusEnum = pgEnum("asset_upload_status", [
  "pending",
  "completed",
  "failed",
]);

export const assetUploadSessions = pgTable(
  "assetUploadSessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    clientId: integer("clientId")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    assetKind: assetUploadKindEnum("assetKind").notNull(),
    slot: varchar("slot", { length: 80 }).notNull(),
    originalFilename: varchar("originalFilename", { length: 500 }).notNull(),
    declaredMimeType: varchar("declaredMimeType", { length: 120 }).notNull(),
    declaredSizeBytes: integer("declaredSizeBytes").notNull(),
    tempKey: varchar("tempKey", { length: 800 })
      .notNull()
      .unique("asset_upload_sessions_temp_key_unique"),
    status: assetUploadStatusEnum("status").default("pending").notNull(),
    expiresAt: timestamp("expiresAt", {
      withTimezone: true,
      mode: "date",
    }).notNull(),
    completedAt: timestamp("completedAt", { withTimezone: true, mode: "date" }),
    createdAt: timestamp("createdAt", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updatedAt", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
  },
  table => [
    index("asset_upload_sessions_client_idx").on(table.clientId),
    index("asset_upload_sessions_status_idx").on(table.status),
    index("asset_upload_sessions_expires_at_idx").on(table.expiresAt),
  ]
).enableRLS();

export type AssetUploadSession = typeof assetUploadSessions.$inferSelect;
export type InsertAssetUploadSession = typeof assetUploadSessions.$inferInsert;

export const astroClientConfigs = pgTable(
  "astroClientConfigs",
  {
    id: serial("id").primaryKey(),
    clientId: integer("clientId")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    socialLinks: jsonb("socialLinks").$type<Record<string, string>>().notNull(),
    fonts: jsonb("fonts").$type<Record<string, string>>().notNull(),
    borderRadii: jsonb("borderRadii").$type<Record<string, number>>().notNull(),
    navigationItems: jsonb("navigationItems")
      .$type<Array<Record<string, unknown>>>()
      .notNull(),
    categories: jsonb("categories")
      .$type<Record<string, Record<string, unknown>>>()
      .notNull(),
    financing: jsonb("financing").$type<Record<string, unknown>>().notNull(),
    homepageSections: jsonb("homepageSections")
      .$type<Array<Record<string, unknown>>>()
      .notNull(),
    integrations: jsonb("integrations")
      .$type<Record<string, Record<string, unknown>>>()
      .notNull(),
    generatedConfigEncrypted: text("generatedConfigEncrypted"),
    generatedAt: timestamp("generatedAt", { withTimezone: true, mode: "date" }),
    createdAt: timestamp("createdAt", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updatedAt", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
  },
  table => [
    uniqueIndex("astro_client_configs_client_unique").on(table.clientId),
  ]
).enableRLS();

export type AstroClientConfig = typeof astroClientConfigs.$inferSelect;
export type InsertAstroClientConfig = typeof astroClientConfigs.$inferInsert;

export const wranglerSecretSetups = pgTable(
  "wranglerSecretSetups",
  {
    id: serial("id").primaryKey(),
    clientId: integer("clientId")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    ghlApiKeyEncrypted: text("ghlApiKeyEncrypted"),
    ghlLocationIdEncrypted: text("ghlLocationIdEncrypted"),
    metaPixelIdEncrypted: text("metaPixelIdEncrypted"),
    metaCapiAccessTokenEncrypted: text("metaCapiAccessTokenEncrypted"),
    metaValueQualifiedEncrypted: text("metaValueQualifiedEncrypted"),
    metaValueScheduleEncrypted: text("metaValueScheduleEncrypted"),
    metaValueShowedEncrypted: text("metaValueShowedEncrypted"),
    stageWebhookSecretEncrypted: text("stageWebhookSecretEncrypted"),
    googleSheetsIdEncrypted: text("googleSheetsIdEncrypted"),
    googleServiceAccountEmailEncrypted: text(
      "googleServiceAccountEmailEncrypted"
    ),
    googleServiceAccountPrivateKeyEncrypted: text(
      "googleServiceAccountPrivateKeyEncrypted"
    ),
    alertWebhookUrlEncrypted: text("alertWebhookUrlEncrypted"),
    adminPasswordEncrypted: text("adminPasswordEncrypted"),
    adminSessionSecretEncrypted: text("adminSessionSecretEncrypted"),
    createdAt: timestamp("createdAt", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updatedAt", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
  },
  table => [
    uniqueIndex("wrangler_secret_setups_client_unique").on(table.clientId),
  ]
).enableRLS();

export type WranglerSecretSetup = typeof wranglerSecretSetups.$inferSelect;
export type InsertWranglerSecretSetup =
  typeof wranglerSecretSetups.$inferInsert;

export const sitePageTypeValues = [
  "homepage",
  "inventory",
  "categories",
  "visitUs",
  "financing",
] as const;
export type SitePageType = (typeof sitePageTypeValues)[number];

export const workspaceStatusValues = [
  "draft",
  "ready",
  "live",
  "issue",
] as const;
export type WorkspaceStatus = (typeof workspaceStatusValues)[number];

export const sitePageTypeEnum = pgEnum("site_page_type", sitePageTypeValues);
export const workspaceStatusEnum = pgEnum(
  "workspace_status",
  workspaceStatusValues
);

export const sitePages = pgTable(
  "sitePages",
  {
    id: serial("id").primaryKey(),
    clientId: integer("clientId")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    pageType: sitePageTypeEnum("pageType").notNull(),
    title: varchar("title", { length: 160 }).notNull(),
    slug: varchar("slug", { length: 240 }).notNull(),
    description: varchar("description", { length: 500 }).notNull(),
    status: workspaceStatusEnum("status").default("draft").notNull(),
    enabled: integer("enabled").default(1).notNull(),
    createdAt: timestamp("createdAt", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updatedAt", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
  },
  table => [
    uniqueIndex("site_pages_client_type_unique").on(
      table.clientId,
      table.pageType
    ),
    index("site_pages_client_idx").on(table.clientId),
  ]
).enableRLS();

export type SitePage = typeof sitePages.$inferSelect;
export type InsertSitePage = typeof sitePages.$inferInsert;

export const funnelShapeValues = ["A", "B", "C"] as const;
export type FunnelShape = (typeof funnelShapeValues)[number];

export const funnelDeploymentStatusValues = [
  "draft",
  "ready",
  "deployed",
] as const;
export type FunnelDeploymentStatus =
  (typeof funnelDeploymentStatusValues)[number];

export const funnelShapeEnum = pgEnum("funnel_shape", funnelShapeValues);
export const funnelDeploymentStatusEnum = pgEnum(
  "funnel_deployment_status",
  funnelDeploymentStatusValues
);

export const funnels = pgTable(
  "funnels",
  {
    id: serial("id").primaryKey(),
    clientId: integer("clientId")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 160 }).notNull(),
    slug: varchar("slug", { length: 240 }).notNull(),
    templateKey: varchar("templateKey", { length: 80 }),
    templateRepo: varchar("templateRepo", { length: 240 }),
    contractVersion: integer("contractVersion"),
    shape: funnelShapeEnum("shape").notNull(),
    status: workspaceStatusEnum("status").default("draft").notNull(),
    deploymentStatus: funnelDeploymentStatusEnum("deploymentStatus")
      .default("draft")
      .notNull(),
    readyAt: timestamp("readyAt", { withTimezone: true, mode: "date" }),
    deployedAt: timestamp("deployedAt", { withTimezone: true, mode: "date" }),
    createdAt: timestamp("createdAt", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updatedAt", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
  },
  table => [
    uniqueIndex("funnels_client_slug_unique").on(table.clientId, table.slug),
    uniqueIndex("funnels_client_template_unique").on(
      table.clientId,
      table.templateKey
    ),
    index("funnels_client_idx").on(table.clientId),
  ]
).enableRLS();

export type Funnel = typeof funnels.$inferSelect;
export type InsertFunnel = typeof funnels.$inferInsert;

export const funnelConfigs = pgTable(
  "funnelConfigs",
  {
    id: serial("id").primaryKey(),
    funnelId: integer("funnelId")
      .notNull()
      .references(() => funnels.id, { onDelete: "cascade" }),
    serviceArea: varchar("serviceArea", { length: 500 }).notNull(),
    offerHeadline: varchar("offerHeadline", { length: 300 }).notNull(),
    offerSubheadline: text("offerSubheadline").notNull(),
    thankYouMessage: text("thankYouMessage").notNull(),
    generatedConfigEncrypted: text("generatedConfigEncrypted"),
    generatedAt: timestamp("generatedAt", { withTimezone: true, mode: "date" }),
    createdAt: timestamp("createdAt", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updatedAt", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
  },
  table => [uniqueIndex("funnel_configs_funnel_unique").on(table.funnelId)]
).enableRLS();

export type FunnelConfig = typeof funnelConfigs.$inferSelect;
export type InsertFunnelConfig = typeof funnelConfigs.$inferInsert;

export const surveyQuestionTypeValues = ["radio", "checkbox", "text"] as const;
export type SurveyQuestionType = (typeof surveyQuestionTypeValues)[number];

export const surveyQuestionTypeEnum = pgEnum(
  "survey_question_type",
  surveyQuestionTypeValues
);

export const funnelSurveyQuestions = pgTable(
  "funnelSurveyQuestions",
  {
    id: serial("id").primaryKey(),
    funnelId: integer("funnelId")
      .notNull()
      .references(() => funnels.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    questionText: varchar("questionText", { length: 500 }).notNull(),
    questionType: surveyQuestionTypeEnum("questionType").notNull(),
    options: jsonb("options").$type<string[]>().notNull(),
    createdAt: timestamp("createdAt", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updatedAt", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
  },
  table => [
    uniqueIndex("funnel_survey_questions_position_unique").on(
      table.funnelId,
      table.position
    ),
    index("funnel_survey_questions_funnel_idx").on(table.funnelId),
  ]
).enableRLS();

export type FunnelSurveyQuestion = typeof funnelSurveyQuestions.$inferSelect;
export type InsertFunnelSurveyQuestion =
  typeof funnelSurveyQuestions.$inferInsert;

export const funnelStepTypeValues = [
  "zip",
  "survey",
  "contact",
  "book",
  "thankYou",
] as const;
export type FunnelStepType = (typeof funnelStepTypeValues)[number];

export const funnelStepTypeEnum = pgEnum(
  "funnel_step_type",
  funnelStepTypeValues
);

export const funnelSteps = pgTable(
  "funnelSteps",
  {
    id: serial("id").primaryKey(),
    funnelId: integer("funnelId")
      .notNull()
      .references(() => funnels.id, { onDelete: "cascade" }),
    stepType: funnelStepTypeEnum("stepType").notNull(),
    position: integer("position").notNull(),
    title: varchar("title", { length: 160 }).notNull(),
    path: varchar("path", { length: 500 }).notNull(),
    capturedFields: jsonb("capturedFields").$type<string[]>().notNull(),
    trackingActions: jsonb("trackingActions").$type<string[]>().notNull(),
    createdAt: timestamp("createdAt", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updatedAt", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
  },
  table => [
    uniqueIndex("funnel_steps_funnel_position_unique").on(
      table.funnelId,
      table.position
    ),
    index("funnel_steps_funnel_idx").on(table.funnelId),
  ]
).enableRLS();

export type FunnelStep = typeof funnelSteps.$inferSelect;
export type InsertFunnelStep = typeof funnelSteps.$inferInsert;

export const funnelSimpleFormConfigs = pgTable("funnelSimpleFormConfigs", {
  funnelId: integer("funnelId")
    .primaryKey()
    .references(() => funnels.id, { onDelete: "cascade" }),
  configJson: jsonb("configJson").$type<Record<string, unknown>>().notNull(),
  createdAt: timestamp("createdAt", { withTimezone: true, mode: "date" })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true, mode: "date" })
    .defaultNow()
    .notNull(),
}).enableRLS();

export type FunnelSimpleFormConfig =
  typeof funnelSimpleFormConfigs.$inferSelect;
export type InsertFunnelSimpleFormConfig =
  typeof funnelSimpleFormConfigs.$inferInsert;

export const funnelRuntimeSecrets = pgTable("funnelRuntimeSecrets", {
  funnelId: integer("funnelId")
    .primaryKey()
    .references(() => funnels.id, { onDelete: "cascade" }),
  metaCapiAccessTokenEncrypted: text("metaCapiAccessTokenEncrypted"),
  metaTestEventCodeEncrypted: text("metaTestEventCodeEncrypted"),
  ghlWebhookUrlEncrypted: text("ghlWebhookUrlEncrypted"),
  crmCallbackSecretEncrypted: text("crmCallbackSecretEncrypted"),
  submissionAlertWebhookUrlEncrypted: text(
    "submissionAlertWebhookUrlEncrypted"
  ),
  createdAt: timestamp("createdAt", { withTimezone: true, mode: "date" })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true, mode: "date" })
    .defaultNow()
    .notNull(),
}).enableRLS();

export type FunnelRuntimeSecret = typeof funnelRuntimeSecrets.$inferSelect;
export type InsertFunnelRuntimeSecret =
  typeof funnelRuntimeSecrets.$inferInsert;

export const funnelPublishStepEnum = pgEnum(
  "funnel_publish_step",
  funnelPublishStepValues
);
export const funnelPublishStatusEnum = pgEnum(
  "funnel_publish_status",
  funnelPublishStatusValues
);

export const funnelPublishes = pgTable(
  "funnelPublishes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    clientId: integer("clientId")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    funnelId: integer("funnelId")
      .notNull()
      .references(() => funnels.id, { onDelete: "cascade" }),
    externalFunnelId: varchar("externalFunnelId", { length: 120 }).notNull(),
    resourceName: varchar("resourceName", { length: 120 }).notNull(),
    repositoryName: varchar("repositoryName", { length: 120 }).notNull(),
    workerName: varchar("workerName", { length: 120 }).notNull(),
    step: funnelPublishStepEnum("step").default("create_repository").notNull(),
    status: funnelPublishStatusEnum("status").default("pending").notNull(),
    repositoryId: varchar("repositoryId", { length: 120 }),
    repositoryFullName: varchar("repositoryFullName", { length: 240 }),
    repositoryUrl: varchar("repositoryUrl", { length: 1000 }),
    defaultBranch: varchar("defaultBranch", { length: 120 }),
    repositoryCreateRequestedAt: timestamp("repositoryCreateRequestedAt", {
      withTimezone: true,
      mode: "date",
    }),
    kvNamespaceId: varchar("kvNamespaceId", { length: 120 }),
    d1DatabaseId: varchar("d1DatabaseId", { length: 120 }),
    primaryQueueId: varchar("primaryQueueId", { length: 120 }),
    deadLetterQueueId: varchar("deadLetterQueueId", { length: 120 }),
    commitSha: varchar("commitSha", { length: 120 }),
    liveUrl: varchar("liveUrl", { length: 1000 }),
    dispatchRequestedAt: timestamp("dispatchRequestedAt", {
      withTimezone: true,
      mode: "date",
    }),
    workflowRunId: varchar("workflowRunId", { length: 120 }),
    workflowStatus: varchar("workflowStatus", { length: 80 }),
    workflowCheckedAt: timestamp("workflowCheckedAt", {
      withTimezone: true,
      mode: "date",
    }),
    runtimeSecretsPatchedAt: timestamp("runtimeSecretsPatchedAt", {
      withTimezone: true,
      mode: "date",
    }),
    leaseToken: uuid("leaseToken"),
    leaseUntil: timestamp("leaseUntil", { withTimezone: true, mode: "date" }),
    lastError: text("lastError"),
    attemptCount: integer("attemptCount").default(0).notNull(),
    completedAt: timestamp("completedAt", {
      withTimezone: true,
      mode: "date",
    }),
    createdAt: timestamp("createdAt", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updatedAt", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
  },
  table => [
    uniqueIndex("funnel_publishes_funnel_unique").on(table.funnelId),
    uniqueIndex("funnel_publishes_external_funnel_unique").on(
      table.externalFunnelId
    ),
    index("funnel_publishes_status_idx").on(table.status),
    index("funnel_publishes_lease_until_idx").on(table.leaseUntil),
  ]
).enableRLS();

export type FunnelPublish = typeof funnelPublishes.$inferSelect;
export type InsertFunnelPublish = typeof funnelPublishes.$inferInsert;

export const astroSitePublishStepEnum = pgEnum(
  "astro_site_publish_step",
  astroSitePublishStepValues,
);
export const astroSitePublishStatusEnum = pgEnum(
  "astro_site_publish_status",
  astroSitePublishStatusValues,
);

export const astroSitePublishes = pgTable(
  "astroSitePublishes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    clientId: integer("clientId")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    externalSiteId: varchar("externalSiteId", { length: 120 }).notNull(),
    templateKey: varchar("templateKey", { length: 80 }).notNull(),
    templateRepo: varchar("templateRepo", { length: 240 }).notNull(),
    contractVersion: integer("contractVersion").notNull(),
    resourceName: varchar("resourceName", { length: 120 }).notNull(),
    repositoryName: varchar("repositoryName", { length: 120 }).notNull(),
    workerName: varchar("workerName", { length: 120 }).notNull(),
    d1DatabaseName: varchar("d1DatabaseName", { length: 120 }).notNull(),
    r2BucketName: varchar("r2BucketName", { length: 120 }).notNull(),
    step: astroSitePublishStepEnum("step")
      .default("create_repository")
      .notNull(),
    status: astroSitePublishStatusEnum("status").default("pending").notNull(),
    repositoryId: varchar("repositoryId", { length: 120 }),
    repositoryFullName: varchar("repositoryFullName", { length: 240 }),
    repositoryUrl: varchar("repositoryUrl", { length: 1000 }),
    defaultBranch: varchar("defaultBranch", { length: 120 }),
    repositoryCreateRequestedAt: timestamp("repositoryCreateRequestedAt", {
      withTimezone: true,
      mode: "date",
    }),
    d1DatabaseId: varchar("d1DatabaseId", { length: 120 }),
    r2BucketId: varchar("r2BucketId", { length: 120 }),
    r2PublicUrl: varchar("r2PublicUrl", { length: 1000 }),
    commitSha: varchar("commitSha", { length: 120 }),
    liveUrl: varchar("liveUrl", { length: 1000 }),
    dispatchRequestedAt: timestamp("dispatchRequestedAt", {
      withTimezone: true,
      mode: "date",
    }),
    workflowRunId: varchar("workflowRunId", { length: 120 }),
    workflowStatus: varchar("workflowStatus", { length: 80 }),
    workflowCheckedAt: timestamp("workflowCheckedAt", {
      withTimezone: true,
      mode: "date",
    }),
    runtimeSecretsPatchedAt: timestamp("runtimeSecretsPatchedAt", {
      withTimezone: true,
      mode: "date",
    }),
    leaseToken: uuid("leaseToken"),
    leaseUntil: timestamp("leaseUntil", { withTimezone: true, mode: "date" }),
    lastError: text("lastError"),
    attemptCount: integer("attemptCount").default(0).notNull(),
    completedAt: timestamp("completedAt", {
      withTimezone: true,
      mode: "date",
    }),
    createdAt: timestamp("createdAt", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updatedAt", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
  },
  table => [
    uniqueIndex("astro_site_publishes_client_unique").on(table.clientId),
    uniqueIndex("astro_site_publishes_external_site_unique").on(
      table.externalSiteId,
    ),
    index("astro_site_publishes_status_idx").on(table.status),
    index("astro_site_publishes_lease_until_idx").on(table.leaseUntil),
  ],
).enableRLS();

export type AstroSitePublish = typeof astroSitePublishes.$inferSelect;
export type InsertAstroSitePublish = typeof astroSitePublishes.$inferInsert;

export const homepageSectionTypeValues = [
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
export type HomepageSectionType = (typeof homepageSectionTypeValues)[number];

export const homepageSectionTypeEnum = pgEnum(
  "homepage_section_type",
  homepageSectionTypeValues
);

export const homepageSections = pgTable(
  "homepageSections",
  {
    id: serial("id").primaryKey(),
    clientId: integer("clientId")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    sectionType: homepageSectionTypeEnum("sectionType").notNull(),
    position: integer("position").notNull(),
    enabled: integer("enabled").default(1).notNull(),
    createdAt: timestamp("createdAt", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updatedAt", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
  },
  table => [
    uniqueIndex("homepage_sections_client_type_unique").on(
      table.clientId,
      table.sectionType
    ),
    uniqueIndex("homepage_sections_client_position_unique").on(
      table.clientId,
      table.position
    ),
    index("homepage_sections_client_idx").on(table.clientId),
  ]
).enableRLS();

export type HomepageSection = typeof homepageSections.$inferSelect;
export type InsertHomepageSection = typeof homepageSections.$inferInsert;

export const clientIntegrationReconciliationStatusValues = [
  "pending",
  "ready",
  "conflict",
] as const;
export type ClientIntegrationReconciliationStatusValue =
  (typeof clientIntegrationReconciliationStatusValues)[number];

export const clientIntegrationReconciliationStatusEnum = pgEnum(
  "client_integration_reconciliation_status",
  clientIntegrationReconciliationStatusValues
);

export const clientIntegrationProfiles = pgTable(
  "client_integration_profiles",
  {
    clientId: integer("clientId")
      .primaryKey()
      .references(() => clients.id, { onDelete: "cascade" }),
    profileVersion: integer("profileVersion").default(1).notNull(),
    ghlLocationId: text("ghlLocationId"),
    googleSheetsId: text("googleSheetsId"),
    metaPixelId: text("metaPixelId"),
    secretsEncrypted: text("secretsEncrypted"),
    reconciliationStatus: clientIntegrationReconciliationStatusEnum(
      "reconciliationStatus"
    )
      .default("pending")
      .notNull(),
    conflictedKeys: jsonb("conflictedKeys").$type<string[]>().notNull(),
    createdAt: timestamp("createdAt", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updatedAt", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
  },
  table => [
    index("client_integration_profiles_updated_at_idx").on(table.updatedAt),
  ]
).enableRLS();

export type ClientIntegrationProfile =
  typeof clientIntegrationProfiles.$inferSelect;
export type InsertClientIntegrationProfile =
  typeof clientIntegrationProfiles.$inferInsert;

export const paidFunnelFrameworkValues = [
  "static-html",
  "astro",
  "unknown",
] as const;
export type PaidFunnelFrameworkValue =
  (typeof paidFunnelFrameworkValues)[number];

export const paidFunnelVersionStatusValues = [
  "draft",
  "ready",
  "unsupported",
] as const;
export type PaidFunnelVersionStatus =
  (typeof paidFunnelVersionStatusValues)[number];

export const paidFunnelSourceValues = ["fixture", "zip", "template"] as const;
export type PaidFunnelSource = (typeof paidFunnelSourceValues)[number];

export const paidFunnelStepKindValues = [
  "landing",
  "survey",
  "form",
  "thankYou",
  "booking",
  "upsell",
  "custom",
] as const;
export type PaidFunnelStepKind = (typeof paidFunnelStepKindValues)[number];

export const paidFunnelStepStateValues = [
  "draft",
  "preview",
  "published",
] as const;
export type PaidFunnelStepState = (typeof paidFunnelStepStateValues)[number];

export const paidFunnelPublishAdapterValues = [
  "generic-paid-funnel",
  "legacy-simple-form",
] as const;
export type PaidFunnelPublishAdapterValue =
  (typeof paidFunnelPublishAdapterValues)[number];

export const paidFunnelPublishJobStatusValues = [
  "pending",
  "running",
  "failed",
  "published",
] as const;
export type PaidFunnelPublishJobStatus =
  (typeof paidFunnelPublishJobStatusValues)[number];

export const paidFunnelArtifactKindValues = [
  "zip",
  "asset",
  "preview",
] as const;
export type PaidFunnelArtifactKind =
  (typeof paidFunnelArtifactKindValues)[number];

export const paidFunnelFrameworkEnum = pgEnum(
  "paid_funnel_framework",
  paidFunnelFrameworkValues
);
export const paidFunnelVersionStatusEnum = pgEnum(
  "paid_funnel_version_status",
  paidFunnelVersionStatusValues
);
export const paidFunnelSourceEnum = pgEnum(
  "paid_funnel_source",
  paidFunnelSourceValues
);
export const paidFunnelStepKindEnum = pgEnum(
  "paid_funnel_step_kind",
  paidFunnelStepKindValues
);
export const paidFunnelStepStateEnum = pgEnum(
  "paid_funnel_step_state",
  paidFunnelStepStateValues
);
export const paidFunnelPublishAdapterEnum = pgEnum(
  "paid_funnel_publish_adapter",
  paidFunnelPublishAdapterValues
);
export const paidFunnelPublishJobStatusEnum = pgEnum(
  "paid_funnel_publish_job_status",
  paidFunnelPublishJobStatusValues
);
export const paidFunnelArtifactKindEnum = pgEnum(
  "paid_funnel_artifact_kind",
  paidFunnelArtifactKindValues
);

export const paidFunnelTemplates = pgTable(
  "paid_funnel_templates",
  {
    id: serial("id").primaryKey(),
    templateKey: varchar("templateKey", { length: 80 }).notNull(),
    name: varchar("name", { length: 160 }).notNull(),
    kind: varchar("kind", { length: 40 }).default("paid-funnel").notNull(),
    active: integer("active").default(1).notNull(),
    createdAt: timestamp("createdAt", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updatedAt", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
  },
  table => [
    uniqueIndex("paid_funnel_templates_key_unique").on(table.templateKey),
  ]
).enableRLS();

export type PaidFunnelTemplate = typeof paidFunnelTemplates.$inferSelect;
export type InsertPaidFunnelTemplate = typeof paidFunnelTemplates.$inferInsert;

export const paidFunnelTemplateVersions = pgTable(
  "paid_funnel_template_versions",
  {
    id: serial("id").primaryKey(),
    templateId: integer("templateId")
      .notNull()
      .references(() => paidFunnelTemplates.id, { onDelete: "cascade" }),
    version: varchar("version", { length: 40 }).notNull(),
    framework: paidFunnelFrameworkEnum("framework").notNull(),
    packageJson: jsonb("packageJson")
      .$type<Record<string, unknown>>()
      .notNull(),
    status: paidFunnelVersionStatusEnum("status").default("draft").notNull(),
    unsupportedErrors: jsonb("unsupportedErrors")
      .$type<Array<{ path: string; reason: string }>>()
      .notNull(),
    createdAt: timestamp("createdAt", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updatedAt", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
  },
  table => [
    uniqueIndex("paid_funnel_template_versions_unique").on(
      table.templateId,
      table.version
    ),
    index("paid_funnel_template_versions_template_idx").on(table.templateId),
  ]
).enableRLS();

export type PaidFunnelTemplateVersion =
  typeof paidFunnelTemplateVersions.$inferSelect;
export type InsertPaidFunnelTemplateVersion =
  typeof paidFunnelTemplateVersions.$inferInsert;

export const paidFunnelTemplateArtifacts = pgTable(
  "paid_funnel_template_artifacts",
  {
    id: serial("id").primaryKey(),
    versionId: integer("versionId")
      .notNull()
      .references(() => paidFunnelTemplateVersions.id, { onDelete: "cascade" }),
    storageKey: varchar("storageKey", { length: 800 }).notNull(),
    filename: varchar("filename", { length: 240 }).notNull(),
    mimeType: varchar("mimeType", { length: 120 }).notNull(),
    byteSize: integer("byteSize").notNull(),
    kind: paidFunnelArtifactKindEnum("kind").default("zip").notNull(),
    createdAt: timestamp("createdAt", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updatedAt", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
  },
  table => [
    index("paid_funnel_template_artifacts_version_idx").on(table.versionId),
  ]
).enableRLS();

export type PaidFunnelTemplateArtifact =
  typeof paidFunnelTemplateArtifacts.$inferSelect;
export type InsertPaidFunnelTemplateArtifact =
  typeof paidFunnelTemplateArtifacts.$inferInsert;

export const paidFunnels = pgTable(
  "paid_funnels",
  {
    id: serial("id").primaryKey(),
    clientId: integer("clientId")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    templateVersionId: integer("templateVersionId").references(
      () => paidFunnelTemplateVersions.id,
      { onDelete: "set null" }
    ),
    name: varchar("name", { length: 160 }).notNull(),
    slug: varchar("slug", { length: 240 }).notNull(),
    source: paidFunnelSourceEnum("source").notNull(),
    status: workspaceStatusEnum("status").default("draft").notNull(),
    createdAt: timestamp("createdAt", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updatedAt", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
  },
  table => [
    uniqueIndex("paid_funnels_client_slug_unique").on(
      table.clientId,
      table.slug
    ),
    index("paid_funnels_client_idx").on(table.clientId),
  ]
).enableRLS();

export type PaidFunnel = typeof paidFunnels.$inferSelect;
export type InsertPaidFunnel = typeof paidFunnels.$inferInsert;

export const paidFunnelSteps = pgTable(
  "paid_funnel_steps",
  {
    id: serial("id").primaryKey(),
    funnelId: integer("funnelId")
      .notNull()
      .references(() => paidFunnels.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    key: varchar("key", { length: 80 }).notNull(),
    stepType: paidFunnelStepKindEnum("stepType").notNull(),
    slug: varchar("slug", { length: 240 }).notNull(),
    title: varchar("title", { length: 160 }).notNull(),
    seo: jsonb("seo").$type<Record<string, unknown>>().notNull(),
    nextStep: varchar("nextStep", { length: 80 }),
    previewState: paidFunnelStepStateEnum("previewState")
      .default("draft")
      .notNull(),
    publishState: paidFunnelStepStateEnum("publishState")
      .default("draft")
      .notNull(),
    createdAt: timestamp("createdAt", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updatedAt", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
  },
  table => [
    uniqueIndex("paid_funnel_steps_position_unique").on(
      table.funnelId,
      table.position
    ),
    uniqueIndex("paid_funnel_steps_key_unique").on(table.funnelId, table.key),
    index("paid_funnel_steps_funnel_idx").on(table.funnelId),
  ]
).enableRLS();

export type PaidFunnelStepRow = typeof paidFunnelSteps.$inferSelect;
export type InsertPaidFunnelStepRow = typeof paidFunnelSteps.$inferInsert;

export const paidFunnelGraphs = pgTable(
  "paid_funnel_graphs",
  {
    id: serial("id").primaryKey(),
    funnelId: integer("funnelId")
      .notNull()
      .references(() => paidFunnels.id, { onDelete: "cascade" }),
    stepId: integer("stepId")
      .notNull()
      .references(() => paidFunnelSteps.id, { onDelete: "cascade" }),
    graphVersion: integer("graphVersion").default(1).notNull(),
    graphJson: jsonb("graphJson").$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp("createdAt", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updatedAt", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
  },
  table => [
    uniqueIndex("paid_funnel_graphs_step_unique").on(table.stepId),
    index("paid_funnel_graphs_funnel_idx").on(table.funnelId),
  ]
).enableRLS();

export type PaidFunnelGraphRow = typeof paidFunnelGraphs.$inferSelect;
export type InsertPaidFunnelGraphRow = typeof paidFunnelGraphs.$inferInsert;

export const paidFunnelGraphRevisions = pgTable(
  "paid_funnel_graph_revisions",
  {
    id: serial("id").primaryKey(),
    graphId: integer("graphId")
      .notNull()
      .references(() => paidFunnelGraphs.id, { onDelete: "cascade" }),
    revision: integer("revision").notNull(),
    graphJson: jsonb("graphJson").$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp("createdAt", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
  },
  table => [
    uniqueIndex("paid_funnel_graph_revisions_unique").on(
      table.graphId,
      table.revision
    ),
    index("paid_funnel_graph_revisions_graph_idx").on(table.graphId),
  ]
).enableRLS();

export type PaidFunnelGraphRevision =
  typeof paidFunnelGraphRevisions.$inferSelect;
export type InsertPaidFunnelGraphRevision =
  typeof paidFunnelGraphRevisions.$inferInsert;

export const paidFunnelReusableSections = pgTable(
  "paid_funnel_reusable_sections",
  {
    id: serial("id").primaryKey(),
    clientId: integer("clientId")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 160 }).notNull(),
    sectionJson: jsonb("sectionJson")
      .$type<Record<string, unknown>>()
      .notNull(),
    createdAt: timestamp("createdAt", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updatedAt", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
  },
  table => [
    index("paid_funnel_reusable_sections_client_idx").on(table.clientId),
  ]
).enableRLS();

export type PaidFunnelReusableSection =
  typeof paidFunnelReusableSections.$inferSelect;
export type InsertPaidFunnelReusableSection =
  typeof paidFunnelReusableSections.$inferInsert;

export const paidFunnelPublishes = pgTable(
  "paid_funnel_publishes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    clientId: integer("clientId")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    funnelId: integer("funnelId")
      .notNull()
      .references(() => paidFunnels.id, { onDelete: "cascade" }),
    stepId: integer("stepId").references(() => paidFunnelSteps.id, {
      onDelete: "set null",
    }),
    adapter: paidFunnelPublishAdapterEnum("adapter").notNull(),
    status: paidFunnelPublishJobStatusEnum("status")
      .default("pending")
      .notNull(),
    previewUrl: varchar("previewUrl", { length: 1000 }),
    liveUrl: varchar("liveUrl", { length: 1000 }),
    lastError: text("lastError"),
    createdAt: timestamp("createdAt", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updatedAt", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
  },
  table => [
    index("paid_funnel_publishes_funnel_idx").on(table.funnelId),
    index("paid_funnel_publishes_status_idx").on(table.status),
  ]
).enableRLS();

export type PaidFunnelPublishRow = typeof paidFunnelPublishes.$inferSelect;
export type InsertPaidFunnelPublishRow =
  typeof paidFunnelPublishes.$inferInsert;
