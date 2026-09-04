ALTER TYPE "public"."asset_upload_kind" ADD VALUE 'library';--> statement-breakpoint
CREATE TABLE "clientMediaItems" (
	"id" serial PRIMARY KEY NOT NULL,
	"clientId" integer NOT NULL,
	"storageKey" varchar(800) NOT NULL,
	"storageUrl" varchar(1000) NOT NULL,
	"filename" varchar(240) NOT NULL,
	"originalFilename" varchar(500) NOT NULL,
	"mimeType" varchar(120) NOT NULL,
	"byteSize" integer NOT NULL,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"alt" varchar(240) DEFAULT '' NOT NULL,
	"description" varchar(2000) DEFAULT '' NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "clientMediaItems" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "clientMediaItems" ADD CONSTRAINT "clientMediaItems_clientId_clients_id_fk" FOREIGN KEY ("clientId") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "client_media_items_storage_key_unique" ON "clientMediaItems" USING btree ("storageKey");--> statement-breakpoint
CREATE INDEX "client_media_items_client_idx" ON "clientMediaItems" USING btree ("clientId");--> statement-breakpoint
INSERT INTO "clientMediaItems" (
	"clientId",
	"storageKey",
	"storageUrl",
	"filename",
	"originalFilename",
	"mimeType",
	"byteSize",
	"width",
	"height",
	"alt",
	"description",
	"createdAt",
	"updatedAt"
)
SELECT
	"clientId",
	"storageKey",
	"storageUrl",
	"filename",
	"originalFilename",
	"mimeType",
	"byteSize",
	"width",
	"height",
	'',
	'',
	"createdAt",
	"updatedAt"
FROM "clientAssets";
--> statement-breakpoint
ALTER TABLE "clientAssets" ADD COLUMN "mediaItemId" integer;--> statement-breakpoint
UPDATE "clientAssets" AS asset
SET "mediaItemId" = item.id
FROM "clientMediaItems" AS item
WHERE item."storageKey" = asset."storageKey";--> statement-breakpoint
ALTER TABLE "clientAssets" ADD CONSTRAINT "clientAssets_mediaItemId_clientMediaItems_id_fk" FOREIGN KEY ("mediaItemId") REFERENCES "public"."clientMediaItems"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "client_assets_media_item_idx" ON "clientAssets" USING btree ("mediaItemId");
