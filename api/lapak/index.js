/* ============================================
   API: /api/lapak — GET all lapak, POST create lapak
   ============================================ */
const { supabase, generateId, broadcast } = require('../../lib/supabase');

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

module.exports = async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'GET') {
    const { data: lapakList, error } = await supabase.from('lapak').select('*').order('name', { ascending: true });
    if (error) return res.status(500).json({ error: error.message });
    return res.json(lapakList);
  }

  if (req.method === 'POST') {
    const { name, ownerName, taxPerItem } = req.body || {};
    if (!name || !ownerName) {
      return res.status(400).json({ error: 'Nama lapak dan pemilik wajib diisi' });
    }

    const id = generateId();
    const now = new Date().toISOString();

    const { data: lapak, error } = await supabase
      .from('lapak')
      .insert({ id, name, owner_name: ownerName, tax_per_item: taxPerItem ?? 1000, active: true, created_at: now })
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });

    await broadcast('LAPAK_UPDATED', lapak);
    return res.status(201).json(lapak);
  }

  res.status(405).json({ error: 'Method not allowed' });
};
