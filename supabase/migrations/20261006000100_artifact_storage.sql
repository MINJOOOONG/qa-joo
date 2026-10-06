-- Private bucket for Playwright artifacts (screenshots, traces, logs).
-- QA JOO serves them through /api/artifacts/* with short-lived signed URLs,
-- so the bucket itself is never public.
insert into storage.buckets (id, name, public)
values ('qa-artifacts', 'qa-artifacts', false)
on conflict (id) do nothing;
