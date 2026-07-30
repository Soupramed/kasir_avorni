/* ============================================
   ROUTE: /api/menu — Menu Management
   ============================================ */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { getDb, generateId } = require('../db');

// Configure Multer for image upload
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, '../public/uploads'));
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Hanya file gambar yang diperbolehkan!'));
    }
  }
});

// GET /api/menu — All menu items
router.get('/', (req, res) => {
  const db = getDb();
  const menu = db.prepare('SELECT * FROM menu ORDER BY category, name').all();
  res.json(menu.map(formatMenuItem));
});

// GET /api/menu/available — Only available items
router.get('/available', (req, res) => {
  const db = getDb();
  const menu = db.prepare('SELECT * FROM menu WHERE available = 1 ORDER BY category, name').all();
  res.json(menu.map(formatMenuItem));
});

// GET /api/menu/category/:category
router.get('/category/:category', (req, res) => {
  const db = getDb();
  const menu = db.prepare('SELECT * FROM menu WHERE available = 1 AND category = ? ORDER BY name')
    .all(req.params.category);
  res.json(menu.map(formatMenuItem));
});

// POST /api/menu — Add menu item
router.post('/', upload.single('image'), (req, res) => {
  const { name, price, category, emoji } = req.body;
  const imageUrl = req.file ? `/uploads/${req.file.filename}` : null;

  if (!name || !price || !category) {
    return res.status(400).json({ error: 'Nama, harga, dan kategori wajib diisi' });
  }

  const db = getDb();
  const id = generateId();
  db.prepare(
    'INSERT INTO menu (id, name, price, category, emoji, image_url, available) VALUES (?, ?, ?, ?, ?, ?, 1)'
  ).run(id, name, parseInt(price), category, emoji || '☕', imageUrl);

  const item = db.prepare('SELECT * FROM menu WHERE id = ?').get(id);
  const formatted = formatMenuItem(item);

  // Broadcast
  req.app.get('broadcast')('MENU_UPDATED', { action: 'add', item: formatted });

  res.status(201).json(formatted);
});

// PUT /api/menu/:id — Update menu item
router.put('/:id', upload.single('image'), (req, res) => {
  const { name, price, category, emoji, available } = req.body;
  const db = getDb();

  const existing = db.prepare('SELECT * FROM menu WHERE id = ?').get(req.params.id);
  if (!existing) {
    return res.status(404).json({ error: 'Menu tidak ditemukan' });
  }
  
  const imageUrl = req.file ? `/uploads/${req.file.filename}` : existing.image_url;

  db.prepare(`
    UPDATE menu SET 
      name = COALESCE(?, name),
      price = COALESCE(?, price),
      category = COALESCE(?, category),
      emoji = COALESCE(?, emoji),
      image_url = ?,
      available = COALESCE(?, available)
    WHERE id = ?
  `).run(
    name || null,
    price != null ? parseInt(price) : null,
    category || null,
    emoji || null,
    imageUrl,
    available != null ? (available === 'true' || available === '1' || available === true ? 1 : 0) : null,
    req.params.id
  );

  const updated = db.prepare('SELECT * FROM menu WHERE id = ?').get(req.params.id);
  const formatted = formatMenuItem(updated);

  req.app.get('broadcast')('MENU_UPDATED', { action: 'update', item: formatted });

  res.json(formatted);
});

// DELETE /api/menu/:id — Delete menu item
router.delete('/:id', (req, res) => {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM menu WHERE id = ?').get(req.params.id);
  if (!existing) {
    return res.status(404).json({ error: 'Menu tidak ditemukan' });
  }

  db.prepare('DELETE FROM menu WHERE id = ?').run(req.params.id);

  req.app.get('broadcast')('MENU_UPDATED', { action: 'delete', id: req.params.id });

  res.json({ success: true });
});

// Format helper: convert SQLite row to frontend format
function formatMenuItem(item) {
  return {
    id: item.id,
    name: item.name,
    price: item.price,
    category: item.category,
    emoji: item.emoji,
    imageUrl: item.image_url,
    available: item.available === 1,
    createdAt: item.created_at,
  };
}

module.exports = router;
