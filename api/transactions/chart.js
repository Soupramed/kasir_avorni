/* ============================================
   API: GET /api/transactions/chart — Last 7 days revenue chart
   ============================================ */
const { supabase } = require('../../lib/supabase');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const d = new Date();
  d.setDate(d.getDate() - 6);
  d.setHours(0, 0, 0, 0);

  const { data: transactions, error } = await supabase
    .from('transactions')
    .select('paid_at, total')
    .gte('paid_at', d.toISOString());

  if (error) return res.status(500).json({ error: error.message });

  const daily = {};
  for (let i = 6; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    daily[date.toISOString().split('T')[0]] = 0;
  }

  (transactions || []).forEach(t => {
    const date = t.paid_at.split('T')[0];
    if (daily[date] !== undefined) {
      daily[date] += t.total;
    }
  });

  res.json(Object.keys(daily).map(date => ({
    date,
    revenue: daily[date]
  })));
};
