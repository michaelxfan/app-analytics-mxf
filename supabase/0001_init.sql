-- App Analytics MXF — schema
-- Run in Supabase project: personal-mxf

create table if not exists public.apps (
  id uuid primary key default gen_random_uuid(),
  app_name text not null,
  app_slug text not null unique,
  app_url text,
  github_repo_url text,
  supabase_project_name text,
  supabase_project_group text,
  category text,
  status text not null default 'active' check (status in ('active','experimental','paused','deprecated')),
  priority text not null default 'P2' check (priority in ('P0','P1','P2','P3')),
  description text,
  notes text,
  high_leverage boolean default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists apps_status_idx on public.apps(status);
create index if not exists apps_slug_idx on public.apps(app_slug);

create table if not exists public.app_usage_events (
  id uuid primary key default gen_random_uuid(),
  app_id uuid references public.apps(id) on delete cascade,
  app_slug text not null,
  event_name text not null,
  event_type text,
  source_app text,
  user_id text,
  metadata jsonb default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists usage_app_id_idx on public.app_usage_events(app_id);
create index if not exists usage_occurred_idx on public.app_usage_events(occurred_at desc);
create index if not exists usage_slug_idx on public.app_usage_events(app_slug);

create table if not exists public.weekly_app_summaries (
  id uuid primary key default gen_random_uuid(),
  week_start date not null,
  week_end date not null,
  total_events integer not null default 0,
  total_active_apps integer not null default 0,
  top_apps jsonb default '[]'::jsonb,
  dead_apps jsonb default '[]'::jsonb,
  ai_summary text,
  sent_email boolean not null default false,
  created_at timestamptz not null default now(),
  unique(week_start)
);
