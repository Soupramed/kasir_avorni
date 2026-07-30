/* ============================================
   AVORNI COFFEE POS — Express Server
   ============================================ */

const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// --- Middleware ---
app.use(cors());
app.use(express.json());

// Serve static files from public/
app.use(express.static(path.join(__dirname, 'public')));

// --- SSE: Server-Sent Events for real-time ---
const sseClients = new Set();

function broadcastEvent(type, payload) {
  const data = JSON.stringify({ type, payload, timestamp: Date.now() });
  for (const client of sseClients) {
    client.write(`data: ${data}\n\n`);
  }
}

// Make broadcast available to routes
app.set('broadcast', broadcastEvent);
app.set('sseClients', sseClients);

// --- Routes ---
app.use('/api/auth', require('./routes/auth'));
app.use('/api/menu', require('./routes/menu'));
app.use('/api/orders', require('./routes/orders'));
app.use('/api/transactions', require('./routes/transactions'));
app.use('/api/users', require('./routes/users'));
app.use('/api/events', require('./routes/events'));

// --- Fallback: serve index.html for any non-API route ---
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// --- Start Server ---
app.listen(PORT, () => {
  console.log(`\n  ☕ Avorni Coffee POS Server`);
  console.log(`  🚀 Running at http://localhost:${PORT}`);
  console.log(`  📂 Serving static files from ./public\n`);
});
