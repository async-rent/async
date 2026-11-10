-- Seed cities
INSERT OR IGNORE INTO cities (slug, name, factor, currency) VALUES
  ('nyc', 'New York City', 1.0, 'USD'),
  ('lax', 'Los Angeles', 1.2, 'USD'),
  ('sfo', 'San Francisco', 1.3, 'USD'),
  ('chi', 'Chicago', 1.1, 'USD');

-- Seed base gear products
INSERT OR IGNORE INTO products (id, name, type, category, cover_image, cover_alt, weekly_price, is_rentable) VALUES
  ('p-gear-tent', 'Alpine Tent', 'gear', 'camping', null, 'Alpine camping tent', 45, 1),
  ('p-gear-bike', 'Mountain Bike', 'gear', 'cycling', null, 'Mountain bike', 60, 1),
  ('p-gear-camera', 'DSLR Camera', 'gear', 'photography', null, 'Professional DSLR camera', 80, 1),
  ('p-gear-projector', 'Portable Projector', 'gear', 'electronics', null, 'Portable LED projector', 35, 1),
  ('p-gear-drone', '4K Drone', 'gear', 'electronics', null, '4K aerial drone', 90, 1);

-- Seed setup products (ready-made rentals)
INSERT OR IGNORE INTO products (id, name, type, category, cover_image, cover_alt, weekly_price, is_rentable) VALUES
  ('p-setup-camping-weekend', 'Weekend Camping Setup', 'setup', 'setup', null, 'Weekend camping gear setup', 120, 1),
  ('p-setup-photo-pro', 'Photographer Pro Setup', 'setup', 'setup', null, 'Professional photography setup', 200, 1),
  ('p-setup-cinema-night', 'Outdoor Cinema Night Setup', 'setup', 'setup', null, 'Outdoor movie night setup', 95, 1);

-- Seed setups
INSERT OR IGNORE INTO setups (id, name, description, category) VALUES
  ('p-setup-camping-weekend', 'Weekend Camping Setup', 'Everything you need for a weekend camping trip: tent, sleeping bags, lantern, and stove.', 'setup'),
  ('p-setup-photo-pro', 'Photographer Pro Setup', 'Complete photography kit: DSLR camera, tripod, lighting, and reflector.', 'setup'),
  ('p-setup-cinema-night', 'Outdoor Cinema Night Setup', 'Projector, screen, speakers, and blankets for a movie night under the stars.', 'setup');

-- Seed setup parts (Includes spec)
INSERT OR IGNORE INTO setup_parts (setup_id, product_id, quantity) VALUES
  -- Weekend Camping Setup parts
  ('p-setup-camping-weekend', 'p-gear-tent', 1),
  -- Photographer Pro Setup parts
  ('p-setup-photo-pro', 'p-gear-camera', 1),
  -- Outdoor Cinema Night Setup parts
  ('p-setup-cinema-night', 'p-gear-projector', 1);

-- Seed location prices (weekly price per city)
INSERT OR IGNORE INTO location_prices (product_id, city_slug, weekly_price) VALUES
  -- Alpine Tent
  ('p-gear-tent', 'nyc', 45),
  ('p-gear-tent', 'lax', 54),
  ('p-gear-tent', 'sfo', 58),
  ('p-gear-tent', 'chi', 49),
  -- Mountain Bike
  ('p-gear-bike', 'nyc', 60),
  ('p-gear-bike', 'lax', 72),
  ('p-gear-bike', 'sfo', 78),
  ('p-gear-bike', 'chi', 66),
  -- DSLR Camera
  ('p-gear-camera', 'nyc', 80),
  ('p-gear-camera', 'lax', 96),
  ('p-gear-camera', 'sfo', 104),
  ('p-gear-camera', 'chi', 88),
  -- Portable Projector
  ('p-gear-projector', 'nyc', 35),
  ('p-gear-projector', 'lax', 42),
  ('p-gear-projector', 'sfo', 45),
  ('p-gear-projector', 'chi', 38),
  -- 4K Drone
  ('p-gear-drone', 'nyc', 90),
  ('p-gear-drone', 'lax', 108),
  ('p-gear-drone', 'sfo', 117),
  ('p-gear-drone', 'chi', 99),
  -- Setups (use base weekly price as starting point)
  ('p-setup-camping-weekend', 'nyc', 120),
  ('p-setup-camping-weekend', 'lax', 144),
  ('p-setup-camping-weekend', 'sfo', 156),
  ('p-setup-camping-weekend', 'chi', 132),
  ('p-setup-photo-pro', 'nyc', 200),
  ('p-setup-photo-pro', 'lax', 240),
  ('p-setup-photo-pro', 'sfo', 260),
  ('p-setup-photo-pro', 'chi', 220),
  ('p-setup-cinema-night', 'nyc', 95),
  ('p-setup-cinema-night', 'lax', 114),
  ('p-setup-cinema-night', 'sfo', 123),
  ('p-setup-cinema-night', 'chi', 104);

-- Seed deposit rules (25% of weekly price per product)
INSERT OR IGNORE INTO deposit_rules (product_id, percentage) VALUES
  ('p-gear-tent', 25),
  ('p-gear-bike', 25),
  ('p-gear-camera', 25),
  ('p-gear-projector', 25),
  ('p-gear-drone', 25),
  ('p-setup-camping-weekend', 25),
  ('p-setup-photo-pro', 25),
  ('p-setup-cinema-night', 25);