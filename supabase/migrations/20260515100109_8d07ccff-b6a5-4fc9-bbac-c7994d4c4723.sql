ALTER TABLE public.coupons
  DROP COLUMN leading_code,
  DROP COLUMN issue_source,
  DROP COLUMN usage_category,
  DROP COLUMN type_serial,
  DROP COLUMN serial_number,
  DROP COLUMN check_digit;