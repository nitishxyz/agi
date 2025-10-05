ALTER TABLE `messages` ADD `error_type` text;--> statement-breakpoint
ALTER TABLE `messages` ADD `error_details` text;--> statement-breakpoint
ALTER TABLE `messages` ADD `is_aborted` integer;