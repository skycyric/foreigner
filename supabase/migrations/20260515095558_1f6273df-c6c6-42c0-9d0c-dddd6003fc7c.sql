ALTER TABLE public.coupons
  DROP COLUMN leading_code,
  DROP COLUMN issue_source,
  DROP COLUMN usage_category,
  DROP COLUMN type_serial,
  DROP COLUMN serial_number,
  DROP COLUMN check_digit,
  DROP CONSTRAINT coupons_code_format_chk,
  DROP COLUMN assigned_at;

ALTER TABLE public.coupons RENAME COLUMN coupon_code TO coupon_serialnum;
ALTER TABLE public.coupons RENAME COLUMN used_at    TO used_date;

ALTER TABLE public.coupons
  ADD CONSTRAINT coupons_serialnum_format_chk
    CHECK (coupon_serialnum ~ '^[0-9]{2}[WER][1-7][0-9]{11}$'),
  ADD COLUMN leading_code   char(2) GENERATED ALWAYS AS (substring(coupon_serialnum FROM 1 FOR 2)) STORED,
  ADD COLUMN issue_source   char(1) GENERATED ALWAYS AS (substring(coupon_serialnum FROM 3 FOR 1)) STORED,
  ADD COLUMN usage_category char(1) GENERATED ALWAYS AS (substring(coupon_serialnum FROM 4 FOR 1)) STORED,
  ADD COLUMN type_serial    char(2) GENERATED ALWAYS AS (substring(coupon_serialnum FROM 5 FOR 2)) STORED,
  ADD COLUMN serial_number  char(9) GENERATED ALWAYS AS (substring(coupon_serialnum FROM 7 FOR 9)) STORED,
  ADD COLUMN check_digit    char(1) GENERATED ALWAYS AS (substring(coupon_serialnum FROM 16 FOR 1)) STORED;