/* ============================================
   API: /api/users — GET all users, POST add user
   ============================================ */
const bcrypt = require('bcryptjs');
const { supabase, generateId } = require('../../lib/supabase');

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

module.exports = async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'GET') {
    const { data: users, error } = await supabase
      .from('users')
      .select('id, username, role, name, created_at')
      .order('created_at', { ascending: true });

    if (error) return res.status(500).json({ error: error.message });

    return res.json((users || []).map(u => ({
      id: u.id,
      username: u.username,
      password: '••••••',
      role: u.role,
      name: u.name,
    })));
  }

  if (req.method === 'POST') {
    const { username, password, role, name } = req.body || {};
    if (!username || !password || !role || !name) {
      return res.status(400).json({ error: 'Semua field wajib diisi' });
    }

    const { data: existing } = await supabase.from('users').select('id').eq('username', username).single();
    if (existing) {
      return res.status(409).json({ error: 'Username sudah digunakan' });
    }

    const id = generateId();
    const hashed = bcrypt.hashSync(password, 10);

    const { data: newUser, error } = await supabase
      .from('users')
      .insert({ id, username, password: hashed, role, name })
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });

    return res.status(201).json({
      id: newUser.id,
      username: newUser.username,
      password: '••••••',
      role: newUser.role,
      name: newUser.name,
    });
  }

  res.status(405).json({ error: 'Method not allowed' });
};
