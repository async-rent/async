CREATE TABLE `categories` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer,
	CONSTRAINT "categories_sort_order_check" CHECK("categories"."sort_order" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `categories_slug_unique` ON `categories` (`slug`);--> statement-breakpoint
CREATE TABLE `locations` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`country` text NOT NULL,
	`timezone` text NOT NULL,
	`description` text,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer,
	CONSTRAINT "locations_status_check" CHECK("locations"."status" in ('active', 'coming_soon'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `locations_slug_unique` ON `locations` (`slug`);--> statement-breakpoint
CREATE INDEX `locations_status_idx` ON `locations` (`status`);--> statement-breakpoint
CREATE TABLE `product_highlights` (
	`product_id` text NOT NULL,
	`position` integer NOT NULL,
	`value` text NOT NULL,
	PRIMARY KEY(`product_id`, `position`),
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE cascade ON DELETE cascade,
	CONSTRAINT "product_highlights_position_check" CHECK("product_highlights"."position" >= 0)
);
--> statement-breakpoint
CREATE TABLE `product_images` (
	`product_id` text NOT NULL,
	`position` integer NOT NULL,
	`url` text NOT NULL,
	`alt` text,
	PRIMARY KEY(`product_id`, `position`),
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE cascade ON DELETE cascade,
	CONSTRAINT "product_images_position_check" CHECK("product_images"."position" >= 0)
);
--> statement-breakpoint
CREATE TABLE `product_prices` (
	`product_id` text NOT NULL,
	`location_id` text NOT NULL,
	`currency` text NOT NULL,
	`weekly_price` integer NOT NULL,
	`deposit` integer,
	`delivery_fee` integer,
	`stock` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer,
	PRIMARY KEY(`product_id`, `location_id`),
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`location_id`) REFERENCES `locations`(`id`) ON UPDATE cascade ON DELETE restrict,
	CONSTRAINT "product_prices_currency_check" CHECK(length("product_prices"."currency") = 3 and "product_prices"."currency" glob '[A-Z][A-Z][A-Z]'),
	CONSTRAINT "product_prices_weekly_price_check" CHECK("product_prices"."weekly_price" >= 0),
	CONSTRAINT "product_prices_deposit_check" CHECK("product_prices"."deposit" is null or "product_prices"."deposit" >= 0),
	CONSTRAINT "product_prices_delivery_fee_check" CHECK("product_prices"."delivery_fee" is null or "product_prices"."delivery_fee" >= 0),
	CONSTRAINT "product_prices_stock_check" CHECK("product_prices"."stock" is null or "product_prices"."stock" >= 0)
);
--> statement-breakpoint
CREATE INDEX `product_prices_location_id_idx` ON `product_prices` (`location_id`);--> statement-breakpoint
CREATE TABLE `product_specs` (
	`product_id` text NOT NULL,
	`position` integer NOT NULL,
	`label` text NOT NULL,
	`value` text NOT NULL,
	PRIMARY KEY(`product_id`, `position`),
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE cascade ON DELETE cascade,
	CONSTRAINT "product_specs_position_check" CHECK("product_specs"."position" >= 0)
);
--> statement-breakpoint
CREATE TABLE `products` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`tagline` text NOT NULL,
	`description` text NOT NULL,
	`category_id` text NOT NULL,
	`badge` text,
	`featured` integer DEFAULT false NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE cascade ON DELETE restrict,
	CONSTRAINT "products_status_check" CHECK("products"."status" in ('active', 'archived'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `products_slug_unique` ON `products` (`slug`);--> statement-breakpoint
CREATE INDEX `products_category_id_idx` ON `products` (`category_id`);--> statement-breakpoint
CREATE INDEX `products_status_featured_idx` ON `products` (`status`,`featured`);--> statement-breakpoint
CREATE INDEX `products_name_idx` ON `products` (`name`);