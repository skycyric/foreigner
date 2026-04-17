-- Coupon allocation rules: defines which coupons get auto-assigned to new participants
CREATE TABLE public.coupon_allocation_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_name text NOT NULL,
  coupon_prefix text NOT NULL,
  note text,
  quantity_per_participant integer NOT NULL DEFAULT 1,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.coupon_allocation_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read allocation rules"
  ON public.coupon_allocation_rules FOR SELECT
  USING (true);

-- Function to auto-assign coupons when a new participant is created
CREATE OR REPLACE FUNCTION public.assign_coupons_to_participant()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rule RECORD;
  i integer;
  new_code text;
BEGIN
  -- Only assign on INSERT (not UPDATE)
  IF TG_OP <> 'INSERT' THEN
    RETURN NEW;
  END IF;

  -- Skip if this email already has coupons
  IF EXISTS (SELECT 1 FROM public.coupons WHERE email = NEW.email) THEN
    RETURN NEW;
  END IF;

  FOR rule IN
    SELECT * FROM public.coupon_allocation_rules WHERE is_active = true
  LOOP
    FOR i IN 1..rule.quantity_per_participant LOOP
      -- Generate a unique coupon code: PREFIX + timestamp + random
      new_code := rule.coupon_prefix
        || to_char(now(), 'YYMMDD')
        || lpad(floor(random() * 10000)::text, 4, '0')
        || lpad(floor(random() * 10000)::text, 4, '0');

      INSERT INTO public.coupons (coupon_code, email, assigned_at, note)
      VALUES (new_code, NEW.email, now(), rule.note)
      ON CONFLICT (coupon_code) DO NOTHING;
    END LOOP;
  END LOOP;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_assign_coupons_after_participant_insert
AFTER INSERT ON public.participants
FOR EACH ROW
EXECUTE FUNCTION public.assign_coupons_to_participant();

-- Seed mock allocation rules (every new participant gets these coupons)
INSERT INTO public.coupon_allocation_rules (rule_name, coupon_prefix, note, quantity_per_participant) VALUES
  ('新會員迎賓 9 折券', 'WELCOME', '全館9折優惠券', 1),
  ('滿千折百券', 'SAVE100', '滿$1000折$100', 2),
  ('飲料免費券', 'DRINK', '指定飲品免費兌換券', 1);
