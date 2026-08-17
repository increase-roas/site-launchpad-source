CREATE TYPE "public"."funnel_publish_status" AS ENUM('pending', 'running', 'failed', 'published');--> statement-breakpoint
CREATE TYPE "public"."funnel_publish_step" AS ENUM('create_repository', 'commit_source', 'configure_cloudflare', 'dispatch_workflow', 'locate_workflow', 'monitor_workflow', 'published');--> statement-breakpoint
CREATE TABLE "funnelPublishes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clientId" integer NOT NULL,
	"funnelId" integer NOT NULL,
	"externalFunnelId" varchar(120) NOT NULL,
	"resourceName" varchar(120) NOT NULL,
	"repositoryName" varchar(120) NOT NULL,
	"workerName" varchar(120) NOT NULL,
	"step" "funnel_publish_step" DEFAULT 'create_repository' NOT NULL,
	"status" "funnel_publish_status" DEFAULT 'pending' NOT NULL,
	"repositoryId" varchar(120),
	"repositoryFullName" varchar(240),
	"repositoryUrl" varchar(1000),
	"defaultBranch" varchar(120),
	"commitSha" varchar(120),
	"liveUrl" varchar(1000),
	"dispatchRequestedAt" timestamp with time zone,
	"workflowRunId" varchar(120),
	"workflowStatus" varchar(80),
	"workflowCheckedAt" timestamp with time zone,
	"leaseToken" uuid,
	"leaseUntil" timestamp with time zone,
	"lastError" text,
	"attemptCount" integer DEFAULT 0 NOT NULL,
	"completedAt" timestamp with time zone,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "funnelPublishes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "funnelPublishes" ADD CONSTRAINT "funnelPublishes_clientId_clients_id_fk" FOREIGN KEY ("clientId") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "funnelPublishes" ADD CONSTRAINT "funnelPublishes_funnelId_funnels_id_fk" FOREIGN KEY ("funnelId") REFERENCES "public"."funnels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "funnel_publishes_funnel_unique" ON "funnelPublishes" USING btree ("funnelId");--> statement-breakpoint
CREATE UNIQUE INDEX "funnel_publishes_external_funnel_unique" ON "funnelPublishes" USING btree ("externalFunnelId");--> statement-breakpoint
CREATE INDEX "funnel_publishes_status_idx" ON "funnelPublishes" USING btree ("status");--> statement-breakpoint
CREATE INDEX "funnel_publishes_lease_until_idx" ON "funnelPublishes" USING btree ("leaseUntil");