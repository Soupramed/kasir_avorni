/* ============================================
   API: GET /api/transactions/summary — Summary for date
   ============================================ */
const { supabase } = require('../../lib/supabase');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const dateStr = req.query.date || new Date().toISOString().split('T')[0];
  const startDate = new Date(dateStr);
  startDate.setHours(0,0,0,0);
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + 1);

  const { data: transactions, error } = await supabase
    .from('transactions')
    .select('*')
    .gte('paid_at', startDate.toISOString())
    .lt('paid_at', endDate.toISOString());

  if (error) return res.status(500).json({ error: error.message });

  const txs = transactions || [];
  const totalRevenue = txs.reduce((sum, t) => sum + t.total, 0);
  const totalCash = txs.filter(t => t.payment_method === 'tunai').reduce((sum, t) => sum + t.total, 0);
  const totalQris = txs.filter(t => t.payment_method === 'qris').reduce((sum, t) => sum + t.total, 0);

  res.json({
    totalTransactions: txs.length,
    totalRevenue,
    totalCash,
    totalQris,
  });
};
