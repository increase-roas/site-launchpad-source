ALTER TABLE "astroClientConfigs" ADD COLUMN "websiteRevision" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
CREATE TYPE "public"."astro_site_preview_step" AS ENUM('create_repository', 'ensure_d1_database', 'ensure_r2_bucket', 'commit_source', 'dispatch_workflow', 'monitor_workflow', 'patch_runtime_secrets', 'verify_preview', 'ready');--> statement-breakpoint
CREATE TYPE "public"."astro_site_preview_status" AS ENUM('pending', 'running', 'failed', 'ready');--> statement-breakpoint
CREATE TYPE "public"."astro_site_preview_error_code" AS ENUM('CLIENT_VALIDATION_FAILED', 'CONFIG_VALIDATION_FAILED', 'GITHUB_REPO_CREATE_FAILED', 'CONFIG_COMMIT_FAILED', 'D1_PROVISION_FAILED', 'R2_PROVISION_FAILED', 'GITHUB_ACTION_FAILED', 'ASTRO_BUILD_FAILED', 'CLOUDFLARE_DEPLOY_FAILED', 'PREVIEW_HEALTHCHECK_FAILED', 'PREVIEW_ALREADY_RUNNING');--> statement-breakpoint
CREATE TABLE "astroSitePreviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clientId" integer NOT NULL,
	"externalSiteId" varchar(120) NOT NULL,
	"templateKey" varchar(80) NOT NULL,
	"templateRepo" varchar(240) NOT NULL,
	"contractVersion" integer NOT NULL,
	"templateSha" varchar(120) NOT NULL,
	"clientRevision" integer NOT NULL,
	"resourceName" varchar(120) NOT NULL,
	"repositoryName" varchar(120) NOT NULL,
	"workerName" varchar(120) NOT NULL,
	"d1DatabaseName" varchar(120) NOT NULL,
	"r2BucketName" varchar(120) NOT NULL,
	"step" "astro_site_preview_step" DEFAULT 'create_repository' NOT NULL,
	"status" "astro_site_preview_status" DEFAULT 'pending' NOT NULL,
	"repositoryId" varchar(120),
	"repositoryFullName" varchar(240),
	"repositoryUrl" varchar(1000),
	"defaultBranch" varchar(120),
	"repositoryCreateRequestedAt" timestamp with time zone,
	"d1DatabaseId" varchar(120),
	"r2BucketId" varchar(120),
	"r2PublicUrl" varchar(1000),
	"commitSha" varchar(120),
	"previewUrl" varchar(1000),
	"dispatchRequestedAt" timestamp with time zone,
	"workflowRunId" varchar(120),
	"workflowStatus" varchar(80),
	"workflowCheckedAt" timestamp with time zone,
	"runtimeSecretsPatchedAt" timestamp with time zone,
	"materialSnapshotEncrypted" text NOT NULL,
	"warnings" jsonb NOT NULL,
	"errorCode" "astro_site_preview_error_code",
	"approvedSha" varchar(120),
	"approvedAt" timestamp with time zone,
	"leaseToken" uuid,
	"leaseUntil" timestamp with time zone,
	"lastError" text,
	"attemptCount" integer DEFAULT 0 NOT NULL,
	"completedAt" timestamp with time zone,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "astroSitePreviews" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "astroSitePreviews" ADD CONSTRAINT "astroSitePreviews_clientId_clients_id_fk" FOREIGN KEY ("clientId") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "astro_site_previews_client_idx" ON "astroSitePreviews" USING btree ("clientId");--> statement-breakpoint
CREATE INDEX "astro_site_previews_status_idx" ON "astroSitePreviews" USING btree ("status");--> statement-breakpoint
CREATE INDEX "astro_site_previews_lease_until_idx" ON "astroSitePreviews" USING btree ("leaseUntil");--> statement-breakpoint
CREATE UNIQUE INDEX "astro_site_previews_active_client_unique" ON "astroSitePreviews" USING btree ("clientId") WHERE "status" IN ('pending', 'running');
