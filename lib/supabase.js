/* ============================================
   AVORNI COFFEE POS — Supabase Client (Server-side)
   Used by all Vercel API routes (service_role key)
   ============================================ */

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl  = process.env.SUPABASE_URL;
const supabaseKey  = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables');
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false },
});

/* ---- ID helpers (matching previous db.js API) ---- */
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
}

async function generateOrderNumber() {
  const today = new Date().toISOString().split('T')[0];

  // Upsert counter for today, increment atomically using Postgres
  const { data, error } = await supabase.rpc('increment_order_counter', { p_date: today });

  if (error) {
    // Fallback: use timestamp-based number if RPC fails
    console.error('increment_order_counter error:', error.message);
    return 'ORD-' + Date.now().toString().slice(-4);
  }

  return 'ORD-' + String(data).padStart(3, '0');
}

/* ---- Broadcast helper (via Supabase Realtime channels) ---- */
async function broadcast(type, payload) {
  // Uses the "pos-events" channel — clients subscribe to this
  const channel = supabase.channel('pos-events');
  await channel.send({ type: 'broadcast', event: type, payload });
  await supabase.removeChannel(channel);
}

module.exports = { supabase, generateId, generateOrderNumber, broadcast };
