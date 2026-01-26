CREATE TABLE `shared_sessions` (
	`share_id` text PRIMARY KEY NOT NULL,
	`secret` text NOT NULL,
	`title` text,
	`description` text,
	`session_data` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`expires_at` integer,
	`view_count` integer DEFAULT 0,
	`last_synced_message_id` text NOT NULL
);
