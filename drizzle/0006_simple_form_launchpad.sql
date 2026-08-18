ALTER TABLE `clients` MODIFY `phone` varchar(24) NULL;
--> statement-breakpoint
ALTER TABLE `clients` MODIFY `email` varchar(320) NULL;
--> statement-breakpoint
ALTER TABLE `clients` MODIFY `streetAddress` varchar(240) NULL;
--> statement-breakpoint
ALTER TABLE `clients` MODIFY `city` varchar(120) NULL;
--> statement-breakpoint
ALTER TABLE `clients` MODIFY `state` varchar(120) NULL;
--> statement-breakpoint
ALTER TABLE `clients` MODIFY `postalCode` varchar(24) NULL;
--> statement-breakpoint
ALTER TABLE `clients` MODIFY `websiteUrl` varchar(500) NULL;
--> statement-breakpoint
ALTER TABLE `clients` MODIFY `foundedYear` int NULL;
--> statement-breakpoint
ALTER TABLE `clients` MODIFY `tagline` varchar(240) NULL;
--> statement-breakpoint
ALTER TABLE `clients` MODIFY `facebookUrl` varchar(500) NULL;
--> statement-breakpoint
ALTER TABLE `clients` MODIFY `googleMapsUrl` varchar(1000) NULL;
--> statement-breakpoint
ALTER TABLE `clients` MODIFY `primaryOffer` text NULL;
--> statement-breakpoint
ALTER TABLE `clients` MODIFY `financingPromise` text NULL;
--> statement-breakpoint
ALTER TABLE `clients` MODIFY `deliveryPromise` text NULL;
--> statement-breakpoint
ALTER TABLE `funnels` ADD `templateKey` varchar(80);
--> statement-breakpoint
ALTER TABLE `funnels` ADD `templateRepo` varchar(240);
--> statement-breakpoint
ALTER TABLE `funnels` ADD `contractVersion` int;
--> statement-breakpoint
CREATE UNIQUE INDEX `funnels_client_template_unique` ON `funnels` (`clientId`,`templateKey`);
--> statement-breakpoint
CREATE TABLE `funnelSimpleFormConfigs` (
	`funnelId` int NOT NULL,
	`configJson` json NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `funnelSimpleFormConfigs_funnelId` PRIMARY KEY(`funnelId`)
);
--> statement-breakpoint
ALTER TABLE `funnelSimpleFormConfigs` ADD CONSTRAINT `funnelSimpleFormConfigs_funnelId_funnels_id_fk` FOREIGN KEY (`funnelId`) REFERENCES `funnels`(`id`) ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE TABLE `funnelRuntimeSecrets` (
	`funnelId` int NOT NULL,
	`metaCapiAccessTokenEncrypted` text,
	`metaTestEventCodeEncrypted` text,
	`ghlWebhookUrlEncrypted` text,
	`crmCallbackSecretEncrypted` text,
	`submissionAlertWebhookUrlEncrypted` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `funnelRuntimeSecrets_funnelId` PRIMARY KEY(`funnelId`)
);
--> statement-breakpoint
ALTER TABLE `funnelRuntimeSecrets` ADD CONSTRAINT `funnelRuntimeSecrets_funnelId_funnels_id_fk` FOREIGN KEY (`funnelId`) REFERENCES `funnels`(`id`) ON DELETE cascade ON UPDATE no action;
