CREATE TYPE "public"."paid_funnel_framework" AS ENUM('static-html', 'astro', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."paid_funnel_version_status" AS ENUM('draft', 'ready', 'unsupported');--> statement-breakpoint
CREATE TYPE "public"."paid_funnel_source" AS ENUM('fixture', 'zip', 'template');--> statement-breakpoint
CREATE TYPE "public"."paid_funnel_step_kind" AS ENUM('landing', 'form', 'thankYou', 'booking', 'upsell', 'custom');--> statement-breakpoint
CREATE TYPE "public"."paid_funnel_step_state" AS ENUM('draft', 'preview', 'published');--> statement-breakpoint
CREATE TYPE "public"."paid_funnel_publish_adapter" AS ENUM('generic-paid-funnel', 'legacy-simple-form');--> statement-breakpoint
CREATE TYPE "public"."paid_funnel_publish_job_status" AS ENUM('pending', 'running', 'failed', 'published');--> statement-breakpoint
CREATE TYPE "public"."paid_funnel_artifact_kind" AS ENUM('zip', 'asset', 'preview');--> statement-breakpoint
CREATE TABLE "paid_funnel_templates" (
	"id" serial PRIMARY KEY NOT NULL,
	"templateKey" varchar(80) NOT NULL,
	"name" varchar(160) NOT NULL,
	"kind" varchar(40) DEFAULT 'paid-funnel' NOT NULL,
	"active" integer DEFAULT 1 NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "paid_funnel_templates" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE UNIQUE INDEX "paid_funnel_templates_key_unique" ON "paid_funnel_templates" USING btree ("templateKey");--> statement-breakpoint
CREATE TABLE "paid_funnel_template_versions" (
	"id" serial PRIMARY KEY NOT NULL,
	"templateId" integer NOT NULL,
	"version" varchar(40) NOT NULL,
	"framework" "paid_funnel_framework" NOT NULL,
	"packageJson" jsonb NOT NULL,
	"status" "paid_funnel_version_status" DEFAULT 'draft' NOT NULL,
	"unsupportedErrors" jsonb NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "paid_funnel_template_versions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "paid_funnel_template_versions" ADD CONSTRAINT "paid_funnel_template_versions_templateId_paid_funnel_templates_id_fk" FOREIGN KEY ("templateId") REFERENCES "public"."paid_funnel_templates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "paid_funnel_template_versions_unique" ON "paid_funnel_template_versions" USING btree ("templateId","version");--> statement-breakpoint
CREATE INDEX "paid_funnel_template_versions_template_idx" ON "paid_funnel_template_versions" USING btree ("templateId");--> statement-breakpoint
CREATE TABLE "paid_funnel_template_artifacts" (
	"id" serial PRIMARY KEY NOT NULL,
	"versionId" integer NOT NULL,
	"storageKey" varchar(800) NOT NULL,
	"filename" varchar(240) NOT NULL,
	"mimeType" varchar(120) NOT NULL,
	"byteSize" integer NOT NULL,
	"kind" "paid_funnel_artifact_kind" DEFAULT 'zip' NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "paid_funnel_template_artifacts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "paid_funnel_template_artifacts" ADD CONSTRAINT "paid_funnel_template_artifacts_versionId_paid_funnel_template_versions_id_fk" FOREIGN KEY ("versionId") REFERENCES "public"."paid_funnel_template_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "paid_funnel_template_artifacts_version_idx" ON "paid_funnel_template_artifacts" USING btree ("versionId");--> statement-breakpoint
CREATE TABLE "paid_funnels" (
	"id" serial PRIMARY KEY NOT NULL,
	"clientId" integer NOT NULL,
	"templateVersionId" integer,
	"name" varchar(160) NOT NULL,
	"slug" varchar(240) NOT NULL,
	"source" "paid_funnel_source" NOT NULL,
	"status" "workspace_status" DEFAULT 'draft' NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "paid_funnels" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "paid_funnels" ADD CONSTRAINT "paid_funnels_clientId_clients_id_fk" FOREIGN KEY ("clientId") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "paid_funnels" ADD CONSTRAINT "paid_funnels_templateVersionId_paid_funnel_template_versions_id_fk" FOREIGN KEY ("templateVersionId") REFERENCES "public"."paid_funnel_template_versions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "paid_funnels_client_slug_unique" ON "paid_funnels" USING btree ("clientId","slug");--> statement-breakpoint
CREATE INDEX "paid_funnels_client_idx" ON "paid_funnels" USING btree ("clientId");--> statement-breakpoint
CREATE TABLE "paid_funnel_steps" (
	"id" serial PRIMARY KEY NOT NULL,
	"funnelId" integer NOT NULL,
	"position" integer NOT NULL,
	"key" varchar(80) NOT NULL,
	"stepType" "paid_funnel_step_kind" NOT NULL,
	"slug" varchar(240) NOT NULL,
	"title" varchar(160) NOT NULL,
	"seo" jsonb NOT NULL,
	"nextStep" varchar(80),
	"previewState" "paid_funnel_step_state" DEFAULT 'draft' NOT NULL,
	"publishState" "paid_funnel_step_state" DEFAULT 'draft' NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "paid_funnel_steps" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "paid_funnel_steps" ADD CONSTRAINT "paid_funnel_steps_funnelId_paid_funnels_id_fk" FOREIGN KEY ("funnelId") REFERENCES "public"."paid_funnels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "paid_funnel_steps_position_unique" ON "paid_funnel_steps" USING btree ("funnelId","position");--> statement-breakpoint
CREATE UNIQUE INDEX "paid_funnel_steps_key_unique" ON "paid_funnel_steps" USING btree ("funnelId","key");--> statement-breakpoint
CREATE INDEX "paid_funnel_steps_funnel_idx" ON "paid_funnel_steps" USING btree ("funnelId");--> statement-breakpoint
CREATE TABLE "paid_funnel_graphs" (
	"id" serial PRIMARY KEY NOT NULL,
	"funnelId" integer NOT NULL,
	"stepId" integer NOT NULL,
	"graphVersion" integer DEFAULT 1 NOT NULL,
	"graphJson" jsonb NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "paid_funnel_graphs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "paid_funnel_graphs" ADD CONSTRAINT "paid_funnel_graphs_funnelId_paid_funnels_id_fk" FOREIGN KEY ("funnelId") REFERENCES "public"."paid_funnels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "paid_funnel_graphs" ADD CONSTRAINT "paid_funnel_graphs_stepId_paid_funnel_steps_id_fk" FOREIGN KEY ("stepId") REFERENCES "public"."paid_funnel_steps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "paid_funnel_graphs_step_unique" ON "paid_funnel_graphs" USING btree ("stepId");--> statement-breakpoint
CREATE INDEX "paid_funnel_graphs_funnel_idx" ON "paid_funnel_graphs" USING btree ("funnelId");--> statement-breakpoint
CREATE TABLE "paid_funnel_graph_revisions" (
	"id" serial PRIMARY KEY NOT NULL,
	"graphId" integer NOT NULL,
	"revision" integer NOT NULL,
	"graphJson" jsonb NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "paid_funnel_graph_revisions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "paid_funnel_graph_revisions" ADD CONSTRAINT "paid_funnel_graph_revisions_graphId_paid_funnel_graphs_id_fk" FOREIGN KEY ("graphId") REFERENCES "public"."paid_funnel_graphs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "paid_funnel_graph_revisions_unique" ON "paid_funnel_graph_revisions" USING btree ("graphId","revision");--> statement-breakpoint
CREATE INDEX "paid_funnel_graph_revisions_graph_idx" ON "paid_funnel_graph_revisions" USING btree ("graphId");--> statement-breakpoint
CREATE TABLE "paid_funnel_reusable_sections" (
	"id" serial PRIMARY KEY NOT NULL,
	"clientId" integer NOT NULL,
	"name" varchar(160) NOT NULL,
	"sectionJson" jsonb NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "paid_funnel_reusable_sections" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "paid_funnel_reusable_sections" ADD CONSTRAINT "paid_funnel_reusable_sections_clientId_clients_id_fk" FOREIGN KEY ("clientId") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "paid_funnel_reusable_sections_client_idx" ON "paid_funnel_reusable_sections" USING btree ("clientId");--> statement-breakpoint
CREATE TABLE "paid_funnel_publishes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clientId" integer NOT NULL,
	"funnelId" integer NOT NULL,
	"stepId" integer,
	"adapter" "paid_funnel_publish_adapter" NOT NULL,
	"status" "paid_funnel_publish_job_status" DEFAULT 'pending' NOT NULL,
	"previewUrl" varchar(1000),
	"liveUrl" varchar(1000),
	"lastError" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "paid_funnel_publishes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "paid_funnel_publishes" ADD CONSTRAINT "paid_funnel_publishes_clientId_clients_id_fk" FOREIGN KEY ("clientId") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "paid_funnel_publishes" ADD CONSTRAINT "paid_funnel_publishes_funnelId_paid_funnels_id_fk" FOREIGN KEY ("funnelId") REFERENCES "public"."paid_funnels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "paid_funnel_publishes" ADD CONSTRAINT "paid_funnel_publishes_stepId_paid_funnel_steps_id_fk" FOREIGN KEY ("stepId") REFERENCES "public"."paid_funnel_steps"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "paid_funnel_publishes_funnel_idx" ON "paid_funnel_publishes" USING btree ("funnelId");--> statement-breakpoint
CREATE INDEX "paid_funnel_publishes_status_idx" ON "paid_funnel_publishes" USING btree ("status");
