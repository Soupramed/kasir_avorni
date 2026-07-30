/* ============================================
   ROUTE: /api/events — Server-Sent Events
   Real-time notifications across all clients
   ============================================ */

const express = require('express');
const router = express.Router();

// GET /api/events — SSE endpoint
router.get('/', (req, res) => {
  // Set headers for SSE
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
  });

  // Send initial connection message
  res.write(`data: ${JSON.stringify({ type: 'CONNECTED', payload: null, timestamp: Date.now() })}\n\n`);

  // Add client to SSE pool
  const sseClients = req.app.get('sseClients');
  sseClients.add(res);

  // Keep-alive ping every 30 seconds
  const keepAlive = setInterval(() => {
    res.write(': keepalive\n\n');
  }, 30000);

  // Remove client on disconnect
  req.on('close', () => {
    clearInterval(keepAlive);
    sseClients.delete(res);
  });
});

module.exports = router;
