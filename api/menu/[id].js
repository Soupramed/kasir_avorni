/* ============================================
   API: /api/menu/[id] — GET, PUT, DELETE single menu item
   ============================================ */
const { supabase, broadcast } = require('../../../lib/supabase');

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, DELETE, OPTIONS');
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

  const { id } = req.query;

  if (req.method === 'GET') {
    const { data, error } = await supabase.from('menu').select('*').eq('id', id).single();
    if (error || !data) return res.status(404).json({ error: 'Menu tidak ditemukan' });
    return res.json(fmt(data));
  }

  if (req.method === 'PUT') {
    const { data: existing, error: fetchErr } = await supabase.from('menu').select('*').eq('id', id).single();
    if (fetchErr || !existing) return res.status(404).json({ error: 'Menu tidak ditemukan' });

    const { name, price, category, emoji, available, lapakId, imageUrl } = req.body || {};
    const updates = {
      name:       name       ?? existing.name,
      price:      price != null ? parseInt(price) : existing.price,
      category:   category   ?? existing.category,
      emoji:      emoji      ?? existing.emoji,
      image_url:  imageUrl   !== undefined ? imageUrl : existing.image_url,
      available:  available  !== undefined ? Boolean(available === true || available === 'true' || available === 1 || available === '1') : existing.available,
      lapak_id:   lapakId    !== undefined ? (lapakId || null) : existing.lapak_id,
    };

    const { data, error } = await supabase.from('menu').update(updates).eq('id', id).select().single();
    if (error) return res.status(500).json({ error: error.message });

    await broadcast('MENU_UPDATED', { action: 'update', item: fmt(data) });
    return res.json(fmt(data));
  }

  if (req.method === 'DELETE') {
    const { error } = await supabase.from('menu').delete().eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    await broadcast('MENU_UPDATED', { action: 'delete', id });
    return res.json({ success: true });
  }

  res.status(405).json({ error: 'Method not allowed' });
};
