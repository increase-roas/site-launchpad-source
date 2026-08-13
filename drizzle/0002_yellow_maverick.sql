CREATE TABLE `funnelSteps` (
	`id` int AUTO_INCREMENT NOT NULL,
	`funnelId` int NOT NULL,
	`stepType` enum('zip','survey','contact','book','thankYou') NOT NULL,
	`position` int NOT NULL,
	`title` varchar(160) NOT NULL,
	`path` varchar(500) NOT NULL,
	`capturedFields` json NOT NULL,
	`trackingActions` json NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `funnelSteps_id` PRIMARY KEY(`id`),
	CONSTRAINT `funnel_steps_funnel_position_unique` UNIQUE(`funnelId`,`position`)
);
--> statement-breakpoint
CREATE TABLE `funnels` (
	`id` int AUTO_INCREMENT NOT NULL,
	`clientId` int NOT NULL,
	`name` varchar(160) NOT NULL,
	`slug` varchar(240) NOT NULL,
	`shape` enum('A','B','C') NOT NULL,
	`status` enum('draft','ready','live','issue') NOT NULL DEFAULT 'draft',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `funnels_id` PRIMARY KEY(`id`),
	CONSTRAINT `funnels_client_slug_unique` UNIQUE(`clientId`,`slug`)
);
--> statement-breakpoint
CREATE TABLE `homepageSections` (
	`id` int AUTO_INCREMENT NOT NULL,
	`clientId` int NOT NULL,
	`sectionType` enum('hero','categories','visitShowroom','deliveryInstall','testimonials','financing','faq','contact','map') NOT NULL,
	`position` int NOT NULL,
	`enabled` int NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `homepageSections_id` PRIMARY KEY(`id`),
	CONSTRAINT `homepage_sections_client_type_unique` UNIQUE(`clientId`,`sectionType`),
	CONSTRAINT `homepage_sections_client_position_unique` UNIQUE(`clientId`,`position`)
);
--> statement-breakpoint
CREATE TABLE `sitePages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`clientId` int NOT NULL,
	`pageType` enum('homepage','inventory','categories','visitUs','financing') NOT NULL,
	`title` varchar(160) NOT NULL,
	`slug` varchar(240) NOT NULL,
	`description` varchar(500) NOT NULL,
	`status` enum('draft','ready','live','issue') NOT NULL DEFAULT 'draft',
	`enabled` int NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `sitePages_id` PRIMARY KEY(`id`),
	CONSTRAINT `site_pages_client_type_unique` UNIQUE(`clientId`,`pageType`)
);
--> statement-breakpoint
ALTER TABLE `funnelSteps` ADD CONSTRAINT `funnelSteps_funnelId_funnels_id_fk` FOREIGN KEY (`funnelId`) REFERENCES `funnels`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `funnels` ADD CONSTRAINT `funnels_clientId_clients_id_fk` FOREIGN KEY (`clientId`) REFERENCES `clients`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `homepageSections` ADD CONSTRAINT `homepageSections_clientId_clients_id_fk` FOREIGN KEY (`clientId`) REFERENCES `clients`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sitePages` ADD CONSTRAINT `sitePages_clientId_clients_id_fk` FOREIGN KEY (`clientId`) REFERENCES `clients`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `funnel_steps_funnel_idx` ON `funnelSteps` (`funnelId`);--> statement-breakpoint
CREATE INDEX `funnels_client_idx` ON `funnels` (`clientId`);--> statement-breakpoint
CREATE INDEX `homepage_sections_client_idx` ON `homepageSections` (`clientId`);--> statement-breakpoint
CREATE INDEX `site_pages_client_idx` ON `sitePages` (`clientId`);