/* ============================================
   API: GET /api/orders/active — Non-completed orders
   ============================================ */
const { supabase } = require('../../lib/supabase');

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
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .neq('status', 'selesai')
    .order('created_at', { ascending: true });

  if (error) return res.status(500).json({ error: error.message });
  const result = await Promise.all(data.map(attachItems));
  res.json(result);
};
