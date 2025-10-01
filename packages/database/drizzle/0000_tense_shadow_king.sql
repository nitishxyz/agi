CREATE TABLE `artifacts` (
	`id` text PRIMARY KEY NOT NULL,
	`message_part_id` text,
	`kind` text NOT NULL,
	`path` text,
	`mime` text,
	`size` integer,
	`sha256` text,
	FOREIGN KEY (`message_part_id`) REFERENCES `message_parts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `artifacts_message_part_id_unique` ON `artifacts` (`message_part_id`);--> statement-breakpoint
CREATE TABLE `message_parts` (
	`id` text PRIMARY KEY NOT NULL,
	`message_id` text NOT NULL,
	`index` integer NOT NULL,
	`type` text NOT NULL,
	`content` text NOT NULL,
	`agent` text NOT NULL,
	`provider` text NOT NULL,
	`model` text NOT NULL,
	FOREIGN KEY (`message_id`) REFERENCES `messages`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `messages` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`role` text NOT NULL,
	`status` text NOT NULL,
	`agent` text NOT NULL,
	`provider` text NOT NULL,
	`model` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text,
	`agent` text NOT NULL,
	`provider` text NOT NULL,
	`model` text NOT NULL,
	`project_path` text NOT NULL,
	`created_at` integer NOT NULL
);
