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
	`step_index` integer,
	`type` text NOT NULL,
	`content` text NOT NULL,
	`agent` text NOT NULL,
	`provider` text NOT NULL,
	`model` text NOT NULL,
	`started_at` integer,
	`completed_at` integer,
	`compacted_at` integer,
	`tool_name` text,
	`tool_call_id` text,
	`tool_duration_ms` integer,
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
	`completed_at` integer,
	`latency_ms` integer,
	`prompt_tokens` integer,
	`completion_tokens` integer,
	`total_tokens` integer,
	`cached_input_tokens` integer,
	`cache_creation_input_tokens` integer,
	`reasoning_tokens` integer,
	`error` text,
	`error_type` text,
	`error_details` text,
	`is_aborted` integer,
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
	`created_at` integer NOT NULL,
	`last_active_at` integer,
	`total_input_tokens` integer,
	`total_output_tokens` integer,
	`total_cached_tokens` integer,
	`total_cache_creation_tokens` integer,
	`total_reasoning_tokens` integer,
	`total_tool_time_ms` integer,
	`tool_counts_json` text,
	`current_context_tokens` integer,
	`context_summary` text,
	`last_compacted_at` integer,
	`parent_session_id` text,
	`branch_point_message_id` text,
	`session_type` text DEFAULT 'main'
);
--> statement-breakpoint
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