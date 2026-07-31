/* ============================================
   API: GET /api/events (Legacy SSE endpoint fallback)
   Realtime updates are handled client-side via Supabase Realtime JS / WebSockets.
   ============================================ */
module.exports = function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');
  res.json({
    status: 'realtime_active',
    message: 'Avorni POS uses Supabase Realtime WebSockets directly from client side.',
  });
};
