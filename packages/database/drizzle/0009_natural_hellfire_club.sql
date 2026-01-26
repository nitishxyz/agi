CREATE TABLE `shares` (
	`session_id` text PRIMARY KEY NOT NULL,
	`share_id` text NOT NULL,
	`secret` text NOT NULL,
	`url` text NOT NULL,
	`title` text,
	`description` text,
	`created_at` integer NOT NULL,
	`last_synced_at` integer NOT NULL,
	`last_synced_message_id` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `shares_share_id_unique` ON `shares` (`share_id`);