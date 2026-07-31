/* ============================================
   API: /api/lapak/[id] — GET, PUT, DELETE single lapak
   ============================================ */
const { supabase, broadcast } = require('../../../lib/supabase');

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

module.exports = async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { id } = req.query;

  const { data: existing, error: fetchErr } = await supabase.from('lapak').select('*').eq('id', id).single();
  if (fetchErr || !existing) return res.status(404).json({ error: 'Lapak tidak ditemukan' });

  if (req.method === 'GET') {
    return res.json(existing);
  }

  if (req.method === 'PUT') {
    const { name, ownerName, taxPerItem, active } = req.body || {};
    const updates = {
      name: name ?? existing.name,
      owner_name: ownerName ?? existing.owner_name,
      tax_per_item: taxPerItem ?? existing.tax_per_item,
      active: active !== undefined ? (active ? true : false) : existing.active,
    };

    const { data: updated, error } = await supabase.from('lapak').update(updates).eq('id', id).select().single();
    if (error) return res.status(500).json({ error: error.message });

    await broadcast('LAPAK_UPDATED', updated);
    return res.json(updated);
  }

  if (req.method === 'DELETE') {
    const { error } = await supabase.from('lapak').delete().eq('id', id);
    if (error) return res.status(500).json({ error: error.message });

    await broadcast('LAPAK_UPDATED', { id, deleted: true });
    return res.json({ success: true });
  }

  res.status(405).json({ error: 'Method not allowed' });
};
