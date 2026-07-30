/* ============================================
   ROUTE: /api/users — User Management
   ============================================ */

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { getDb, generateId } = require('../db');

// GET /api/users
router.get('/', (req, res) => {
  const db = getDb();
  const users = db.prepare('SELECT id, username, role, name, created_at FROM users ORDER BY created_at').all();
  // Also include password (plain) for admin view — in a real app you'd never do this
  // but since the original design showed passwords in the admin panel, we keep it compatible
  const fullUsers = db.prepare('SELECT * FROM users ORDER BY created_at').all();

  res.json(fullUsers.map(u => ({
    id: u.id,
    username: u.username,
    password: '••••••', // masked for security, but we keep original behavior
    role: u.role,
    name: u.name,
  })));
});

// POST /api/users — Add user
router.post('/', (req, res) => {
  const { username, password, role, name } = req.body;

  if (!username || !password || !role || !name) {
    return res.status(400).json({ error: 'Semua field wajib diisi' });
  }

  const db = getDb();

  // Check duplicate
  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (existing) {
    return res.status(409).json({ error: 'Username sudah digunakan' });
  }

  const id = generateId();
  const hashed = bcrypt.hashSync(password, 10);
  db.prepare('INSERT INTO users (id, username, password, role, name) VALUES (?, ?, ?, ?, ?)')
    .run(id, username, hashed, role, name);

  res.status(201).json({
    id,
    username,
    password: '••••••',
    role,
    name,
  });
});

// PUT /api/users/:id — Update user
router.put('/:id', (req, res) => {
  const { username, password, role, name } = req.body;
  const db = getDb();

  const existing = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!existing) {
    return res.status(404).json({ error: 'User tidak ditemukan' });
  }

  // Check duplicate username (if changed)
  if (username && username !== existing.username) {
    const duplicate = db.prepare('SELECT id FROM users WHERE username = ? AND id != ?').get(username, req.params.id);
    if (duplicate) {
      return res.status(409).json({ error: 'Username sudah digunakan' });
    }
  }

  // Update fields
  const newUsername = username || existing.username;
  const newRole = role || existing.role;
  const newName = name || existing.name;
  const newPassword = password ? bcrypt.hashSync(password, 10) : existing.password;

  db.prepare('UPDATE users SET username = ?, password = ?, role = ?, name = ? WHERE id = ?')
    .run(newUsername, newPassword, newRole, newName, req.params.id);

  res.json({
    id: req.params.id,
    username: newUsername,
    password: '••••••',
    role: newRole,
    name: newName,
  });
});

// DELETE /api/users/:id
router.delete('/:id', (req, res) => {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!existing) {
    return res.status(404).json({ error: 'User tidak ditemukan' });
  }

  // Prevent deleting last admin
  if (existing.role === 'admin') {
    const adminCount = db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'admin'").get().count;
    if (adminCount <= 1) {
      return res.status(400).json({ error: 'Tidak bisa menghapus admin terakhir' });
    }
  }

  db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

module.exports = router;
