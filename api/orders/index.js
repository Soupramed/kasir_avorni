/* ============================================
   API: /api/orders — GET all, POST create
   ============================================ */
const { supabase, generateId, generateOrderNumber, broadcast } = require('../../lib/supabase');

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
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

  // GET /api/orders?status=baru
  if (req.method === 'GET') {
    let query = supabase.from('orders').select('*').order('created_at', { ascending: false });
    if (req.query.status) query = query.eq('status', req.query.status);
    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    const result = await Promise.all(data.map(attachItems));
    return res.json(result);
  }

  // POST /api/orders
  if (req.method === 'POST') {
    const { customerName, tableNo, items, notes, waiter } = req.body || {};
    if (!customerName || !tableNo || !items || items.length === 0)
      return res.status(400).json({ error: 'Nama pemesan, nomor meja, dan item pesanan wajib diisi' });

    const id = generateId();
    const orderNumber = await generateOrderNumber();
    const total = items.reduce((sum, item) => sum + (item.price * item.qty), 0);
    const now = new Date().toISOString();

    const { error: orderErr } = await supabase.from('orders').insert({
      id, order_number: orderNumber, customer_name: customerName,
      table_no: parseInt(tableNo), notes: notes || '', status: 'baru',
      total, waiter: waiter || 'Pelayan', created_at: now, updated_at: now,
    });
    if (orderErr) return res.status(500).json({ error: orderErr.message });

    // Insert items (resolve lapak_id from menu if not provided)
    const itemRows = await Promise.all(items.map(async (item) => {
      let lapakId = item.lapakId || null;
      if (!lapakId && item.menuId) {
        const { data: menuRow } = await supabase.from('menu').select('lapak_id').eq('id', item.menuId).single();
        lapakId = menuRow?.lapak_id || null;
      }
      return {
        order_id: id, menu_id: item.menuId || null,
        name: item.name, price: item.price, qty: item.qty,
        emoji: item.emoji || '☕', image_url: item.imageUrl || null, lapak_id: lapakId,
      };
    }));

    const { error: itemErr } = await supabase.from('order_items').insert(itemRows);
    if (itemErr) return res.status(500).json({ error: itemErr.message });

    const { data: order } = await supabase.from('orders').select('*').eq('id', id).single();
    const result = await attachItems(order);
    await broadcast('ORDER_CREATED', result);
    return res.status(201).json(result);
  }

  res.status(405).json({ error: 'Method not allowed' });
};
