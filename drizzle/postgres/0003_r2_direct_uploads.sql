CREATE TYPE "public"."asset_upload_kind" AS ENUM('client', 'astro');--> statement-breakpoint
CREATE TYPE "public"."asset_upload_status" AS ENUM('pending', 'completed', 'failed');--> statement-breakpoint
CREATE TABLE "assetUploadSessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clientId" integer NOT NULL,
	"assetKind" "asset_upload_kind" NOT NULL,
	"slot" varchar(80) NOT NULL,
	"originalFilename" varchar(500) NOT NULL,
	"declaredMimeType" varchar(120) NOT NULL,
	"declaredSizeBytes" integer NOT NULL,
	"tempKey" varchar(800) NOT NULL,
	"status" "asset_upload_status" DEFAULT 'pending' NOT NULL,
	"expiresAt" timestamp with time zone NOT NULL,
	"completedAt" timestamp with time zone,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "asset_upload_sessions_temp_key_unique" UNIQUE("tempKey")
);
--> statement-breakpoint
ALTER TABLE "assetUploadSessions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "assetUploadSessions" ADD CONSTRAINT "assetUploadSessions_clientId_clients_id_fk" FOREIGN KEY ("clientId") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "asset_upload_sessions_client_idx" ON "assetUploadSessions" USING btree ("clientId");--> statement-breakpoint
CREATE INDEX "asset_upload_sessions_status_idx" ON "assetUploadSessions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "asset_upload_sessions_expires_at_idx" ON "assetUploadSessions" USING btree ("expiresAt");