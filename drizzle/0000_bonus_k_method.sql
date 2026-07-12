CREATE TABLE `videos` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`filename` text NOT NULL,
	`content_type` text NOT NULL,
	`size` integer NOT NULL,
	`object_key` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `videos_object_key_unique` ON `videos` (`object_key`);
--> statement-breakpoint
CREATE INDEX `videos_created_at_idx` ON `videos` (`created_at`);
