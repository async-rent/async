ALTER TABLE `rentals` RENAME COLUMN "clerk_user_id" TO "user_id";--> statement-breakpoint
DROP INDEX `rentals_clerk_user_id_idx`;--> statement-breakpoint
CREATE INDEX `rentals_user_id_idx` ON `rentals` (`user_id`);