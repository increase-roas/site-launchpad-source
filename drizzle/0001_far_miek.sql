CREATE TABLE `clientAssets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`clientId` int NOT NULL,
	`slot` enum('logo','hero','hotTubs','swimSpas','showroom','product','delivery') NOT NULL,
	`storageKey` varchar(800) NOT NULL,
	`storageUrl` varchar(1000) NOT NULL,
	`filename` varchar(240) NOT NULL,
	`originalFilename` varchar(500) NOT NULL,
	`mimeType` varchar(120) NOT NULL,
	`byteSize` int NOT NULL,
	`width` int NOT NULL,
	`height` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `clientAssets_id` PRIMARY KEY(`id`),
	CONSTRAINT `client_assets_client_slot_unique` UNIQUE(`clientId`,`slot`)
);
--> statement-breakpoint
CREATE TABLE `clientSecretSetups` (
	`id` int AUTO_INCREMENT NOT NULL,
	`clientId` int NOT NULL,
	`metaPixelIdEncrypted` text,
	`ga4MeasurementIdEncrypted` text,
	`clarityIdEncrypted` text,
	`ghlApiKeyEncrypted` text,
	`cloudflareProjectNameEncrypted` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `clientSecretSetups_id` PRIMARY KEY(`id`),
	CONSTRAINT `client_secret_setups_client_unique` UNIQUE(`clientId`)
);
--> statement-breakpoint
CREATE TABLE `clients` (
	`id` int AUTO_INCREMENT NOT NULL,
	`businessName` varchar(160) NOT NULL,
	`shortName` varchar(80) NOT NULL,
	`phone` varchar(24) NOT NULL,
	`email` varchar(320) NOT NULL,
	`streetAddress` varchar(240) NOT NULL,
	`city` varchar(120) NOT NULL,
	`state` varchar(120) NOT NULL,
	`postalCode` varchar(24) NOT NULL,
	`country` varchar(120) NOT NULL,
	`websiteUrl` varchar(500) NOT NULL,
	`foundedYear` int NOT NULL,
	`tagline` varchar(240) NOT NULL,
	`theme` enum('aqua','luxury','natural') NOT NULL,
	`businessHours` json NOT NULL,
	`facebookUrl` varchar(500) NOT NULL,
	`googleMapsUrl` varchar(1000) NOT NULL,
	`productCategories` json NOT NULL,
	`primaryOffer` text NOT NULL,
	`financingPromise` text NOT NULL,
	`deliveryPromise` text NOT NULL,
	`status` enum('draft','ready','live','issue') NOT NULL DEFAULT 'draft',
	`readyAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `clients_id` PRIMARY KEY(`id`),
	CONSTRAINT `clients_short_name_unique` UNIQUE(`shortName`)
);
--> statement-breakpoint
ALTER TABLE `clientAssets` ADD CONSTRAINT `clientAssets_clientId_clients_id_fk` FOREIGN KEY (`clientId`) REFERENCES `clients`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `clientSecretSetups` ADD CONSTRAINT `clientSecretSetups_clientId_clients_id_fk` FOREIGN KEY (`clientId`) REFERENCES `clients`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `client_assets_client_idx` ON `clientAssets` (`clientId`);--> statement-breakpoint
CREATE INDEX `clients_status_idx` ON `clients` (`status`);--> statement-breakpoint
CREATE INDEX `clients_updated_at_idx` ON `clients` (`updatedAt`);