CREATE TYPE "public"."client_integration_reconciliation_status" AS ENUM('pending', 'ready', 'conflict');
--> statement-breakpoint
CREATE TABLE "client_integration_profiles" (
	"clientId" integer PRIMARY KEY NOT NULL,
	"profileVersion" integer DEFAULT 1 NOT NULL,
	"ghlLocationId" text,
	"googleSheetsId" text,
	"metaPixelId" text,
	"secretsEncrypted" text,
	"reconciliationStatus" "client_integration_reconciliation_status" DEFAULT 'pending' NOT NULL,
	"conflictedKeys" jsonb NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "client_integration_profiles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "client_integration_profiles" ADD CONSTRAINT "client_integration_profiles_clientId_clients_id_fk" FOREIGN KEY ("clientId") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "client_integration_profiles_updated_at_idx" ON "client_integration_profiles" USING btree ("updatedAt");
