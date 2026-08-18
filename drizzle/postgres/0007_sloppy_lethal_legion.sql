CREATE TYPE "public"."astro_site_publish_status" AS ENUM('pending', 'running', 'failed', 'published');--> statement-breakpoint
CREATE TYPE "public"."astro_site_publish_step" AS ENUM('create_repository', 'ensure_d1_database', 'ensure_r2_bucket', 'commit_source', 'dispatch_workflow', 'monitor_workflow', 'patch_runtime_secrets', 'get_live_url', 'published');--> statement-breakpoint
CREATE TABLE "astroSitePublishes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clientId" integer NOT NULL,
	"externalSiteId" varchar(120) NOT NULL,
	"templateKey" varchar(80) NOT NULL,
	"templateRepo" varchar(240) NOT NULL,
	"contractVersion" integer NOT NULL,
	"resourceName" varchar(120) NOT NULL,
	"repositoryName" varchar(120) NOT NULL,
	"workerName" varchar(120) NOT NULL,
	"d1DatabaseName" varchar(120) NOT NULL,
	"r2BucketName" varchar(120) NOT NULL,
	"step" "astro_site_publish_step" DEFAULT 'create_repository' NOT NULL,
	"status" "astro_site_publish_status" DEFAULT 'pending' NOT NULL,
	"repositoryId" varchar(120),
	"repositoryFullName" varchar(240),
	"repositoryUrl" varchar(1000),
	"defaultBranch" varchar(120),
	"repositoryCreateRequestedAt" timestamp with time zone,
	"d1DatabaseId" varchar(120),
	"r2BucketId" varchar(120),
	"r2PublicUrl" varchar(1000),
	"commitSha" varchar(120),
	"liveUrl" varchar(1000),
	"dispatchRequestedAt" timestamp with time zone,
	"workflowRunId" varchar(120),
	"workflowStatus" varchar(80),
	"workflowCheckedAt" timestamp with time zone,
	"runtimeSecretsPatchedAt" timestamp with time zone,
	"leaseToken" uuid,
	"leaseUntil" timestamp with time zone,
	"lastError" text,
	"attemptCount" integer DEFAULT 0 NOT NULL,
	"completedAt" timestamp with time zone,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "astroSitePublishes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "astroSitePublishes" ADD CONSTRAINT "astroSitePublishes_clientId_clients_id_fk" FOREIGN KEY ("clientId") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "astro_site_publishes_client_unique" ON "astroSitePublishes" USING btree ("clientId");--> statement-breakpoint
CREATE UNIQUE INDEX "astro_site_publishes_external_site_unique" ON "astroSitePublishes" USING btree ("externalSiteId");--> statement-breakpoint
CREATE INDEX "astro_site_publishes_status_idx" ON "astroSitePublishes" USING btree ("status");--> statement-breakpoint
CREATE INDEX "astro_site_publishes_lease_until_idx" ON "astroSitePublishes" USING btree ("leaseUntil");