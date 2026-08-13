CREATE TABLE `astroClientConfigs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`clientId` int NOT NULL,
	`socialLinks` json NOT NULL,
	`fonts` json NOT NULL,
	`borderRadii` json NOT NULL,
	`navigationItems` json NOT NULL,
	`categories` json NOT NULL,
	`financing` json NOT NULL,
	`homepageSections` json NOT NULL,
	`integrations` json NOT NULL,
	`generatedConfigEncrypted` text,
	`generatedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `astroClientConfigs_id` PRIMARY KEY(`id`),
	CONSTRAINT `astro_client_configs_client_unique` UNIQUE(`clientId`)
);
--> statement-breakpoint
CREATE TABLE `wranglerSecretSetups` (
	`id` int AUTO_INCREMENT NOT NULL,
	`clientId` int NOT NULL,
	`ghlApiKeyEncrypted` text,
	`ghlLocationIdEncrypted` text,
	`metaPixelIdEncrypted` text,
	`metaCapiAccessTokenEncrypted` text,
	`metaValueQualifiedEncrypted` text,
	`metaValueScheduleEncrypted` text,
	`metaValueShowedEncrypted` text,
	`stageWebhookSecretEncrypted` text,
	`googleSheetsIdEncrypted` text,
	`googleServiceAccountEmailEncrypted` text,
	`googleServiceAccountPrivateKeyEncrypted` text,
	`alertWebhookUrlEncrypted` text,
	`adminPasswordEncrypted` text,
	`adminSessionSecretEncrypted` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `wranglerSecretSetups_id` PRIMARY KEY(`id`),
	CONSTRAINT `wrangler_secret_setups_client_unique` UNIQUE(`clientId`)
);
--> statement-breakpoint
ALTER TABLE `clientAssets` MODIFY COLUMN `slot` enum('logo','hero','hotTubs','swimSpas','showroom','product','delivery','navLogo','footerLogo','inventoryLogo','favicon','ogImage','categoryHotTubs','categorySwimSpas','categorySaunas','categoryColdPlunge','categoryMassageChairs') NOT NULL;--> statement-breakpoint
ALTER TABLE `clients` MODIFY COLUMN `country` varchar(120) NOT NULL DEFAULT 'US';--> statement-breakpoint
ALTER TABLE `clients` MODIFY COLUMN `theme` enum('aqua','luxury','natural','mono') NOT NULL;--> statement-breakpoint
ALTER TABLE `clients` ADD `smsPhone` varchar(24);--> statement-breakpoint
ALTER TABLE `clients` ADD `phoneDisplayOverride` varchar(80);--> statement-breakpoint
ALTER TABLE `clients` ADD `street2` varchar(240);--> statement-breakpoint
ALTER TABLE `clients` ADD `latitude` varchar(32);--> statement-breakpoint
ALTER TABLE `clients` ADD `longitude` varchar(32);--> statement-breakpoint
ALTER TABLE `clients` ADD `googlePlaceId` varchar(300);--> statement-breakpoint
ALTER TABLE `clients` ADD `schemaType` enum('HomeAndConstructionBusiness','Store','LocalBusiness') DEFAULT 'HomeAndConstructionBusiness' NOT NULL;--> statement-breakpoint
ALTER TABLE `astroClientConfigs` ADD CONSTRAINT `astroClientConfigs_clientId_clients_id_fk` FOREIGN KEY (`clientId`) REFERENCES `clients`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `wranglerSecretSetups` ADD CONSTRAINT `wranglerSecretSetups_clientId_clients_id_fk` FOREIGN KEY (`clientId`) REFERENCES `clients`(`id`) ON DELETE cascade ON UPDATE no action;