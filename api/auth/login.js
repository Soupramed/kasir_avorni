/* ============================================
   API: POST /api/auth/login
   ============================================ */
const bcrypt = require('bcryptjs');
const { supabase } = require('../../lib/supabase');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { username, password } = req.body || {};
  if (!username || !password)
    return res.status(400).json({ error: 'Username dan password wajib diisi' });

  const { data: user, error } = await supabase
    .from('users')
    .select('*')
    .eq('username', username)
    .single();

  if (error || !user)
    return res.status(401).json({ error: 'Username atau password salah' });

  const valid = bcrypt.compareSync(password, user.password);
  if (!valid)
    return res.status(401).json({ error: 'Username atau password salah' });

  res.json({ id: user.id, username: user.username, role: user.role, name: user.name });
};
