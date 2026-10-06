-- QA JOO initial schema.
-- Conventions: uuid primary keys, snake_case columns, timestamptz everywhere,
-- enum-like columns use CHECK constraints so values can evolve without enum migrations.

create or replace function public.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Projects ---------------------------------------------------------------
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  key text not null unique check (key ~ '^[A-Z][A-Z0-9]{1,9}$'),
  name text not null check (char_length(name) between 1 and 80),
  description text,
  app_url text check (app_url ~ '^https?://'),
  repo_url text check (repo_url ~ '^https://github\.com/'),
  environment text not null default 'staging'
    check (environment in ('local', 'development', 'staging', 'production')),
  last_analysis jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint projects_target_required check (app_url is not null or repo_url is not null)
);

-- Sections (hierarchical) ------------------------------------------------
create table public.sections (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  parent_id uuid references public.sections (id) on delete set null,
  name text not null check (char_length(name) between 1 and 120),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  constraint sections_not_own_parent check (parent_id is null or parent_id <> id)
);
create index sections_project_idx on public.sections (project_id, parent_id, sort_order);

-- Test cases -------------------------------------------------------------
create table public.test_cases (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  section_id uuid references public.sections (id) on delete set null,
  case_key text not null check (case_key ~ '^[A-Z][A-Z0-9]{1,9}-TC-[0-9]+$'),
  -- Numeric part of case_key, used to allocate the next key without listing every case.
  case_number integer generated always as ((substring(case_key from '-TC-([0-9]+)$'))::integer) stored,
  title text not null check (char_length(title) between 1 and 200),
  description text,
  preconditions text,
  steps jsonb not null default '[]'::jsonb check (jsonb_typeof(steps) = 'array'),
  expected_result text not null,
  type text not null check (type in (
    'functional', 'regression', 'smoke', 'e2e', 'api', 'integration',
    'negative', 'boundary', 'security', 'error'
  )),
  priority text not null check (priority in ('critical', 'high', 'medium', 'low')),
  automation_status text not null default 'manual'
    check (automation_status in ('manual', 'candidate', 'automated')),
  source text not null default 'manual' check (source in ('manual', 'ai_generated')),
  review_status text not null default 'approved' check (review_status in ('draft', 'approved', 'rejected')),
  tags text[] not null default '{}',
  ai_rationale text,
  last_result text check (last_result in ('untested', 'passed', 'failed', 'blocked', 'skipped')),
  last_result_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint test_cases_project_case_key_key unique (project_id, case_key),
  -- AI output can never skip the review gate by claiming to be manually authored.
  constraint test_cases_draft_is_ai check (review_status <> 'draft' or source = 'ai_generated')
);
create index test_cases_section_idx on public.test_cases (project_id, section_id);
create index test_cases_review_idx on public.test_cases (project_id, review_status);
create index test_cases_last_result_idx on public.test_cases (project_id, last_result);
create index test_cases_case_number_idx on public.test_cases (project_id, case_number desc);

-- Test runs --------------------------------------------------------------
create table public.test_runs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 160),
  environment text not null check (environment in ('local', 'development', 'staging', 'production')),
  build text,
  description text,
  status text not null default 'active' check (status in ('active', 'completed')),
  created_by text not null,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint test_runs_completed_at check ((status = 'completed') = (completed_at is not null))
);
create index test_runs_project_idx on public.test_runs (project_id, updated_at desc);

create table public.test_run_cases (
  id uuid primary key default gen_random_uuid(),
  test_run_id uuid not null references public.test_runs (id) on delete cascade,
  test_case_id uuid not null references public.test_cases (id) on delete cascade,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  constraint test_run_cases_run_case_key unique (test_run_id, test_case_id)
);
create index test_run_cases_case_idx on public.test_run_cases (test_case_id);

-- Automation -------------------------------------------------------------
create table public.automation_tests (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  test_case_id uuid not null unique references public.test_cases (id) on delete cascade,
  framework text not null default 'playwright' check (framework = 'playwright'),
  file_path text not null check (file_path ~ '^tests/[a-z0-9-]+/[A-Z0-9-]+\.spec\.ts$'),
  test_name text not null,
  code text not null,
  status text not null default 'draft' check (status in ('draft', 'approved', 'rejected')),
  generated_by text,
  review_note text,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint automation_tests_approved_at check (status <> 'approved' or approved_at is not null)
);
create index automation_tests_project_idx on public.automation_tests (project_id, status);

create table public.automation_runs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  test_run_id uuid references public.test_runs (id) on delete set null,
  environment text not null check (environment in ('local', 'development', 'staging', 'production')),
  target_url text not null check (target_url ~ '^https?://'),
  trigger text not null check (trigger in ('manual', 'github', 'scheduled')),
  runner text not null check (runner in ('local', 'github', 'external')),
  branch text,
  commit_sha text check (commit_sha ~ '^[0-9a-fA-F]{7,40}$'),
  status text not null default 'queued' check (status in ('queued', 'running', 'passed', 'failed', 'cancelled')),
  test_case_ids uuid[] not null default '{}',
  external_url text,
  error text,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index automation_runs_project_idx on public.automation_runs (project_id, created_at desc);
create index automation_runs_test_run_idx on public.automation_runs (test_run_id);
create index automation_runs_status_idx on public.automation_runs (status);

create table public.automation_results (
  id uuid primary key default gen_random_uuid(),
  automation_run_id uuid not null references public.automation_runs (id) on delete cascade,
  test_case_id uuid not null references public.test_cases (id) on delete cascade,
  automation_test_id uuid references public.automation_tests (id) on delete set null,
  status text not null check (status in ('passed', 'failed', 'skipped')),
  duration_ms integer check (duration_ms >= 0),
  error_message text,
  screenshot_url text,
  trace_url text,
  log_url text,
  analysis jsonb,
  created_at timestamptz not null default now(),
  constraint automation_results_run_case_key unique (automation_run_id, test_case_id)
);
create index automation_results_case_idx on public.automation_results (test_case_id, created_at desc);

-- Test results (manual and automated, one row per run x case) ------------
create table public.test_results (
  id uuid primary key default gen_random_uuid(),
  test_run_id uuid not null references public.test_runs (id) on delete cascade,
  test_case_id uuid not null references public.test_cases (id) on delete cascade,
  status text not null check (status in ('untested', 'passed', 'failed', 'blocked', 'skipped')),
  mode text not null check (mode in ('manual', 'automated')),
  actual_result text,
  comment text,
  duration_ms integer check (duration_ms >= 0),
  tester text,
  failure_category text check (failure_category in (
    'ui', 'api', 'backend', 'data', 'network', 'environment', 'automation_script', 'unknown'
  )),
  severity text check (severity in ('critical', 'major', 'minor', 'trivial')),
  evidence jsonb not null default '{}'::jsonb,
  automation_result_id uuid references public.automation_results (id) on delete set null,
  attempts integer not null default 1 check (attempts >= 1),
  executed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Duplicate result prevention: one current result per case per run.
  constraint test_results_run_case_key unique (test_run_id, test_case_id),
  -- A result can only exist for a case that is part of the run.
  constraint test_results_run_case_fk foreign key (test_run_id, test_case_id)
    references public.test_run_cases (test_run_id, test_case_id) on delete cascade,
  -- Manual failures must be triaged.
  constraint test_results_manual_failure_triaged check (
    status <> 'failed' or mode = 'automated' or (failure_category is not null and severity is not null)
  )
);
create index test_results_case_idx on public.test_results (test_case_id, updated_at desc);

-- Activity log -----------------------------------------------------------
create table public.activities (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects (id) on delete set null,
  actor text not null,
  action text not null,
  entity_type text not null check (entity_type in (
    'project', 'section', 'test_case', 'test_run', 'test_result', 'automation_test', 'automation_run'
  )),
  entity_id uuid,
  message text not null,
  created_at timestamptz not null default now()
);
create index activities_project_idx on public.activities (project_id, created_at desc);
create index activities_created_idx on public.activities (created_at desc);

-- updated_at triggers ----------------------------------------------------
create trigger projects_updated_at before update on public.projects
  for each row execute function public.set_updated_at();
create trigger test_cases_updated_at before update on public.test_cases
  for each row execute function public.set_updated_at();
create trigger test_runs_updated_at before update on public.test_runs
  for each row execute function public.set_updated_at();
create trigger test_results_updated_at before update on public.test_results
  for each row execute function public.set_updated_at();
create trigger automation_tests_updated_at before update on public.automation_tests
  for each row execute function public.set_updated_at();
create trigger automation_runs_updated_at before update on public.automation_runs
  for each row execute function public.set_updated_at();

-- Row Level Security -----------------------------------------------------
-- The Next.js server talks to Postgres with the service role (which bypasses RLS) after
-- checking the Supabase Auth session itself. RLS is still enabled so the public anon key
-- can never read or write QA data directly; signed-in users get full access because
-- QA JOO is a single-team workspace in this MVP.
do $$
declare
  t text;
begin
  foreach t in array array[
    'projects', 'sections', 'test_cases', 'test_runs', 'test_run_cases', 'test_results',
    'automation_tests', 'automation_runs', 'automation_results', 'activities'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy %I on public.%I for all to authenticated using (true) with check (true)',
      t || '_authenticated_all', t
    );
  end loop;
end;
$$;
