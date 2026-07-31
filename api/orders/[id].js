/* ============================================
   API: /api/orders/[id] — GET single order, DELETE order
   ============================================ */
const { supabase } = require('../../../lib/supabase');

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

async function attachItems(order) {
  const { data: items } = await supabase.from('order_items').select('*').eq('order_id', order.id);
  return {
    id: order.id, orderNumber: order.order_number,
    customerName: order.customer_name, tableNo: order.table_no,
    notes: order.notes, status: order.status, isPaid: order.is_paid,
    total: order.total, waiter: order.waiter,
    createdAt: order.created_at, updatedAt: order.updated_at,
    items: (items || []).map(i => ({
      menuId: i.menu_id, name: i.name, price: i.price,
      qty: i.qty, emoji: i.emoji, imageUrl: i.image_url,
    })),
  };
}

module.exports = async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { id } = req.query;

  if (req.method === 'GET') {
    const { data: order, error } = await supabase.from('orders').select('*').eq('id', id).single();
    if (error || !order) return res.status(404).json({ error: 'Pesanan tidak ditemukan' });
    const result = await attachItems(order);
    return res.json(result);
  }

  if (req.method === 'DELETE') {
    const { error: itemErr } = await supabase.from('order_items').delete().eq('order_id', id);
    if (itemErr) return res.status(500).json({ error: itemErr.message });

    const { error: orderErr } = await supabase.from('orders').delete().eq('id', id);
    if (orderErr) return res.status(500).json({ error: orderErr.message });

    return res.json({ success: true });
  }

  res.status(405).json({ error: 'Method not allowed' });
};
