/* ============================================
   AVORNI COFFEE POS — Database Setup
   SQLite via better-sqlite3
   ============================================ */

const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'database.sqlite');

let db;

function getDb() {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    initTables();
    seedDefaults();
  }
  return db;
}

function initTables() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('admin', 'dapur', 'pelayan')),
      name TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS menu (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      price INTEGER NOT NULL,
      category TEXT NOT NULL CHECK(category IN ('kopi', 'non-kopi', 'makanan')),
      emoji TEXT DEFAULT '☕',
      image_url TEXT,
      available INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      order_number TEXT NOT NULL,
      customer_name TEXT NOT NULL,
      table_no INTEGER NOT NULL,
      notes TEXT DEFAULT '',
      status TEXT NOT NULL DEFAULT 'baru' CHECK(status IN ('baru', 'proses', 'siap', 'selesai')),
      total INTEGER NOT NULL DEFAULT 0,
      waiter TEXT DEFAULT 'Pelayan',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id TEXT NOT NULL,
      menu_id TEXT,
      name TEXT NOT NULL,
      price INTEGER NOT NULL,
      qty INTEGER NOT NULL DEFAULT 1,
      emoji TEXT DEFAULT '☕',
      image_url TEXT,
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL,
      order_number TEXT NOT NULL,
      customer_name TEXT NOT NULL,
      table_no INTEGER NOT NULL,
      total INTEGER NOT NULL,
      payment_method TEXT NOT NULL CHECK(payment_method IN ('tunai', 'qris')),
      amount_paid INTEGER NOT NULL,
      change_amount INTEGER NOT NULL DEFAULT 0,
      cashier TEXT DEFAULT 'Admin',
      paid_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (order_id) REFERENCES orders(id)
    );

    CREATE TABLE IF NOT EXISTS transaction_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      transaction_id TEXT NOT NULL,
      name TEXT NOT NULL,
      price INTEGER NOT NULL,
      qty INTEGER NOT NULL DEFAULT 1,
      emoji TEXT DEFAULT '☕',
      image_url TEXT,
      FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS order_counter (
      date_key TEXT PRIMARY KEY,
      counter INTEGER NOT NULL DEFAULT 0
    );
  `);
}

function seedDefaults() {
  // Seed users if empty
  const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
  if (userCount === 0) {
    const insertUser = db.prepare(
      'INSERT INTO users (id, username, password, role, name) VALUES (?, ?, ?, ?, ?)'
    );

    const defaultUsers = [
      { id: 'u1', username: 'admin', password: 'admin123', role: 'admin', name: 'Administrator' },
      { id: 'u2', username: 'dapur', password: 'dapur123', role: 'dapur', name: 'Staff Dapur' },
      { id: 'u3', username: 'pelayan', password: 'pelayan123', role: 'pelayan', name: 'Staff Pelayan' },
    ];

    const insertMany = db.transaction((users) => {
      for (const u of users) {
        const hashed = bcrypt.hashSync(u.password, 10);
        insertUser.run(u.id, u.username, hashed, u.role, u.name);
      }
    });
    insertMany(defaultUsers);
  }

  // Seed menu if empty
  const menuCount = db.prepare('SELECT COUNT(*) as count FROM menu').get().count;
  if (menuCount === 0) {
    const insertMenu = db.prepare(
      'INSERT INTO menu (id, name, price, category, emoji, image_url, available) VALUES (?, ?, ?, ?, ?, ?, ?)'
    );

    const defaultMenu = [
      { id: 'k1', name: 'Espresso', price: 18000, category: 'kopi', emoji: '☕' },
      { id: 'k2', name: 'Americano', price: 22000, category: 'kopi', emoji: '☕' },
      { id: 'k3', name: 'Cappuccino', price: 28000, category: 'kopi', emoji: '☕' },
      { id: 'k4', name: 'Café Latte', price: 28000, category: 'kopi', emoji: '🥛' },
      { id: 'k5', name: 'Mocha', price: 32000, category: 'kopi', emoji: '🍫' },
      { id: 'k6', name: 'Caramel Macchiato', price: 35000, category: 'kopi', emoji: '🍯' },
      { id: 'k7', name: 'Affogato', price: 30000, category: 'kopi', emoji: '🍨' },
      { id: 'k8', name: 'Kopi Susu Gula Aren', price: 25000, category: 'kopi', emoji: '🥤' },
      { id: 'n1', name: 'Matcha Latte', price: 30000, category: 'non-kopi', emoji: '🍵' },
      { id: 'n2', name: 'Coklat Panas', price: 25000, category: 'non-kopi', emoji: '🍫' },
      { id: 'n3', name: 'Taro Latte', price: 28000, category: 'non-kopi', emoji: '🟣' },
      { id: 'n4', name: 'Thai Tea', price: 22000, category: 'non-kopi', emoji: '🧋' },
      { id: 'n5', name: 'Lemon Tea', price: 18000, category: 'non-kopi', emoji: '🍋' },
      { id: 'n6', name: 'Fresh Orange', price: 20000, category: 'non-kopi', emoji: '🍊' },
      { id: 'm1', name: 'Croissant', price: 25000, category: 'makanan', emoji: '🥐' },
      { id: 'm2', name: 'Roti Bakar', price: 20000, category: 'makanan', emoji: '🍞' },
      { id: 'm3', name: 'French Fries', price: 22000, category: 'makanan', emoji: '🍟' },
      { id: 'm4', name: 'Sandwich', price: 28000, category: 'makanan', emoji: '🥪' },
      { id: 'm5', name: 'Pancake', price: 28000, category: 'makanan', emoji: '🥞' },
      { id: 'm6', name: 'Banana Split', price: 30000, category: 'makanan', emoji: '🍌' },
    ];

    const insertMany = db.transaction((items) => {
      for (const item of items) {
        insertMenu.run(item.id, item.name, item.price, item.category, item.emoji, null, 1);
      }
    });
    insertMany(defaultMenu);
  }
}

// Generate unique ID
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
}

// Generate order number (sequential, resets daily)
function generateOrderNumber() {
  const today = new Date().toISOString().split('T')[0];
  
  const row = db.prepare('SELECT counter FROM order_counter WHERE date_key = ?').get(today);
  let counter;
  
  if (row) {
    counter = row.counter + 1;
    db.prepare('UPDATE order_counter SET counter = ? WHERE date_key = ?').run(counter, today);
  } else {
    counter = 1;
    // Clean old entries
    db.prepare('DELETE FROM order_counter WHERE date_key != ?').run(today);
    db.prepare('INSERT INTO order_counter (date_key, counter) VALUES (?, ?)').run(today, counter);
  }
  
  return 'ORD-' + String(counter).padStart(3, '0');
}

module.exports = { getDb, generateId, generateOrderNumber };
