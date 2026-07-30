/* ============================================
   ROUTE: /api/orders — Order Management
   ============================================ */

const express = require('express');
const router = express.Router();
const { getDb, generateId, generateOrderNumber } = require('../db');

// GET /api/orders — All orders (optional ?status=baru)
router.get('/', (req, res) => {
  const db = getDb();
  let orders;

  if (req.query.status) {
    orders = db.prepare('SELECT * FROM orders WHERE status = ? ORDER BY created_at DESC')
      .all(req.query.status);
  } else {
    orders = db.prepare('SELECT * FROM orders ORDER BY created_at DESC').all();
  }

  res.json(orders.map(o => attachItems(db, o)));
});

// GET /api/orders/active — Non-completed orders
router.get('/active', (req, res) => {
  const db = getDb();
  const orders = db.prepare("SELECT * FROM orders WHERE status != 'selesai' ORDER BY created_at ASC")
    .all();
  res.json(orders.map(o => attachItems(db, o)));
});

// GET /api/orders/today — Today's orders
router.get('/today', (req, res) => {
  const db = getDb();
  const today = new Date().toISOString().split('T')[0];
  const orders = db.prepare("SELECT * FROM orders WHERE created_at LIKE ? ORDER BY created_at DESC")
    .all(today + '%');
  res.json(orders.map(o => attachItems(db, o)));
});

// GET /api/orders/:id
router.get('/:id', (req, res) => {
  const db = getDb();
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
  if (!order) {
    return res.status(404).json({ error: 'Pesanan tidak ditemukan' });
  }
  res.json(attachItems(db, order));
});

// POST /api/orders — Create new order
router.post('/', (req, res) => {
  const { customerName, tableNo, items, notes, waiter } = req.body;

  if (!customerName || !tableNo || !items || items.length === 0) {
    return res.status(400).json({ error: 'Nama pemesan, nomor meja, dan item pesanan wajib diisi' });
  }

  const db = getDb();
  const id = generateId();
  const orderNumber = generateOrderNumber();
  const total = items.reduce((sum, item) => sum + (item.price * item.qty), 0);
  const now = new Date().toISOString();

  const createOrder = db.transaction(() => {
    db.prepare(`
      INSERT INTO orders (id, order_number, customer_name, table_no, notes, status, total, waiter, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 'baru', ?, ?, ?, ?)
    `).run(id, orderNumber, customerName, tableNo, notes || '', total, waiter || 'Pelayan', now, now);

    const insertItem = db.prepare(
      'INSERT INTO order_items (order_id, menu_id, name, price, qty, emoji, image_url) VALUES (?, ?, ?, ?, ?, ?, ?)'
    );

    for (const item of items) {
      insertItem.run(id, item.menuId || null, item.name, item.price, item.qty, item.emoji || '☕', item.imageUrl || null);
    }
  });

  createOrder();

  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(id);
  const result = attachItems(db, order);

  // Broadcast to all clients
  req.app.get('broadcast')('ORDER_CREATED', result);

  res.status(201).json(result);
});

// PUT /api/orders/:id/status — Update order status
router.put('/:id/status', (req, res) => {
  const { status } = req.body;
  const validStatuses = ['baru', 'proses', 'siap', 'selesai'];

  if (!status || !validStatuses.includes(status)) {
    return res.status(400).json({ error: 'Status tidak valid' });
  }

  const db = getDb();
  const existing = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
  if (!existing) {
    return res.status(404).json({ error: 'Pesanan tidak ditemukan' });
  }

  const now = new Date().toISOString();
  db.prepare('UPDATE orders SET status = ?, updated_at = ? WHERE id = ?')
    .run(status, now, req.params.id);

  const updated = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
  const result = attachItems(db, updated);

  req.app.get('broadcast')('ORDER_UPDATED', result);

  res.json(result);
});

// DELETE /api/orders/:id
router.delete('/:id', (req, res) => {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
  if (!existing) {
    return res.status(404).json({ error: 'Pesanan tidak ditemukan' });
  }

  db.prepare('DELETE FROM order_items WHERE order_id = ?').run(req.params.id);
  db.prepare('DELETE FROM orders WHERE id = ?').run(req.params.id);

  res.json({ success: true });
});

// Helper: attach items to order and format
function attachItems(db, order) {
  const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(order.id);
  return {
    id: order.id,
    orderNumber: order.order_number,
    customerName: order.customer_name,
    tableNo: order.table_no,
    notes: order.notes,
    status: order.status,
    total: order.total,
    waiter: order.waiter,
    createdAt: order.created_at,
    updatedAt: order.updated_at,
    items: items.map(i => ({
      menuId: i.menu_id,
      name: i.name,
      price: i.price,
      qty: i.qty,
      emoji: i.emoji,
      imageUrl: i.image_url,
    })),
  };
}

module.exports = router;
