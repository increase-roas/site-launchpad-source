CREATE TYPE "public"."generic_paid_funnel_publish_status" AS ENUM('pending', 'running', 'failed', 'published');--> statement-breakpoint
CREATE TYPE "public"."generic_paid_funnel_publish_step" AS ENUM('create_repository', 'ensure_resources', 'commit_source', 'dispatch_workflow', 'monitor_workflow', 'patch_runtime_secrets', 'get_live_url', 'published');--> statement-breakpoint
CREATE TABLE "generic_paid_funnel_publishes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clientId" integer NOT NULL,
	"funnelId" integer NOT NULL,
	"externalFunnelId" varchar(120) NOT NULL,
	"templateKey" varchar(80) NOT NULL,
	"templateVersion" varchar(40) NOT NULL,
	"resourceName" varchar(120) NOT NULL,
	"repositoryName" varchar(120) NOT NULL,
	"workerName" varchar(120) NOT NULL,
	"resourceDefinitions" jsonb NOT NULL,
	"provisionedResources" jsonb,
	"releaseNumber" integer DEFAULT 1 NOT NULL,
	"step" "generic_paid_funnel_publish_step" DEFAULT 'create_repository' NOT NULL,
	"status" "generic_paid_funnel_publish_status" DEFAULT 'pending' NOT NULL,
	"repositoryId" varchar(120),
	"repositoryFullName" varchar(240),
	"repositoryUrl" varchar(1000),
	"defaultBranch" varchar(120),
	"repositoryCreateRequestedAt" timestamp with time zone,
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
ALTER TABLE "generic_paid_funnel_publishes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "generic_paid_funnel_publishes" ADD CONSTRAINT "generic_paid_funnel_publishes_clientId_clients_id_fk" FOREIGN KEY ("clientId") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generic_paid_funnel_publishes" ADD CONSTRAINT "generic_paid_funnel_publishes_funnelId_paid_funnels_id_fk" FOREIGN KEY ("funnelId") REFERENCES "public"."paid_funnels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "generic_paid_funnel_publishes_funnel_unique" ON "generic_paid_funnel_publishes" USING btree ("funnelId");--> statement-breakpoint
CREATE UNIQUE INDEX "generic_paid_funnel_publishes_external_unique" ON "generic_paid_funnel_publishes" USING btree ("externalFunnelId");--> statement-breakpoint
CREATE INDEX "generic_paid_funnel_publishes_status_idx" ON "generic_paid_funnel_publishes" USING btree ("status");--> statement-breakpoint
CREATE INDEX "generic_paid_funnel_publishes_lease_until_idx" ON "generic_paid_funnel_publishes" USING btree ("leaseUntil");
