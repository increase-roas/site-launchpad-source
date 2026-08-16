ALTER TABLE "users" DROP CONSTRAINT "users_openId_unique";--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "authUserId" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "openId";--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_authUserId_unique" UNIQUE("authUserId");