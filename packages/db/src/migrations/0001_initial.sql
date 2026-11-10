-- Create products table
CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('gear', 'setup', 'other')),
  category TEXT NOT NULL,
  cover_image TEXT,
  cover_alt TEXT,
  weekly_price REAL,
  is_rentable INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
  updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
);

-- Create cities table
CREATE TABLE IF NOT EXISTS cities (
  slug TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  factor REAL NOT NULL DEFAULT 1.0,
  currency TEXT NOT NULL DEFAULT 'USD'
);

-- Create setups table
CREATE TABLE IF NOT EXISTS setups (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'setup'
);

-- Create setup_parts (Includes spec)
CREATE TABLE IF NOT EXISTS setup_parts (
  setup_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (setup_id, product_id),
  FOREIGN KEY (setup_id) REFERENCES setups(id),
  FOREIGN KEY (product_id) REFERENCES products(id)
);

-- Create location prices table
CREATE TABLE IF NOT EXISTS location_prices (
  product_id TEXT NOT NULL,
  city_slug TEXT NOT NULL,
  weekly_price REAL NOT NULL,
  PRIMARY KEY (product_id, city_slug),
  FOREIGN KEY (product_id) REFERENCES products(id),
  FOREIGN KEY (city_slug) REFERENCES cities(slug)
);

-- Create deposit rules table
CREATE TABLE IF NOT EXISTS deposit_rules (
  product_id TEXT PRIMARY KEY,
  percentage REAL NOT NULL DEFAULT 0,
  FOREIGN KEY (product_id) REFERENCES products(id)
);

-- Create rentals table
CREATE TABLE IF NOT EXISTS rentals (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  city_slug TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'active', 'cancelled', 'returned', 'completed')),
  weekly_price REAL NOT NULL,
  deposit_amount REAL NOT NULL DEFAULT 0,
  total_paid REAL NOT NULL DEFAULT 0,
  start_date INTEGER NOT NULL,
  end_date INTEGER,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
  updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
  FOREIGN KEY (city_slug) REFERENCES cities(slug)
);

-- Create rental items
CREATE TABLE IF NOT EXISTS rental_items (
  rental_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (rental_id, product_id),
  FOREIGN KEY (rental_id) REFERENCES rentals(id),
  FOREIGN KEY (product_id) REFERENCES products(id)
);

-- Create payment records table
CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  rental_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  order_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('awaiting_approval', 'approved', 'paid', 'failed', 'refunded')),
  amount REAL NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  approval_url TEXT,
  payer_id TEXT,
  captured_at INTEGER,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
  FOREIGN KEY (rental_id) REFERENCES rentals(id)
);

-- Indexes for common lookups
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_type ON products(type);
CREATE INDEX IF NOT EXISTS idx_products_is_rentable ON products(is_rentable);
CREATE INDEX IF NOT EXISTS idx_setup_parts_setup ON setup_parts(setup_id);
CREATE INDEX IF NOT EXISTS idx_location_prices_city ON location_prices(city_slug);
CREATE INDEX IF NOT EXISTS idx_rentals_user ON rentals(user_id);
CREATE INDEX IF NOT EXISTS idx_rentals_status ON rentals(status);
CREATE INDEX IF NOT EXISTS idx_payments_rental ON payments(rental_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);