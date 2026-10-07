-- 1) Case keys are never reused. projects.last_case_number is a per-project high-water mark of
--    the highest case number ever created; the app allocates max(highest existing, mark) + 1.
--    A trigger keeps the mark current on every insert, so deleting the newest cases cannot
--    hand their keys out again.
alter table public.projects
  add column if not exists last_case_number integer not null default 0;

update public.projects p
set last_case_number = greatest(p.last_case_number, coalesce((
  select max(c.case_number) from public.test_cases c where c.project_id = p.id
), 0));

create or replace function public.bump_project_case_number()
returns trigger
language plpgsql
as $$
begin
  if new.case_number is not null then
    update public.projects
    set last_case_number = greatest(last_case_number, new.case_number)
    where id = new.project_id and last_case_number < new.case_number;
  end if;
  return new;
end;
$$;

drop trigger if exists test_cases_bump_case_number on public.test_cases;
create trigger test_cases_bump_case_number
  after insert on public.test_cases
  for each row execute function public.bump_project_case_number();

-- 2) Generated cases a user deleted are remembered (normalized title) so case generation
--    ("analyze" and "fill gaps") never suggests them again.
create table if not exists public.dismissed_case_titles (
  project_id uuid not null references public.projects (id) on delete cascade,
  normalized_title text not null check (char_length(normalized_title) between 1 and 300),
  created_at timestamptz not null default now(),
  primary key (project_id, normalized_title)
);

alter table public.dismissed_case_titles enable row level security;
create policy dismissed_case_titles_authenticated_all on public.dismissed_case_titles
  for all to authenticated using (true) with check (true);
