/* ============================================
   ROUTE: /api/transactions — Transaction Management
   ============================================ */

const express = require('express');
const router = express.Router();
const { getDb, generateId } = require('../db');

// GET /api/transactions — All transactions (optional ?date=2026-07-30)
router.get('/', (req, res) => {
  const db = getDb();
  let transactions;

  if (req.query.date) {
    transactions = db.prepare("SELECT * FROM transactions WHERE paid_at LIKE ? ORDER BY paid_at DESC")
      .all(req.query.date + '%');
  } else {
    transactions = db.prepare('SELECT * FROM transactions ORDER BY paid_at DESC').all();
  }

  res.json(transactions.map(t => attachTransactionItems(db, t)));
});

// GET /api/transactions/today
router.get('/today', (req, res) => {
  const db = getDb();
  const today = new Date().toISOString().split('T')[0];
  const transactions = db.prepare("SELECT * FROM transactions WHERE paid_at LIKE ? ORDER BY paid_at DESC")
    .all(today + '%');
  res.json(transactions.map(t => attachTransactionItems(db, t)));
});

// GET /api/transactions/summary — Today's summary (or ?date=...)
router.get('/summary', (req, res) => {
  const db = getDb();
  const date = req.query.date || new Date().toISOString().split('T')[0];

  const transactions = db.prepare("SELECT * FROM transactions WHERE paid_at LIKE ?")
    .all(date + '%');

  const totalRevenue = transactions.reduce((sum, t) => sum + t.total, 0);
  const totalCash = transactions.filter(t => t.payment_method === 'tunai').reduce((sum, t) => sum + t.total, 0);
  const totalQris = transactions.filter(t => t.payment_method === 'qris').reduce((sum, t) => sum + t.total, 0);

  res.json({
    totalTransactions: transactions.length,
    totalRevenue,
    totalCash,
    totalQris,
  });
});

// GET /api/transactions/chart — Last 7 days revenue
router.get('/chart', (req, res) => {
  const db = getDb();
  // Get date 7 days ago
  const d = new Date();
  d.setDate(d.getDate() - 6);
  const startDate = d.toISOString().split('T')[0];

  const transactions = db.prepare("SELECT paid_at, total FROM transactions WHERE paid_at >= ?")
    .all(startDate);

  // Group by date
  const daily = {};
  
  // Initialize last 7 days with 0
  for (let i = 6; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    daily[date.toISOString().split('T')[0]] = 0;
  }

  transactions.forEach(t => {
    const date = t.paid_at.split('T')[0];
    if (daily[date] !== undefined) {
      daily[date] += t.total;
    }
  });

  res.json(Object.keys(daily).map(date => ({
    date,
    revenue: daily[date]
  })));
});

// POST /api/transactions/pay — Process payment
router.post('/pay', (req, res) => {
  const { orderId, paymentMethod, amountPaid } = req.body;

  if (!orderId || !paymentMethod || amountPaid == null) {
    return res.status(400).json({ error: 'orderId, paymentMethod, dan amountPaid wajib diisi' });
  }

  const db = getDb();

  // Get order
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
  if (!order) {
    return res.status(404).json({ error: 'Pesanan tidak ditemukan' });
  }

  if (amountPaid < order.total) {
    return res.status(400).json({ error: 'Jumlah pembayaran kurang' });
  }

  const orderItems = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(orderId);
  const id = generateId();
  const now = new Date().toISOString();
  const changeAmount = amountPaid - order.total;

  const processPayment = db.transaction(() => {
    // Create transaction
    db.prepare(`
      INSERT INTO transactions (id, order_id, order_number, customer_name, table_no, total, payment_method, amount_paid, change_amount, cashier, paid_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, orderId, order.order_number, order.customer_name, order.table_no, order.total, paymentMethod, amountPaid, changeAmount, 'Admin', now);

    // Copy items to transaction_items
    const insertItem = db.prepare(
      'INSERT INTO transaction_items (transaction_id, name, price, qty, emoji, image_url) VALUES (?, ?, ?, ?, ?, ?)'
    );
    for (const item of orderItems) {
      insertItem.run(id, item.name, item.price, item.qty, item.emoji, item.image_url);
    }

    // Update order status to 'selesai'
    db.prepare("UPDATE orders SET status = 'selesai', updated_at = ? WHERE id = ?")
      .run(now, orderId);
  });

  processPayment();

  const transaction = db.prepare('SELECT * FROM transactions WHERE id = ?').get(id);
  const result = attachTransactionItems(db, transaction);

  // Also get updated order
  const updatedOrder = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
  const orderResult = {
    id: updatedOrder.id,
    orderNumber: updatedOrder.order_number,
    tableNo: updatedOrder.table_no,
    status: updatedOrder.status,
    total: updatedOrder.total,
    createdAt: updatedOrder.created_at,
    updatedAt: updatedOrder.updated_at,
    items: orderItems.map(i => ({ menuId: i.menu_id, name: i.name, price: i.price, qty: i.qty, emoji: i.emoji, imageUrl: i.image_url })),
  };

  // Broadcast
  req.app.get('broadcast')('PAYMENT_PROCESSED', { transaction: result, order: orderResult });

  res.status(201).json(result);
});

// Helper: format transaction and attach items
function attachTransactionItems(db, transaction) {
  const items = db.prepare('SELECT * FROM transaction_items WHERE transaction_id = ?').all(transaction.id);
  return {
    id: transaction.id,
    orderId: transaction.order_id,
    orderNumber: transaction.order_number,
    customerName: transaction.customer_name,
    tableNo: transaction.table_no,
    total: transaction.total,
    paymentMethod: transaction.payment_method,
    amountPaid: transaction.amount_paid,
    changeAmount: transaction.change_amount,
    cashier: transaction.cashier,
    paidAt: transaction.paid_at,
    items: items.map(i => ({
      name: i.name,
      price: i.price,
      qty: i.qty,
      emoji: i.emoji,
      imageUrl: i.image_url,
    })),
  };
}

module.exports = router;
