ALTER TABLE `message_parts` ADD `started_at` integer;--> statement-breakpoint
ALTER TABLE `message_parts` ADD `completed_at` integer;--> statement-breakpoint
ALTER TABLE `message_parts` ADD `tool_name` text;--> statement-breakpoint
ALTER TABLE `message_parts` ADD `tool_call_id` text;--> statement-breakpoint
ALTER TABLE `message_parts` ADD `tool_duration_ms` integer;--> statement-breakpoint
ALTER TABLE `messages` ADD `completed_at` integer;--> statement-breakpoint
ALTER TABLE `messages` ADD `latency_ms` integer;--> statement-breakpoint
ALTER TABLE `messages` ADD `prompt_tokens` integer;--> statement-breakpoint
ALTER TABLE `messages` ADD `completion_tokens` integer;--> statement-breakpoint
ALTER TABLE `messages` ADD `total_tokens` integer;--> statement-breakpoint
ALTER TABLE `messages` ADD `error` text;--> statement-breakpoint
ALTER TABLE `sessions` ADD `last_active_at` integer;--> statement-breakpoint
ALTER TABLE `sessions` ADD `total_input_tokens` integer;--> statement-breakpoint
ALTER TABLE `sessions` ADD `total_output_tokens` integer;--> statement-breakpoint
ALTER TABLE `sessions` ADD `total_tool_time_ms` integer;--> statement-breakpoint
ALTER TABLE `sessions` ADD `tool_counts_json` text;