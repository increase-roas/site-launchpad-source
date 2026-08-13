CREATE TABLE `funnelConfigs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`funnelId` int NOT NULL,
	`serviceArea` varchar(500) NOT NULL,
	`offerHeadline` varchar(300) NOT NULL,
	`offerSubheadline` text NOT NULL,
	`thankYouMessage` text NOT NULL,
	`generatedConfigEncrypted` text,
	`generatedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `funnelConfigs_id` PRIMARY KEY(`id`),
	CONSTRAINT `funnel_configs_funnel_unique` UNIQUE(`funnelId`)
);
--> statement-breakpoint
CREATE TABLE `funnelSurveyQuestions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`funnelId` int NOT NULL,
	`position` int NOT NULL,
	`questionText` varchar(500) NOT NULL,
	`questionType` enum('radio','checkbox','text') NOT NULL,
	`options` json NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `funnelSurveyQuestions_id` PRIMARY KEY(`id`),
	CONSTRAINT `funnel_survey_questions_position_unique` UNIQUE(`funnelId`,`position`)
);
--> statement-breakpoint
ALTER TABLE `clientSecretSetups` ADD `ghlWebhookUrlEncrypted` text;--> statement-breakpoint
ALTER TABLE `funnels` ADD `deploymentStatus` enum('draft','ready','deployed') DEFAULT 'draft' NOT NULL;--> statement-breakpoint
ALTER TABLE `funnels` ADD `readyAt` timestamp;--> statement-breakpoint
ALTER TABLE `funnels` ADD `deployedAt` timestamp;--> statement-breakpoint
ALTER TABLE `funnelConfigs` ADD CONSTRAINT `funnelConfigs_funnelId_funnels_id_fk` FOREIGN KEY (`funnelId`) REFERENCES `funnels`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `funnelSurveyQuestions` ADD CONSTRAINT `funnelSurveyQuestions_funnelId_funnels_id_fk` FOREIGN KEY (`funnelId`) REFERENCES `funnels`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `funnel_survey_questions_funnel_idx` ON `funnelSurveyQuestions` (`funnelId`);