CREATE TABLE "clientLeadIntegrations" (
	"clientId" integer PRIMARY KEY NOT NULL,
	"ghlLocationId" text,
	"googleSheetsId" text,
	"metaPixelId" text,
	"ghlApiKeyEncrypted" text,
	"metaCapiAccessTokenEncrypted" text,
	"stageWebhookSecretEncrypted" text,
	"alertWebhookUrlEncrypted" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "clientLeadIntegrations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "clientLeadIntegrations" ADD CONSTRAINT "clientLeadIntegrations_clientId_clients_id_fk" FOREIGN KEY ("clientId") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "client_lead_integrations_updated_at_idx" ON "clientLeadIntegrations" USING btree ("updatedAt");