-- R1: Drop duplicate trigger on participants
-- Both triggers call assign_coupons_to_participant() with identical AFTER INSERT timing.
-- The function is idempotent (skips if email already has coupons), so behavior is unchanged.
DROP TRIGGER IF EXISTS trg_assign_coupons_after_participant_insert ON public.participants;

-- R2: Drop duplicate unique index on lottery_entries.tn_number
-- lottery_entries_tn_number_key (auto-created by UNIQUE constraint) is kept.
-- lottery_entries_tn_number_unique is the redundant manually-created one.
DROP INDEX IF EXISTS public.lottery_entries_tn_number_unique;