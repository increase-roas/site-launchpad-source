import {
  index,
  int,
  json,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

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

export const clients = mysqlTable(
  "clients",
  {
    id: int("id").autoincrement().primaryKey(),
    businessName: varchar("businessName", { length: 160 }).notNull(),
    shortName: varchar("shortName", { length: 80 }).notNull(),
    phone: varchar("phone", { length: 24 }).notNull(),
    smsPhone: varchar("smsPhone", { length: 24 }),
    phoneDisplayOverride: varchar("phoneDisplayOverride", { length: 80 }),
    email: varchar("email", { length: 320 }).notNull(),
    streetAddress: varchar("streetAddress", { length: 240 }).notNull(),
    street2: varchar("street2", { length: 240 }),
    city: varchar("city", { length: 120 }).notNull(),
    state: varchar("state", { length: 120 }).notNull(),
    postalCode: varchar("postalCode", { length: 24 }).notNull(),
    country: varchar("country", { length: 120 }).default("US").notNull(),
    latitude: varchar("latitude", { length: 32 }),
    longitude: varchar("longitude", { length: 32 }),
    googlePlaceId: varchar("googlePlaceId", { length: 300 }),
    websiteUrl: varchar("websiteUrl", { length: 500 }).notNull(),
    schemaType: mysqlEnum("schemaType", schemaTypeValues)
      .default("HomeAndConstructionBusiness")
      .notNull(),
    foundedYear: int("foundedYear").notNull(),
    tagline: varchar("tagline", { length: 240 }).notNull(),
    theme: mysqlEnum("theme", themeValues).notNull(),
    businessHours: json("businessHours").$type<BusinessHour[]>().notNull(),
    facebookUrl: varchar("facebookUrl", { length: 500 }).notNull(),
    googleMapsUrl: varchar("googleMapsUrl", { length: 1000 }).notNull(),
    productCategories: json("productCategories").$type<ProductCategory[]>().notNull(),
    primaryOffer: text("primaryOffer").notNull(),
    financingPromise: text("financingPromise").notNull(),
    deliveryPromise: text("deliveryPromise").notNull(),
    status: mysqlEnum("status", clientStatusValues).default("draft").notNull(),
    readyAt: timestamp("readyAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    uniqueIndex("clients_short_name_unique").on(table.shortName),
    index("clients_status_idx").on(table.status),
    index("clients_updated_at_idx").on(table.updatedAt),
  ],
);

export type Client = typeof clients.$inferSelect;
export type InsertClient = typeof clients.$inferInsert;

export const clientSecretSetups = mysqlTable(
  "clientSecretSetups",
  {
    id: int("id").autoincrement().primaryKey(),
    clientId: int("clientId")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    metaPixelIdEncrypted: text("metaPixelIdEncrypted"),
    ga4MeasurementIdEncrypted: text("ga4MeasurementIdEncrypted"),
    clarityIdEncrypted: text("clarityIdEncrypted"),
    ghlApiKeyEncrypted: text("ghlApiKeyEncrypted"),
    ghlWebhookUrlEncrypted: text("ghlWebhookUrlEncrypted"),
    cloudflareProjectNameEncrypted: text("cloudflareProjectNameEncrypted"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [uniqueIndex("client_secret_setups_client_unique").on(table.clientId)],
);

export type ClientSecretSetup = typeof clientSecretSetups.$inferSelect;
export type InsertClientSecretSetup = typeof clientSecretSetups.$inferInsert;

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

export const clientAssets = mysqlTable(
  "clientAssets",
  {
    id: int("id").autoincrement().primaryKey(),
    clientId: int("clientId")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    slot: mysqlEnum("slot", assetSlotValues).notNull(),
    storageKey: varchar("storageKey", { length: 800 }).notNull(),
    storageUrl: varchar("storageUrl", { length: 1000 }).notNull(),
    filename: varchar("filename", { length: 240 }).notNull(),
    originalFilename: varchar("originalFilename", { length: 500 }).notNull(),
    mimeType: varchar("mimeType", { length: 120 }).notNull(),
    byteSize: int("byteSize").notNull(),
    width: int("width").notNull(),
    height: int("height").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    uniqueIndex("client_assets_client_slot_unique").on(table.clientId, table.slot),
    index("client_assets_client_idx").on(table.clientId),
  ],
);

export type ClientAsset = typeof clientAssets.$inferSelect;
export type InsertClientAsset = typeof clientAssets.$inferInsert;

export const astroClientConfigs = mysqlTable(
  "astroClientConfigs",
  {
    id: int("id").autoincrement().primaryKey(),
    clientId: int("clientId")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    socialLinks: json("socialLinks").$type<Record<string, string>>().notNull(),
    fonts: json("fonts").$type<Record<string, string>>().notNull(),
    borderRadii: json("borderRadii").$type<Record<string, number>>().notNull(),
    navigationItems: json("navigationItems").$type<Array<Record<string, unknown>>>().notNull(),
    categories: json("categories").$type<Record<string, Record<string, unknown>>>().notNull(),
    financing: json("financing").$type<Record<string, unknown>>().notNull(),
    homepageSections: json("homepageSections").$type<Array<Record<string, unknown>>>().notNull(),
    integrations: json("integrations").$type<Record<string, Record<string, unknown>>>().notNull(),
    generatedConfigEncrypted: text("generatedConfigEncrypted"),
    generatedAt: timestamp("generatedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [uniqueIndex("astro_client_configs_client_unique").on(table.clientId)],
);

export type AstroClientConfig = typeof astroClientConfigs.$inferSelect;
export type InsertAstroClientConfig = typeof astroClientConfigs.$inferInsert;

export const wranglerSecretSetups = mysqlTable(
  "wranglerSecretSetups",
  {
    id: int("id").autoincrement().primaryKey(),
    clientId: int("clientId")
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
    googleServiceAccountEmailEncrypted: text("googleServiceAccountEmailEncrypted"),
    googleServiceAccountPrivateKeyEncrypted: text("googleServiceAccountPrivateKeyEncrypted"),
    alertWebhookUrlEncrypted: text("alertWebhookUrlEncrypted"),
    adminPasswordEncrypted: text("adminPasswordEncrypted"),
    adminSessionSecretEncrypted: text("adminSessionSecretEncrypted"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [uniqueIndex("wrangler_secret_setups_client_unique").on(table.clientId)],
);

export type WranglerSecretSetup = typeof wranglerSecretSetups.$inferSelect;
export type InsertWranglerSecretSetup = typeof wranglerSecretSetups.$inferInsert;

export const sitePageTypeValues = [
  "homepage",
  "inventory",
  "categories",
  "visitUs",
  "financing",
] as const;
export type SitePageType = (typeof sitePageTypeValues)[number];

export const workspaceStatusValues = ["draft", "ready", "live", "issue"] as const;
export type WorkspaceStatus = (typeof workspaceStatusValues)[number];

export const sitePages = mysqlTable(
  "sitePages",
  {
    id: int("id").autoincrement().primaryKey(),
    clientId: int("clientId")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    pageType: mysqlEnum("pageType", sitePageTypeValues).notNull(),
    title: varchar("title", { length: 160 }).notNull(),
    slug: varchar("slug", { length: 240 }).notNull(),
    description: varchar("description", { length: 500 }).notNull(),
    status: mysqlEnum("status", workspaceStatusValues).default("draft").notNull(),
    enabled: int("enabled").default(1).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    uniqueIndex("site_pages_client_type_unique").on(table.clientId, table.pageType),
    index("site_pages_client_idx").on(table.clientId),
  ],
);

export type SitePage = typeof sitePages.$inferSelect;
export type InsertSitePage = typeof sitePages.$inferInsert;

export const funnelShapeValues = ["A", "B", "C"] as const;
export type FunnelShape = (typeof funnelShapeValues)[number];

export const funnelDeploymentStatusValues = ["draft", "ready", "deployed"] as const;
export type FunnelDeploymentStatus = (typeof funnelDeploymentStatusValues)[number];

export const funnels = mysqlTable(
  "funnels",
  {
    id: int("id").autoincrement().primaryKey(),
    clientId: int("clientId")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 160 }).notNull(),
    slug: varchar("slug", { length: 240 }).notNull(),
    shape: mysqlEnum("shape", funnelShapeValues).notNull(),
    status: mysqlEnum("status", workspaceStatusValues).default("draft").notNull(),
    deploymentStatus: mysqlEnum("deploymentStatus", funnelDeploymentStatusValues)
      .default("draft")
      .notNull(),
    readyAt: timestamp("readyAt"),
    deployedAt: timestamp("deployedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    uniqueIndex("funnels_client_slug_unique").on(table.clientId, table.slug),
    index("funnels_client_idx").on(table.clientId),
  ],
);

export type Funnel = typeof funnels.$inferSelect;
export type InsertFunnel = typeof funnels.$inferInsert;

export const funnelConfigs = mysqlTable(
  "funnelConfigs",
  {
    id: int("id").autoincrement().primaryKey(),
    funnelId: int("funnelId")
      .notNull()
      .references(() => funnels.id, { onDelete: "cascade" }),
    serviceArea: varchar("serviceArea", { length: 500 }).notNull(),
    offerHeadline: varchar("offerHeadline", { length: 300 }).notNull(),
    offerSubheadline: text("offerSubheadline").notNull(),
    thankYouMessage: text("thankYouMessage").notNull(),
    generatedConfigEncrypted: text("generatedConfigEncrypted"),
    generatedAt: timestamp("generatedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [uniqueIndex("funnel_configs_funnel_unique").on(table.funnelId)],
);

export type FunnelConfig = typeof funnelConfigs.$inferSelect;
export type InsertFunnelConfig = typeof funnelConfigs.$inferInsert;

export const surveyQuestionTypeValues = ["radio", "checkbox", "text"] as const;
export type SurveyQuestionType = (typeof surveyQuestionTypeValues)[number];

export const funnelSurveyQuestions = mysqlTable(
  "funnelSurveyQuestions",
  {
    id: int("id").autoincrement().primaryKey(),
    funnelId: int("funnelId")
      .notNull()
      .references(() => funnels.id, { onDelete: "cascade" }),
    position: int("position").notNull(),
    questionText: varchar("questionText", { length: 500 }).notNull(),
    questionType: mysqlEnum("questionType", surveyQuestionTypeValues).notNull(),
    options: json("options").$type<string[]>().notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    uniqueIndex("funnel_survey_questions_position_unique").on(table.funnelId, table.position),
    index("funnel_survey_questions_funnel_idx").on(table.funnelId),
  ],
);

export type FunnelSurveyQuestion = typeof funnelSurveyQuestions.$inferSelect;
export type InsertFunnelSurveyQuestion = typeof funnelSurveyQuestions.$inferInsert;

export const funnelStepTypeValues = ["zip", "survey", "contact", "book", "thankYou"] as const;
export type FunnelStepType = (typeof funnelStepTypeValues)[number];

export const funnelSteps = mysqlTable(
  "funnelSteps",
  {
    id: int("id").autoincrement().primaryKey(),
    funnelId: int("funnelId")
      .notNull()
      .references(() => funnels.id, { onDelete: "cascade" }),
    stepType: mysqlEnum("stepType", funnelStepTypeValues).notNull(),
    position: int("position").notNull(),
    title: varchar("title", { length: 160 }).notNull(),
    path: varchar("path", { length: 500 }).notNull(),
    capturedFields: json("capturedFields").$type<string[]>().notNull(),
    trackingActions: json("trackingActions").$type<string[]>().notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    uniqueIndex("funnel_steps_funnel_position_unique").on(table.funnelId, table.position),
    index("funnel_steps_funnel_idx").on(table.funnelId),
  ],
);

export type FunnelStep = typeof funnelSteps.$inferSelect;
export type InsertFunnelStep = typeof funnelSteps.$inferInsert;

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

export const homepageSections = mysqlTable(
  "homepageSections",
  {
    id: int("id").autoincrement().primaryKey(),
    clientId: int("clientId")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    sectionType: mysqlEnum("sectionType", homepageSectionTypeValues).notNull(),
    position: int("position").notNull(),
    enabled: int("enabled").default(1).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    uniqueIndex("homepage_sections_client_type_unique").on(table.clientId, table.sectionType),
    uniqueIndex("homepage_sections_client_position_unique").on(table.clientId, table.position),
    index("homepage_sections_client_idx").on(table.clientId),
  ],
);

export type HomepageSection = typeof homepageSections.$inferSelect;
export type InsertHomepageSection = typeof homepageSections.$inferInsert;
