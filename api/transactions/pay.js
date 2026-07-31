/* ============================================
   API: POST /api/transactions/pay — Process payment
   ============================================ */
const { supabase, generateId, broadcast } = require('../../lib/supabase');

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

async function attachTransactionItems(transaction) {
  const { data: items } = await supabase
    .from('transaction_items')
    .select('*')
    .eq('transaction_id', transaction.id);

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
    items: (items || []).map(i => ({
      name: i.name,
      price: i.price,
      qty: i.qty,
      emoji: i.emoji,
      imageUrl: i.image_url,
    })),
  };
}

module.exports = async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { orderId, paymentMethod, amountPaid } = req.body || {};

  if (!orderId || !paymentMethod || amountPaid == null) {
    return res.status(400).json({ error: 'orderId, paymentMethod, dan amountPaid wajib diisi' });
  }

  const { data: order, error: orderErr } = await supabase.from('orders').select('*').eq('id', orderId).single();
  if (orderErr || !order) {
    return res.status(404).json({ error: 'Pesanan tidak ditemukan' });
  }

  if (order.is_paid) {
    return res.status(400).json({ error: 'Pesanan ini sudah dibayar' });
  }

  if (amountPaid < order.total) {
    return res.status(400).json({ error: 'Jumlah pembayaran kurang' });
  }

  const { data: orderItems } = await supabase.from('order_items').select('*').eq('order_id', orderId);
  const txId = generateId();
  const now = new Date().toISOString();
  const changeAmount = amountPaid - order.total;

  // Insert transaction
  const { error: txErr } = await supabase.from('transactions').insert({
    id: txId,
    order_id: orderId,
    order_number: order.order_number,
    customer_name: order.customer_name,
    table_no: order.table_no,
    total: order.total,
    payment_method: paymentMethod,
    amount_paid: amountPaid,
    change_amount: changeAmount,
    cashier: 'Admin',
    paid_at: now,
  });

  if (txErr) return res.status(500).json({ error: txErr.message });

  // Insert transaction items
  const txItemRows = (orderItems || []).map(item => ({
    transaction_id: txId,
    name: item.name,
    price: item.price,
    qty: item.qty,
    emoji: item.emoji,
    image_url: item.image_url,
    lapak_id: item.lapak_id || null,
  }));

  if (txItemRows.length > 0) {
    await supabase.from('transaction_items').insert(txItemRows);
  }

  // Update order status: if already delivered, finish order ('selesai'); otherwise keep current status and set is_paid = true
  const newStatus = order.status === 'diantar' ? 'selesai' : order.status;
  const { data: updatedOrder } = await supabase
    .from('orders')
    .update({ status: newStatus, is_paid: true, updated_at: now })
    .eq('id', orderId)
    .select()
    .single();

  const { data: transaction } = await supabase.from('transactions').select('*').eq('id', txId).single();
  const txResult = await attachTransactionItems(transaction);

  const orderResult = {
    id: updatedOrder.id,
    orderNumber: updatedOrder.order_number,
    tableNo: updatedOrder.table_no,
    status: updatedOrder.status,
    isPaid: updatedOrder.is_paid,
    total: updatedOrder.total,
    createdAt: updatedOrder.created_at,
    updatedAt: updatedOrder.updated_at,
    items: (orderItems || []).map(i => ({ menuId: i.menu_id, name: i.name, price: i.price, qty: i.qty, emoji: i.emoji, imageUrl: i.image_url })),
  };

  await broadcast('PAYMENT_PROCESSED', { transaction: txResult, order: orderResult });

  res.status(201).json(txResult);
};
