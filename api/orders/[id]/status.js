/* ============================================
   API: PUT /api/orders/[id]/status — Update status
   ============================================ */
const { supabase, broadcast } = require('../../../../lib/supabase');

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'PUT, OPTIONS');
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
  if (req.method !== 'PUT') return res.status(405).json({ error: 'Method not allowed' });

  const { id } = req.query;
  const { status } = req.body || {};
  const validStatuses = ['baru', 'proses', 'siap', 'diantar', 'selesai'];

  if (!status || !validStatuses.includes(status)) {
    return res.status(400).json({ error: 'Status tidak valid' });
  }

  const { data: existing, error: fetchErr } = await supabase.from('orders').select('*').eq('id', id).single();
  if (fetchErr || !existing) {
    return res.status(404).json({ error: 'Pesanan tidak ditemukan' });
  }

  const finalStatus = (status === 'diantar' && existing.is_paid) ? 'selesai' : status;
  const now = new Date().toISOString();

  const { data: updated, error: updateErr } = await supabase
    .from('orders')
    .update({ status: finalStatus, updated_at: now })
    .eq('id', id)
    .select()
    .single();

  if (updateErr) return res.status(500).json({ error: updateErr.message });

  const result = await attachItems(updated);
  await broadcast('ORDER_UPDATED', result);

  res.json(result);
};
