ALTER TABLE public.lottery_entries ADD COLUMN transaction_time timestamptz;
CREATE INDEX idx_lottery_transaction_time ON public.lottery_entries(transaction_time);