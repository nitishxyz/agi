ALTER TABLE `sessions` ADD `parent_session_id` text;--> statement-breakpoint
ALTER TABLE `sessions` ADD `branch_point_message_id` text;--> statement-breakpoint
ALTER TABLE `sessions` ADD `session_type` text DEFAULT 'main';