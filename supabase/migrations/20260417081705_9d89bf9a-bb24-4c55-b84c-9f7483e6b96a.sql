
-- ============== participants ==============
CREATE TABLE public.participants (
  email TEXT PRIMARY KEY,
  device_id TEXT,
  language TEXT NOT NULL DEFAULT 'zh',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_participants_device ON public.participants(device_id);

ALTER TABLE public.participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert participant"
  ON public.participants FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can read participant"
  ON public.participants FOR SELECT
  USING (true);

CREATE POLICY "Anyone can update participant language/device"
  ON public.participants FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- ============== coupons ==============
CREATE TABLE public.coupons (
  coupon_code TEXT PRIMARY KEY,
  email TEXT REFERENCES public.participants(email) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ,
  used_at TIMESTAMPTZ,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_coupons_email ON public.coupons(email);

ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read coupons"
  ON public.coupons FOR SELECT
  USING (true);

-- ============== lottery_entries ==============
CREATE TABLE public.lottery_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tn_number TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL REFERENCES public.participants(email) ON DELETE CASCADE,
  raw_payload TEXT,
  source TEXT NOT NULL DEFAULT 'manual',  -- 'manual' | 'qr'
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_lottery_email ON public.lottery_entries(email);

ALTER TABLE public.lottery_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert lottery entry"
  ON public.lottery_entries FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can read lottery entries"
  ON public.lottery_entries FOR SELECT
  USING (true);

-- ============== valid_transactions (mock) ==============
CREATE TABLE public.valid_transactions (
  tn_number TEXT PRIMARY KEY,
  amount NUMERIC(12,2),
  txn_date DATE,
  store_code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.valid_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read valid_transactions"
  ON public.valid_transactions FOR SELECT
  USING (true);

-- ============== winners ==============
CREATE TABLE public.winners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prize_name TEXT NOT NULL,
  masked_email TEXT NOT NULL,
  rank INTEGER NOT NULL DEFAULT 1,
  is_backup BOOLEAN NOT NULL DEFAULT false,
  announced_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.winners ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read winners"
  ON public.winners FOR SELECT
  USING (true);

-- ============== updated_at trigger ==============
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_participants_updated_at
  BEFORE UPDATE ON public.participants
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============== Seed mock data ==============
INSERT INTO public.valid_transactions (tn_number, amount, txn_date, store_code) VALUES
  ('YA2101223580', 14980, '2025-12-06', 'ER'),
  ('YA2101223581', 2380,  '2025-12-06', 'ER'),
  ('YB1099887766', 9900,  '2025-12-07', 'ER'),
  ('YC0011223344', 18800, '2025-12-08', 'ER'),
  ('YA9988776655', 5680,  '2025-12-08', 'ER');

INSERT INTO public.coupons (coupon_code, note) VALUES
  ('ER2025DISC0001', '滿千折百'),
  ('ER2025DISC0002', '滿千折百'),
  ('ER2025DISC0003', '滿千折百'),
  ('ER2025DISC0004', '滿千折百'),
  ('ER2025DISC0005', '滿千折百');

INSERT INTO public.winners (prize_name, masked_email, rank, is_backup) VALUES
  ('iPhone 17 Pro',     'a***@gmail.com',     1, false),
  ('AirPods Pro 3',     'm***@yahoo.com.tw',  2, false),
  ('百貨禮券 5,000元',   't***@hotmail.com',   3, false),
  ('百貨禮券 1,000元',   'k***@gmail.com',     4, true);
