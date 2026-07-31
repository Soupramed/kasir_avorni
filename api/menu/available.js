/* ============================================
   API: GET /api/menu/available — Only available items
   ============================================ */
const { supabase } = require('../../../lib/supabase');

function fmt(item) {
  return {
    id: item.id, name: item.name, price: item.price,
    category: item.category, emoji: item.emoji,
    imageUrl: item.image_url, available: item.available,
    lapakId: item.lapak_id || null, createdAt: item.created_at,
  };
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { data, error } = await supabase
    .from('menu')
    .select('*')
    .eq('available', true)
    .order('category')
    .order('name');

  if (error) return res.status(500).json({ error: error.message });
  res.json(data.map(fmt));
};
