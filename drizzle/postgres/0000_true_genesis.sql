CREATE TYPE "public"."asset_slot" AS ENUM('logo', 'hero', 'hotTubs', 'swimSpas', 'showroom', 'product', 'delivery', 'navLogo', 'footerLogo', 'inventoryLogo', 'favicon', 'ogImage', 'categoryHotTubs', 'categorySwimSpas', 'categorySaunas', 'categoryColdPlunge', 'categoryMassageChairs');--> statement-breakpoint
CREATE TYPE "public"."client_schema_type" AS ENUM('HomeAndConstructionBusiness', 'Store', 'LocalBusiness');--> statement-breakpoint
CREATE TYPE "public"."client_status" AS ENUM('draft', 'ready', 'live', 'issue');--> statement-breakpoint
CREATE TYPE "public"."client_theme" AS ENUM('aqua', 'luxury', 'natural', 'mono');--> statement-breakpoint
CREATE TYPE "public"."funnel_deployment_status" AS ENUM('draft', 'ready', 'deployed');--> statement-breakpoint
CREATE TYPE "public"."funnel_shape" AS ENUM('A', 'B', 'C');--> statement-breakpoint
CREATE TYPE "public"."funnel_step_type" AS ENUM('zip', 'survey', 'contact', 'book', 'thankYou');--> statement-breakpoint
CREATE TYPE "public"."homepage_section_type" AS ENUM('hero', 'categories', 'visitShowroom', 'deliveryInstall', 'testimonials', 'financing', 'faq', 'contact', 'map');--> statement-breakpoint
CREATE TYPE "public"."site_page_type" AS ENUM('homepage', 'inventory', 'categories', 'visitUs', 'financing');--> statement-breakpoint
CREATE TYPE "public"."survey_question_type" AS ENUM('radio', 'checkbox', 'text');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('user', 'admin');--> statement-breakpoint
CREATE TYPE "public"."workspace_status" AS ENUM('draft', 'ready', 'live', 'issue');--> statement-breakpoint
CREATE TABLE "astroClientConfigs" (
	"id" serial PRIMARY KEY NOT NULL,
	"clientId" integer NOT NULL,
	"socialLinks" jsonb NOT NULL,
	"fonts" jsonb NOT NULL,
	"borderRadii" jsonb NOT NULL,
	"navigationItems" jsonb NOT NULL,
	"categories" jsonb NOT NULL,
	"financing" jsonb NOT NULL,
	"homepageSections" jsonb NOT NULL,
	"integrations" jsonb NOT NULL,
	"generatedConfigEncrypted" text,
	"generatedAt" timestamp with time zone,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "clientAssets" (
	"id" serial PRIMARY KEY NOT NULL,
	"clientId" integer NOT NULL,
	"slot" "asset_slot" NOT NULL,
	"storageKey" varchar(800) NOT NULL,
	"storageUrl" varchar(1000) NOT NULL,
	"filename" varchar(240) NOT NULL,
	"originalFilename" varchar(500) NOT NULL,
	"mimeType" varchar(120) NOT NULL,
	"byteSize" integer NOT NULL,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "clientSecretSetups" (
	"id" serial PRIMARY KEY NOT NULL,
	"clientId" integer NOT NULL,
	"metaPixelIdEncrypted" text,
	"ga4MeasurementIdEncrypted" text,
	"clarityIdEncrypted" text,
	"ghlApiKeyEncrypted" text,
	"ghlWebhookUrlEncrypted" text,
	"cloudflareProjectNameEncrypted" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "clients" (
	"id" serial PRIMARY KEY NOT NULL,
	"businessName" varchar(160) NOT NULL,
	"shortName" varchar(80) NOT NULL,
	"phone" varchar(24),
	"smsPhone" varchar(24),
	"phoneDisplayOverride" varchar(80),
	"email" varchar(320),
	"streetAddress" varchar(240),
	"street2" varchar(240),
	"city" varchar(120),
	"state" varchar(120),
	"postalCode" varchar(24),
	"country" varchar(120) DEFAULT 'US' NOT NULL,
	"latitude" varchar(32),
	"longitude" varchar(32),
	"googlePlaceId" varchar(300),
	"websiteUrl" varchar(500),
	"schemaType" "client_schema_type" DEFAULT 'HomeAndConstructionBusiness' NOT NULL,
	"foundedYear" integer,
	"tagline" varchar(240),
	"theme" "client_theme" NOT NULL,
	"businessHours" jsonb NOT NULL,
	"facebookUrl" varchar(500),
	"googleMapsUrl" varchar(1000),
	"productCategories" jsonb NOT NULL,
	"primaryOffer" text,
	"financingPromise" text,
	"deliveryPromise" text,
	"status" "client_status" DEFAULT 'draft' NOT NULL,
	"readyAt" timestamp with time zone,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "funnelConfigs" (
	"id" serial PRIMARY KEY NOT NULL,
	"funnelId" integer NOT NULL,
	"serviceArea" varchar(500) NOT NULL,
	"offerHeadline" varchar(300) NOT NULL,
	"offerSubheadline" text NOT NULL,
	"thankYouMessage" text NOT NULL,
	"generatedConfigEncrypted" text,
	"generatedAt" timestamp with time zone,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "funnelRuntimeSecrets" (
	"funnelId" integer PRIMARY KEY NOT NULL,
	"metaCapiAccessTokenEncrypted" text,
	"metaTestEventCodeEncrypted" text,
	"ghlWebhookUrlEncrypted" text,
	"crmCallbackSecretEncrypted" text,
	"submissionAlertWebhookUrlEncrypted" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "funnelSimpleFormConfigs" (
	"funnelId" integer PRIMARY KEY NOT NULL,
	"configJson" jsonb NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "funnelSteps" (
	"id" serial PRIMARY KEY NOT NULL,
	"funnelId" integer NOT NULL,
	"stepType" "funnel_step_type" NOT NULL,
	"position" integer NOT NULL,
	"title" varchar(160) NOT NULL,
	"path" varchar(500) NOT NULL,
	"capturedFields" jsonb NOT NULL,
	"trackingActions" jsonb NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "funnelSurveyQuestions" (
	"id" serial PRIMARY KEY NOT NULL,
	"funnelId" integer NOT NULL,
	"position" integer NOT NULL,
	"questionText" varchar(500) NOT NULL,
	"questionType" "survey_question_type" NOT NULL,
	"options" jsonb NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "funnels" (
	"id" serial PRIMARY KEY NOT NULL,
	"clientId" integer NOT NULL,
	"name" varchar(160) NOT NULL,
	"slug" varchar(240) NOT NULL,
	"templateKey" varchar(80),
	"templateRepo" varchar(240),
	"contractVersion" integer,
	"shape" "funnel_shape" NOT NULL,
	"status" "workspace_status" DEFAULT 'draft' NOT NULL,
	"deploymentStatus" "funnel_deployment_status" DEFAULT 'draft' NOT NULL,
	"readyAt" timestamp with time zone,
	"deployedAt" timestamp with time zone,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "homepageSections" (
	"id" serial PRIMARY KEY NOT NULL,
	"clientId" integer NOT NULL,
	"sectionType" "homepage_section_type" NOT NULL,
	"position" integer NOT NULL,
	"enabled" integer DEFAULT 1 NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sitePages" (
	"id" serial PRIMARY KEY NOT NULL,
	"clientId" integer NOT NULL,
	"pageType" "site_page_type" NOT NULL,
	"title" varchar(160) NOT NULL,
	"slug" varchar(240) NOT NULL,
	"description" varchar(500) NOT NULL,
	"status" "workspace_status" DEFAULT 'draft' NOT NULL,
	"enabled" integer DEFAULT 1 NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"openId" varchar(64) NOT NULL,
	"name" text,
	"email" varchar(320),
	"loginMethod" varchar(64),
	"role" "user_role" DEFAULT 'user' NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	"lastSignedIn" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_openId_unique" UNIQUE("openId")
);
--> statement-breakpoint
CREATE TABLE "wranglerSecretSetups" (
	"id" serial PRIMARY KEY NOT NULL,
	"clientId" integer NOT NULL,
	"ghlApiKeyEncrypted" text,
	"ghlLocationIdEncrypted" text,
	"metaPixelIdEncrypted" text,
	"metaCapiAccessTokenEncrypted" text,
	"metaValueQualifiedEncrypted" text,
	"metaValueScheduleEncrypted" text,
	"metaValueShowedEncrypted" text,
	"stageWebhookSecretEncrypted" text,
	"googleSheetsIdEncrypted" text,
	"googleServiceAccountEmailEncrypted" text,
	"googleServiceAccountPrivateKeyEncrypted" text,
	"alertWebhookUrlEncrypted" text,
	"adminPasswordEncrypted" text,
	"adminSessionSecretEncrypted" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "astroClientConfigs" ADD CONSTRAINT "astroClientConfigs_clientId_clients_id_fk" FOREIGN KEY ("clientId") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clientAssets" ADD CONSTRAINT "clientAssets_clientId_clients_id_fk" FOREIGN KEY ("clientId") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clientSecretSetups" ADD CONSTRAINT "clientSecretSetups_clientId_clients_id_fk" FOREIGN KEY ("clientId") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "funnelConfigs" ADD CONSTRAINT "funnelConfigs_funnelId_funnels_id_fk" FOREIGN KEY ("funnelId") REFERENCES "public"."funnels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "funnelRuntimeSecrets" ADD CONSTRAINT "funnelRuntimeSecrets_funnelId_funnels_id_fk" FOREIGN KEY ("funnelId") REFERENCES "public"."funnels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "funnelSimpleFormConfigs" ADD CONSTRAINT "funnelSimpleFormConfigs_funnelId_funnels_id_fk" FOREIGN KEY ("funnelId") REFERENCES "public"."funnels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "funnelSteps" ADD CONSTRAINT "funnelSteps_funnelId_funnels_id_fk" FOREIGN KEY ("funnelId") REFERENCES "public"."funnels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "funnelSurveyQuestions" ADD CONSTRAINT "funnelSurveyQuestions_funnelId_funnels_id_fk" FOREIGN KEY ("funnelId") REFERENCES "public"."funnels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "funnels" ADD CONSTRAINT "funnels_clientId_clients_id_fk" FOREIGN KEY ("clientId") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "homepageSections" ADD CONSTRAINT "homepageSections_clientId_clients_id_fk" FOREIGN KEY ("clientId") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sitePages" ADD CONSTRAINT "sitePages_clientId_clients_id_fk" FOREIGN KEY ("clientId") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wranglerSecretSetups" ADD CONSTRAINT "wranglerSecretSetups_clientId_clients_id_fk" FOREIGN KEY ("clientId") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "astro_client_configs_client_unique" ON "astroClientConfigs" USING btree ("clientId");--> statement-breakpoint
CREATE UNIQUE INDEX "client_assets_client_slot_unique" ON "clientAssets" USING btree ("clientId","slot");--> statement-breakpoint
CREATE INDEX "client_assets_client_idx" ON "clientAssets" USING btree ("clientId");--> statement-breakpoint
CREATE UNIQUE INDEX "client_secret_setups_client_unique" ON "clientSecretSetups" USING btree ("clientId");--> statement-breakpoint
CREATE UNIQUE INDEX "clients_short_name_unique" ON "clients" USING btree ("shortName");--> statement-breakpoint
CREATE INDEX "clients_status_idx" ON "clients" USING btree ("status");--> statement-breakpoint
CREATE INDEX "clients_updated_at_idx" ON "clients" USING btree ("updatedAt");--> statement-breakpoint
CREATE UNIQUE INDEX "funnel_configs_funnel_unique" ON "funnelConfigs" USING btree ("funnelId");--> statement-breakpoint
CREATE UNIQUE INDEX "funnel_steps_funnel_position_unique" ON "funnelSteps" USING btree ("funnelId","position");--> statement-breakpoint
CREATE INDEX "funnel_steps_funnel_idx" ON "funnelSteps" USING btree ("funnelId");--> statement-breakpoint
CREATE UNIQUE INDEX "funnel_survey_questions_position_unique" ON "funnelSurveyQuestions" USING btree ("funnelId","position");--> statement-breakpoint
CREATE INDEX "funnel_survey_questions_funnel_idx" ON "funnelSurveyQuestions" USING btree ("funnelId");--> statement-breakpoint
CREATE UNIQUE INDEX "funnels_client_slug_unique" ON "funnels" USING btree ("clientId","slug");--> statement-breakpoint
CREATE UNIQUE INDEX "funnels_client_template_unique" ON "funnels" USING btree ("clientId","templateKey");--> statement-breakpoint
CREATE INDEX "funnels_client_idx" ON "funnels" USING btree ("clientId");--> statement-breakpoint
CREATE UNIQUE INDEX "homepage_sections_client_type_unique" ON "homepageSections" USING btree ("clientId","sectionType");--> statement-breakpoint
CREATE UNIQUE INDEX "homepage_sections_client_position_unique" ON "homepageSections" USING btree ("clientId","position");--> statement-breakpoint
CREATE INDEX "homepage_sections_client_idx" ON "homepageSections" USING btree ("clientId");--> statement-breakpoint
CREATE UNIQUE INDEX "site_pages_client_type_unique" ON "sitePages" USING btree ("clientId","pageType");--> statement-breakpoint
CREATE INDEX "site_pages_client_idx" ON "sitePages" USING btree ("clientId");--> statement-breakpoint
CREATE UNIQUE INDEX "wrangler_secret_setups_client_unique" ON "wranglerSecretSetups" USING btree ("clientId");--> statement-breakpoint
UPDATE "funnels"
SET "deploymentStatus" = 'ready',
	"updatedAt" = now()
WHERE "status" = 'ready'
	AND "deploymentStatus" = 'draft';--> statement-breakpoint
UPDATE "funnels"
SET "deploymentStatus" = 'deployed',
	"updatedAt" = now()
WHERE "status" = 'live';