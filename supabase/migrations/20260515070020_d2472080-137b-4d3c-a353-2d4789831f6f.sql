
ALTER TABLE public.coupons DROP CONSTRAINT coupons_code_format_chk;

ALTER TABLE public.coupons ADD CONSTRAINT coupons_code_format_chk
  CHECK (coupon_code ~ '^[0-9]{2}[WER][1-7][0-9]{12}$');
