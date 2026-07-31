/* ============================================
   API: /api/users/[id] — PUT update, DELETE remove user
   ============================================ */
const bcrypt = require('bcryptjs');
const { supabase } = require('../../../lib/supabase');

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

module.exports = async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { id } = req.query;

  const { data: existing, error: fetchErr } = await supabase.from('users').select('*').eq('id', id).single();
  if (fetchErr || !existing) {
    return res.status(404).json({ error: 'User tidak ditemukan' });
  }

  if (req.method === 'PUT') {
    const { username, password, role, name } = req.body || {};

    if (username && username !== existing.username) {
      const { data: dup } = await supabase.from('users').select('id').eq('username', username).neq('id', id).single();
      if (dup) {
        return res.status(409).json({ error: 'Username sudah digunakan' });
      }
    }

    const updates = {
      username: username || existing.username,
      role: role || existing.role,
      name: name || existing.name,
      password: password ? bcrypt.hashSync(password, 10) : existing.password,
    };

    const { data: updated, error } = await supabase.from('users').update(updates).eq('id', id).select().single();
    if (error) return res.status(500).json({ error: error.message });

    return res.json({
      id: updated.id,
      username: updated.username,
      password: '••••••',
      role: updated.role,
      name: updated.name,
    });
  }

  if (req.method === 'DELETE') {
    if (existing.role === 'admin') {
      const { count } = await supabase.from('users').select('id', { count: 'exact', head: true }).eq('role', 'admin');
      if (count <= 1) {
        return res.status(400).json({ error: 'Tidak bisa menghapus admin terakhir' });
      }
    }

    const { error } = await supabase.from('users').delete().eq('id', id);
    if (error) return res.status(500).json({ error: error.message });

    return res.json({ success: true });
  }

  res.status(405).json({ error: 'Method not allowed' });
};
