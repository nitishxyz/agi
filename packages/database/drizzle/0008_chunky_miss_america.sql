ALTER TABLE `messages` ADD `cache_creation_input_tokens` integer;--> statement-breakpoint
ALTER TABLE `sessions` ADD `total_cache_creation_tokens` integer;