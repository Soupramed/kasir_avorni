/* ============================================
   API: GET /api/transactions/today
   ============================================ */
const { supabase } = require('../../lib/supabase');

async function attachTransactionItems(transaction) {
  const { data: items } = await supabase
    .from('transaction_items')
    .select('*')
    .eq('transaction_id', transaction.id);

  return {
    id: transaction.id,
    orderId: transaction.order_id,
    orderNumber: transaction.order_number,
    customerName: transaction.customer_name,
    tableNo: transaction.table_no,
    total: transaction.total,
    paymentMethod: transaction.payment_method,
    amountPaid: transaction.amount_paid,
    changeAmount: transaction.change_amount,
    cashier: transaction.cashier,
    paidAt: transaction.paid_at,
    items: (items || []).map(i => ({
      name: i.name,
      price: i.price,
      qty: i.qty,
      emoji: i.emoji,
      imageUrl: i.image_url,
    })),
  };
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const today = new Date();
  today.setHours(0,0,0,0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .gte('paid_at', today.toISOString())
    .lt('paid_at', tomorrow.toISOString())
    .order('paid_at', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });

  const result = await Promise.all(data.map(attachTransactionItems));
  res.json(result);
};
