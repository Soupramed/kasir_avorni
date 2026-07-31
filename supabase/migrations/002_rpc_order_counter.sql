-- ============================================================
--  Supabase RPC: increment_order_counter
--  Call: supabase.rpc('increment_order_counter', { p_date: 'YYYY-MM-DD' })
--  Returns: integer (new counter value for that day)
-- ============================================================
CREATE OR REPLACE FUNCTION increment_order_counter(p_date TEXT)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_counter INTEGER;
BEGIN
  INSERT INTO order_counter (date_key, counter)
  VALUES (p_date, 1)
  ON CONFLICT (date_key)
  DO UPDATE SET counter = order_counter.counter + 1
  RETURNING counter INTO v_counter;

  -- Clean old entries (keep only today)
  DELETE FROM order_counter WHERE date_key != p_date;

  RETURN v_counter;
END;
$$;
