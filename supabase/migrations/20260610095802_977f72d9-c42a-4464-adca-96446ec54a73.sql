-- Tighten RLS on participants and lottery_entries to stop exposing emails publicly.
-- App is anonymous (no auth); we keep INSERT public so registration/scan still works,
-- but remove public SELECT (emails were readable) and remove the always-true UPDATE.

DROP POLICY IF EXISTS "Anyone can read lottery entries" ON public.lottery_entries;

DROP POLICY IF EXISTS "Anyone can read participant" ON public.participants;
DROP POLICY IF EXISTS "Anyone can update participant language/device" ON public.participants;

-- INSERT policies remain in place so anonymous users can still register and submit entries.
-- SELECT/UPDATE are now denied for anon/authenticated; service_role retains full access for admin tasks.