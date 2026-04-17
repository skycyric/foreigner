-- 1. 建立 trigger：新 participant 自動配券
CREATE TRIGGER trg_assign_coupons_on_participant
AFTER INSERT ON public.participants
FOR EACH ROW
EXECUTE FUNCTION public.assign_coupons_to_participant();

-- 2. 回填現有 participants 的折扣券
DO $$
DECLARE
  p RECORD;
  rule RECORD;
  i integer;
  new_code text;
BEGIN
  FOR p IN SELECT email FROM public.participants LOOP
    -- 跳過已有券的 email
    IF EXISTS (SELECT 1 FROM public.coupons WHERE email = p.email) THEN
      CONTINUE;
    END IF;
    FOR rule IN SELECT * FROM public.coupon_allocation_rules WHERE is_active = true LOOP
      FOR i IN 1..rule.quantity_per_participant LOOP
        new_code := rule.coupon_prefix
          || to_char(now(), 'YYMMDD')
          || lpad(floor(random() * 10000)::text, 4, '0')
          || lpad(floor(random() * 10000)::text, 4, '0');
        INSERT INTO public.coupons (coupon_code, email, assigned_at, note)
        VALUES (new_code, p.email, now(), rule.note)
        ON CONFLICT (coupon_code) DO NOTHING;
      END LOOP;
    END LOOP;
  END LOOP;
END $$;