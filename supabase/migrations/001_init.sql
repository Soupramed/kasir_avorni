-- ============================================================
--  AVORNI COFFEE POS — Supabase / PostgreSQL Migration
--  Run this in Supabase SQL Editor (Project → SQL Editor → New Query)
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ========================
--  USERS
-- ========================
CREATE TABLE IF NOT EXISTS users (
  id          TEXT PRIMARY KEY,
  username    TEXT UNIQUE NOT NULL,
  password    TEXT NOT NULL,          -- bcryptjs hash
  role        TEXT NOT NULL CHECK (role IN ('admin', 'dapur', 'pelayan')),
  name        TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- ========================
--  LAPAK (Tenant / Stand)
-- ========================
CREATE TABLE IF NOT EXISTS lapak (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  owner_name    TEXT NOT NULL,
  tax_per_item  INTEGER NOT NULL DEFAULT 1000,
  active        BOOLEAN DEFAULT TRUE,
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- ========================
--  MENU
-- ========================
CREATE TABLE IF NOT EXISTS menu (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  price       INTEGER NOT NULL,
  category    TEXT NOT NULL CHECK (category IN ('kopi', 'non-kopi', 'makanan')),
  emoji       TEXT DEFAULT '☕',
  image_url   TEXT,
  available   BOOLEAN DEFAULT TRUE,
  lapak_id    TEXT REFERENCES lapak(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- ========================
--  ORDER COUNTER (daily sequence)
-- ========================
CREATE TABLE IF NOT EXISTS order_counter (
  date_key  TEXT PRIMARY KEY,
  counter   INTEGER NOT NULL DEFAULT 0
);

-- ========================
--  ORDERS
-- ========================
CREATE TABLE IF NOT EXISTS orders (
  id            TEXT PRIMARY KEY,
  order_number  TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  table_no      INTEGER NOT NULL,
  notes         TEXT DEFAULT '',
  status        TEXT NOT NULL DEFAULT 'baru'
                CHECK (status IN ('baru', 'proses', 'siap', 'diantar', 'selesai')),
  total         INTEGER NOT NULL DEFAULT 0,
  waiter        TEXT DEFAULT 'Pelayan',
  is_paid       BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

-- ========================
--  ORDER ITEMS
-- ========================
CREATE TABLE IF NOT EXISTS order_items (
  id          BIGSERIAL PRIMARY KEY,
  order_id    TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  menu_id     TEXT,
  name        TEXT NOT NULL,
  price       INTEGER NOT NULL,
  qty         INTEGER NOT NULL DEFAULT 1,
  emoji       TEXT DEFAULT '☕',
  image_url   TEXT,
  lapak_id    TEXT REFERENCES lapak(id) ON DELETE SET NULL
);

-- ========================
--  TRANSACTIONS
-- ========================
CREATE TABLE IF NOT EXISTS transactions (
  id              TEXT PRIMARY KEY,
  order_id        TEXT NOT NULL REFERENCES orders(id),
  order_number    TEXT NOT NULL,
  customer_name   TEXT NOT NULL,
  table_no        INTEGER NOT NULL,
  total           INTEGER NOT NULL,
  payment_method  TEXT NOT NULL CHECK (payment_method IN ('tunai', 'qris')),
  amount_paid     INTEGER NOT NULL,
  change_amount   INTEGER NOT NULL DEFAULT 0,
  cashier         TEXT DEFAULT 'Admin',
  paid_at         TIMESTAMPTZ DEFAULT now()
);

-- ========================
--  TRANSACTION ITEMS
-- ========================
CREATE TABLE IF NOT EXISTS transaction_items (
  id              BIGSERIAL PRIMARY KEY,
  transaction_id  TEXT NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  price           INTEGER NOT NULL,
  qty             INTEGER NOT NULL DEFAULT 1,
  emoji           TEXT DEFAULT '☕',
  image_url       TEXT,
  lapak_id        TEXT REFERENCES lapak(id) ON DELETE SET NULL
);

-- ========================
--  INDEXES
-- ========================
CREATE INDEX IF NOT EXISTS idx_orders_status     ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created    ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_is_paid    ON orders(is_paid);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_tx_paid_at        ON transactions(paid_at DESC);
CREATE INDEX IF NOT EXISTS idx_tx_items_tx       ON transaction_items(transaction_id);
CREATE INDEX IF NOT EXISTS idx_menu_category     ON menu(category);
CREATE INDEX IF NOT EXISTS idx_menu_available    ON menu(available);

-- ========================
--  REALTIME
--  Enable realtime on tables that need live updates
--  (Also enable in Supabase Dashboard > Database > Replication)
-- ========================
ALTER PUBLICATION supabase_realtime ADD TABLE orders;
ALTER PUBLICATION supabase_realtime ADD TABLE order_items;
ALTER PUBLICATION supabase_realtime ADD TABLE transactions;
ALTER PUBLICATION supabase_realtime ADD TABLE menu;

-- ========================
--  SEED: Default Users
--  Passwords: admin123 / dapur123 / pelayan123
-- ========================
INSERT INTO users (id, username, password, role, name) VALUES
  ('u1', 'admin',   '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWq', 'admin',   'Administrator'),
  ('u2', 'dapur',   '$2a$10$gSvqqUPvlXP2zsRbQDdB/OLvl0rOPxqKvsL95bj5hzOLcG5rMEjle', 'dapur',   'Staff Dapur'),
  ('u3', 'pelayan', '$2a$10$pGVi.oeAoZrS4xGbU6m5O.xkzuqbJq0oJFWmUHrSdFCM7NijNQHCy', 'pelayan', 'Staff Pelayan')
ON CONFLICT (id) DO NOTHING;

-- ========================
--  SEED: Default Menu
-- ========================
INSERT INTO menu (id, name, price, category, emoji, available) VALUES
  ('k1', 'Espresso',              18000, 'kopi',     'coffee',     TRUE),
  ('k2', 'Americano',             22000, 'kopi',     'coffee',     TRUE),
  ('k3', 'Cappuccino',            28000, 'kopi',     'coffee',     TRUE),
  ('k4', 'Café Latte',            28000, 'kopi',     'milk',       TRUE),
  ('k5', 'Mocha',                 32000, 'kopi',     'cookie',     TRUE),
  ('k6', 'Caramel Macchiato',     35000, 'kopi',     'honey',      TRUE),
  ('k7', 'Affogato',              30000, 'kopi',     'ice-cream',  TRUE),
  ('k8', 'Kopi Susu Gula Aren',   25000, 'kopi',     'cup-soda',   TRUE),
  ('n1', 'Matcha Latte',          30000, 'non-kopi', 'leaf',       TRUE),
  ('n2', 'Coklat Panas',          25000, 'non-kopi', 'cookie',     TRUE),
  ('n3', 'Taro Latte',            28000, 'non-kopi', 'glass-water',TRUE),
  ('n4', 'Thai Tea',              22000, 'non-kopi', 'cup-soda',   TRUE),
  ('n5', 'Lemon Tea',             18000, 'non-kopi', 'citrus',     TRUE),
  ('n6', 'Fresh Orange',          20000, 'non-kopi', 'citrus',     TRUE),
  ('m1', 'Croissant',             25000, 'makanan',  'croissant',  TRUE),
  ('m2', 'Roti Bakar',            20000, 'makanan',  'bread',      TRUE),
  ('m3', 'French Fries',          22000, 'makanan',  'cup-soda',   TRUE),
  ('m4', 'Sandwich',              28000, 'makanan',  'sandwich',   TRUE),
  ('m5', 'Pancake',               28000, 'makanan',  'cake',       TRUE),
  ('m6', 'Banana Split',          30000, 'makanan',  'banana',     TRUE)
ON CONFLICT (id) DO NOTHING;
