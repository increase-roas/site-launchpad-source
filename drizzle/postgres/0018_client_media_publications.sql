CREATE TABLE "clientMediaPublications" (
	"id" serial PRIMARY KEY NOT NULL,
	"clientId" integer NOT NULL,
	"mediaItemId" integer,
	"destinationBucket" varchar(120) NOT NULL,
	"draftStorageKey" varchar(800) NOT NULL,
	"publishedKey" varchar(800) NOT NULL,
	"publishedUrl" varchar(1000) NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "clientMediaPublications" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "clientMediaPublications" ADD CONSTRAINT "clientMediaPublications_clientId_clients_id_fk" FOREIGN KEY ("clientId") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clientMediaPublications" ADD CONSTRAINT "clientMediaPublications_mediaItemId_clientMediaItems_id_fk" FOREIGN KEY ("mediaItemId") REFERENCES "public"."clientMediaItems"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "client_media_publications_destination_draft_unique" ON "clientMediaPublications" USING btree ("clientId","destinationBucket","draftStorageKey");--> statement-breakpoint
CREATE INDEX "client_media_publications_client_idx" ON "clientMediaPublications" USING btree ("clientId");--> statement-breakpoint
CREATE INDEX "client_media_publications_media_item_idx" ON "clientMediaPublications" USING btree ("mediaItemId");
