/* ============================================
   API: GET /api/lapak/report — Report revenue and tax per lapak for date
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

  const { data: lapakList, error: lapakErr } = await supabase.from('lapak').select('*');
  if (lapakErr) return res.status(500).json({ error: lapakErr.message });

  // Get transactions for the date
  const { data: transactions } = await supabase
    .from('transactions')
    .select('id')
    .gte('paid_at', startDate.toISOString())
    .lt('paid_at', endDate.toISOString());

  const txIds = (transactions || []).map(t => t.id);

  let items = [];
  if (txIds.length > 0) {
    const { data: txItems } = await supabase
      .from('transaction_items')
      .select('name, price, qty, lapak_id, transaction_id')
      .in('transaction_id', txIds);
    items = txItems || [];
  }

  const report = (lapakList || []).map(lapak => {
    const lapakItems = items.filter(i => i.lapak_id === lapak.id);
    const totalQty = lapakItems.reduce((sum, i) => sum + i.qty, 0);
    const totalRevenue = lapakItems.reduce((sum, i) => sum + (i.price * i.qty), 0);
    const totalTax = totalQty * lapak.tax_per_item;

    return {
      ...lapak,
      totalQty,
      totalRevenue,
      totalTax,
      items: lapakItems,
    };
  });

  const grandTotalTax = report.reduce((sum, l) => sum + l.totalTax, 0);
  const grandTotalRevenue = report.reduce((sum, l) => sum + l.totalRevenue, 0);

  res.json({ date: dateStr, report, grandTotalTax, grandTotalRevenue });
};
