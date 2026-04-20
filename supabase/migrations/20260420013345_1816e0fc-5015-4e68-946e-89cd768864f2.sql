DROP TABLE IF EXISTS public.valid_transactions CASCADE;

CREATE UNIQUE INDEX IF NOT EXISTS lottery_entries_tn_number_unique
  ON public.lottery_entries (tn_number);