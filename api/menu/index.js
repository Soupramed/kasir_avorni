/* ============================================
   API: /api/menu — GET all, POST create
   ============================================ */
const { supabase, generateId, broadcast } = require('../../lib/supabase');

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function fmt(item) {
  return {
    id: item.id, name: item.name, price: item.price,
    category: item.category, emoji: item.emoji,
    imageUrl: item.image_url, available: item.available,
    lapakId: item.lapak_id || null, createdAt: item.created_at,
  };
}

module.exports = async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  // GET /api/menu
  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('menu')
      .select('*')
      .order('category')
      .order('name');
    if (error) return res.status(500).json({ error: error.message });
    return res.json(data.map(fmt));
  }

  // POST /api/menu
  if (req.method === 'POST') {
    const { name, price, category, emoji, lapakId, imageUrl } = req.body || {};
    if (!name || !price || !category)
      return res.status(400).json({ error: 'Nama, harga, dan kategori wajib diisi' });

    const id = generateId();
    const { data, error } = await supabase
      .from('menu')
      .insert({ id, name, price: parseInt(price), category, emoji: emoji || '☕', image_url: imageUrl || null, available: true, lapak_id: lapakId || null })
      .select()
      .single();
    if (error) return res.status(500).json({ error: error.message });

    await broadcast('MENU_UPDATED', { action: 'add', item: fmt(data) });
    return res.status(201).json(fmt(data));
  }

  res.status(405).json({ error: 'Method not allowed' });
};
