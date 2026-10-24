CREATE TABLE `billing_agreements` (
	`id` text PRIMARY KEY NOT NULL,
	`rental_id` text NOT NULL,
	`provider` text NOT NULL,
	`provider_agreement_id` text,
	`interval` text DEFAULT 'weekly' NOT NULL,
	`currency` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`next_charge_at` integer,
	`cancelled_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer,
	FOREIGN KEY (`rental_id`) REFERENCES `rentals`(`id`) ON UPDATE cascade ON DELETE cascade,
	CONSTRAINT "billing_agreements_provider_check" CHECK("billing_agreements"."provider" in ('paypal')),
	CONSTRAINT "billing_agreements_interval_check" CHECK("billing_agreements"."interval" in ('weekly')),
	CONSTRAINT "billing_agreements_status_check" CHECK("billing_agreements"."status" in ('active', 'paused', 'cancelled', 'completed')),
	CONSTRAINT "billing_agreements_currency_check" CHECK(length("billing_agreements"."currency") = 3 and "billing_agreements"."currency" glob '[A-Z][A-Z][A-Z]')
);
--> statement-breakpoint
CREATE INDEX `billing_agreements_rental_id_idx` ON `billing_agreements` (`rental_id`);--> statement-breakpoint
CREATE INDEX `billing_agreements_status_next_charge_at_idx` ON `billing_agreements` (`status`,`next_charge_at`);--> statement-breakpoint
CREATE TABLE `cart_items` (
	`cart_id` text NOT NULL,
	`position` integer NOT NULL,
	`product_id` text NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`image_url` text,
	`image_alt` text,
	`quantity` integer DEFAULT 1 NOT NULL,
	`weekly_price` integer NOT NULL,
	`deposit` integer,
	PRIMARY KEY(`cart_id`, `position`),
	FOREIGN KEY (`cart_id`) REFERENCES `carts`(`id`) ON UPDATE cascade ON DELETE cascade,
	CONSTRAINT "cart_items_position_check" CHECK("cart_items"."position" >= 0),
	CONSTRAINT "cart_items_quantity_check" CHECK("cart_items"."quantity" > 0),
	CONSTRAINT "cart_items_weekly_price_check" CHECK("cart_items"."weekly_price" >= 0),
	CONSTRAINT "cart_items_deposit_check" CHECK("cart_items"."deposit" is null or "cart_items"."deposit" >= 0)
);
--> statement-breakpoint
CREATE INDEX `cart_items_product_id_idx` ON `cart_items` (`product_id`);--> statement-breakpoint
CREATE TABLE `carts` (
	`id` text PRIMARY KEY NOT NULL,
	`customer_id` text,
	`location_slug` text NOT NULL,
	`currency` text NOT NULL,
	`weekly_subtotal` integer DEFAULT 0 NOT NULL,
	`deposit` integer DEFAULT 0 NOT NULL,
	`delivery_fee` integer DEFAULT 0 NOT NULL,
	`discount` integer DEFAULT 0 NOT NULL,
	`total_due_today` integer DEFAULT 0 NOT NULL,
	`recurring_weekly` integer DEFAULT 0 NOT NULL,
	`expires_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer,
	FOREIGN KEY (`location_slug`) REFERENCES `locations`(`slug`) ON UPDATE cascade ON DELETE restrict,
	CONSTRAINT "carts_currency_check" CHECK(length("carts"."currency") = 3 and "carts"."currency" glob '[A-Z][A-Z][A-Z]'),
	CONSTRAINT "carts_weekly_subtotal_check" CHECK("carts"."weekly_subtotal" >= 0),
	CONSTRAINT "carts_deposit_check" CHECK("carts"."deposit" >= 0),
	CONSTRAINT "carts_delivery_fee_check" CHECK("carts"."delivery_fee" >= 0),
	CONSTRAINT "carts_discount_check" CHECK("carts"."discount" >= 0),
	CONSTRAINT "carts_total_due_today_check" CHECK("carts"."total_due_today" >= 0),
	CONSTRAINT "carts_recurring_weekly_check" CHECK("carts"."recurring_weekly" >= 0)
);
--> statement-breakpoint
CREATE INDEX `carts_customer_id_idx` ON `carts` (`customer_id`);--> statement-breakpoint
CREATE INDEX `carts_location_slug_idx` ON `carts` (`location_slug`);--> statement-breakpoint
CREATE INDEX `carts_expires_at_idx` ON `carts` (`expires_at`);--> statement-breakpoint
CREATE TABLE `payments` (
	`id` text PRIMARY KEY NOT NULL,
	`rental_id` text NOT NULL,
	`billing_agreement_id` text,
	`billing_cycle` integer NOT NULL,
	`provider` text NOT NULL,
	`external_order_id` text NOT NULL,
	`external_payment_id` text,
	`amount` integer NOT NULL,
	`currency` text NOT NULL,
	`status` text NOT NULL,
	`paid_at` integer,
	`failure_reason` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer,
	FOREIGN KEY (`rental_id`) REFERENCES `rentals`(`id`) ON UPDATE cascade ON DELETE restrict,
	FOREIGN KEY (`billing_agreement_id`) REFERENCES `billing_agreements`(`id`) ON UPDATE cascade ON DELETE restrict,
	CONSTRAINT "payments_billing_cycle_check" CHECK("payments"."billing_cycle" > 0),
	CONSTRAINT "payments_provider_check" CHECK("payments"."provider" in ('paypal')),
	CONSTRAINT "payments_status_check" CHECK("payments"."status" in ('pending', 'authorized', 'succeeded', 'failed', 'refunded')),
	CONSTRAINT "payments_currency_check" CHECK(length("payments"."currency") = 3 and "payments"."currency" glob '[A-Z][A-Z][A-Z]'),
	CONSTRAINT "payments_amount_check" CHECK("payments"."amount" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `payments_rental_id_billing_cycle_unique` ON `payments` (`rental_id`,`billing_cycle`);--> statement-breakpoint
CREATE INDEX `payments_billing_agreement_id_idx` ON `payments` (`billing_agreement_id`);--> statement-breakpoint
CREATE INDEX `payments_status_idx` ON `payments` (`status`);--> statement-breakpoint
CREATE TABLE `rental_items` (
	`rental_id` text NOT NULL,
	`position` integer NOT NULL,
	`product_id` text NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`image_url` text,
	`image_alt` text,
	`quantity` integer DEFAULT 1 NOT NULL,
	`weekly_price` integer NOT NULL,
	`deposit` integer,
	PRIMARY KEY(`rental_id`, `position`),
	FOREIGN KEY (`rental_id`) REFERENCES `rentals`(`id`) ON UPDATE cascade ON DELETE cascade,
	CONSTRAINT "rental_items_position_check" CHECK("rental_items"."position" >= 0),
	CONSTRAINT "rental_items_quantity_check" CHECK("rental_items"."quantity" > 0),
	CONSTRAINT "rental_items_weekly_price_check" CHECK("rental_items"."weekly_price" >= 0),
	CONSTRAINT "rental_items_deposit_check" CHECK("rental_items"."deposit" is null or "rental_items"."deposit" >= 0)
);
--> statement-breakpoint
CREATE INDEX `rental_items_product_id_idx` ON `rental_items` (`product_id`);--> statement-breakpoint
CREATE TABLE `rentals` (
	`id` text PRIMARY KEY NOT NULL,
	`number` text NOT NULL,
	`clerk_user_id` text,
	`contact_name` text NOT NULL,
	`contact_email` text NOT NULL,
	`contact_whatsapp` text,
	`address_line1` text NOT NULL,
	`address_line2` text,
	`address_area` text,
	`address_city` text NOT NULL,
	`address_postcode` text,
	`address_country_code` text NOT NULL,
	`delivery_notes` text,
	`location_slug` text NOT NULL,
	`currency` text NOT NULL,
	`start_date` text NOT NULL,
	`end_date` text,
	`delivery_date` text,
	`delivery_window_start` text,
	`delivery_window_end` text,
	`status` text DEFAULT 'pending_payment' NOT NULL,
	`fulfillment_status` text,
	`weekly_subtotal` integer DEFAULT 0 NOT NULL,
	`deposit` integer DEFAULT 0 NOT NULL,
	`delivery_fee` integer DEFAULT 0 NOT NULL,
	`discount` integer DEFAULT 0 NOT NULL,
	`total_due_today` integer DEFAULT 0 NOT NULL,
	`recurring_weekly` integer DEFAULT 0 NOT NULL,
	`billing_agreement_id` text,
	`payment_status_snapshot` text,
	`terms_accepted_at` integer,
	`cancelled_at` integer,
	`notes` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer,
	FOREIGN KEY (`location_slug`) REFERENCES `locations`(`slug`) ON UPDATE cascade ON DELETE restrict,
	CONSTRAINT "rentals_status_check" CHECK("rentals"."status" in ('pending_payment', 'confirmed', 'active', 'completed', 'cancelled')),
	CONSTRAINT "rentals_fulfillment_status_check" CHECK("rentals"."fulfillment_status" is null or "rentals"."fulfillment_status" in ('scheduled', 'in_transit', 'delivered', 'returned')),
	CONSTRAINT "rentals_payment_status_snapshot_check" CHECK("rentals"."payment_status_snapshot" is null or "rentals"."payment_status_snapshot" in ('pending', 'authorized', 'succeeded', 'failed', 'refunded')),
	CONSTRAINT "rentals_currency_check" CHECK(length("rentals"."currency") = 3 and "rentals"."currency" glob '[A-Z][A-Z][A-Z]'),
	CONSTRAINT "rentals_weekly_subtotal_check" CHECK("rentals"."weekly_subtotal" >= 0),
	CONSTRAINT "rentals_deposit_check" CHECK("rentals"."deposit" >= 0),
	CONSTRAINT "rentals_delivery_fee_check" CHECK("rentals"."delivery_fee" >= 0),
	CONSTRAINT "rentals_discount_check" CHECK("rentals"."discount" >= 0),
	CONSTRAINT "rentals_total_due_today_check" CHECK("rentals"."total_due_today" >= 0),
	CONSTRAINT "rentals_recurring_weekly_check" CHECK("rentals"."recurring_weekly" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `rentals_number_unique` ON `rentals` (`number`);--> statement-breakpoint
CREATE INDEX `rentals_clerk_user_id_idx` ON `rentals` (`clerk_user_id`);--> statement-breakpoint
CREATE INDEX `rentals_location_slug_idx` ON `rentals` (`location_slug`);--> statement-breakpoint
CREATE INDEX `rentals_status_created_at_idx` ON `rentals` (`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `rentals_billing_agreement_id_idx` ON `rentals` (`billing_agreement_id`);