ALTER TABLE `messages` ADD `cached_input_tokens` integer;--> statement-breakpoint
ALTER TABLE `messages` ADD `reasoning_tokens` integer;--> statement-breakpoint
ALTER TABLE `sessions` ADD `total_cached_tokens` integer;--> statement-breakpoint
ALTER TABLE `sessions` ADD `total_reasoning_tokens` integer;