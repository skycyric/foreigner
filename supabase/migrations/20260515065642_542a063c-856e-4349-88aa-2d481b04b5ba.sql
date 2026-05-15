
-- 1. 廢棄舊機制
DROP TRIGGER IF EXISTS trg_assign_coupons_on_participant ON public.participants;
DROP FUNCTION IF EXISTS public.assign_coupons_to_participant();
DROP TABLE IF EXISTS public.coupon_allocation_rules;

-- 2. 重建 coupons 表
DROP TABLE IF EXISTS public.coupons;

CREATE TABLE public.coupons (
  coupon_code      char(16) PRIMARY KEY,
  email            text NOT NULL REFERENCES public.participants(email) ON DELETE CASCADE,
  assigned_at      timestamptz NOT NULL DEFAULT now(),
  used_at          timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),

  -- generated columns（由 coupon_code 自動拆解）
  leading_code     char(2) GENERATED ALWAYS AS (substring(coupon_code FROM 1 FOR 2)) STORED,
  issue_source     char(1) GENERATED ALWAYS AS (substring(coupon_code FROM 3 FOR 1)) STORED,
  usage_category   char(1) GENERATED ALWAYS AS (substring(coupon_code FROM 4 FOR 1)) STORED,
  type_serial      char(2) GENERATED ALWAYS AS (substring(coupon_code FROM 5 FOR 2)) STORED,
  serial_number    char(9) GENERATED ALWAYS AS (substring(coupon_code FROM 7 FOR 9)) STORED,
  check_digit      char(1) GENERATED ALWAYS AS (substring(coupon_code FROM 16 FOR 1)) STORED,

  CONSTRAINT coupons_code_format_chk
    CHECK (coupon_code ~ '^[0-9]{2}[WER][1-7][0-9]{11}$')
);

CREATE INDEX idx_coupons_email ON public.coupons(email);
CREATE INDEX idx_coupons_email_used ON public.coupons(email, used_at);

-- 3. RLS
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read coupons"
  ON public.coupons FOR SELECT
  USING (true);

CREATE POLICY "Anyone can insert coupon claim"
  ON public.coupons FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can update coupon used_at"
  ON public.coupons FOR UPDATE
  USING (true)
  WITH CHECK (true);
