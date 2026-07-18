create extension if not exists pgcrypto;

create type leaseflow_role as enum ('data_steward','senior_reviewer','lm_manager','lm_member','team_lead','admin');
create type publication_status as enum ('candidate','junior_confirmed','senior_approved','published','superseded','rejected');
create type review_decision as enum ('confirmed','corrected','approved','rejected','needs_information');
create type share_scope as enum ('external_reportable','client_confidential','internal_only','restricted');

create table organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table teams (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  name text not null,
  created_at timestamptz not null default now()
);

create table user_profiles (
  id uuid primary key,
  organization_id uuid not null references organizations(id),
  display_name text not null,
  email text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table team_memberships (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id),
  user_id uuid not null references user_profiles(id),
  role leaseflow_role not null,
  unique(team_id,user_id,role)
);

create table buildings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  canonical_name text not null,
  aliases jsonb not null default '[]',
  address text,
  market text,
  currency char(3),
  timezone text,
  default_area_unit text,
  created_at timestamptz not null default now()
);

create table building_access (
  id uuid primary key default gen_random_uuid(),
  building_id uuid not null references buildings(id),
  user_id uuid not null references user_profiles(id),
  can_view_raw boolean not null default false,
  can_review boolean not null default false,
  can_publish boolean not null default false,
  can_prepare_external boolean not null default false,
  can_approve_external boolean not null default false,
  unique(building_id,user_id)
);

create table source_documents (
  id uuid primary key default gen_random_uuid(),
  building_id uuid references buildings(id),
  title text not null,
  source_type text not null,
  effective_date date,
  storage_path text,
  content_hash text,
  uploaded_by uuid references user_profiles(id),
  uploaded_at timestamptz not null default now(),
  classification share_scope not null default 'restricted'
);

create table extraction_runs (
  id uuid primary key default gen_random_uuid(),
  source_document_id uuid not null references source_documents(id),
  model text not null,
  prompt_version text not null,
  status text not null,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  output_json jsonb,
  error text
);

create table extracted_candidates (
  id uuid primary key default gen_random_uuid(),
  extraction_run_id uuid not null references extraction_runs(id),
  building_id uuid not null references buildings(id),
  floor_label text,
  field_name text not null,
  previous_value jsonb,
  proposed_value jsonb not null,
  fact_state text not null,
  source_pointer text not null,
  confidence numeric,
  external_shareable_candidate boolean not null default false,
  status publication_status not null default 'candidate',
  created_at timestamptz not null default now()
);

create table review_decisions (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references extracted_candidates(id),
  reviewer_id uuid not null references user_profiles(id),
  decision review_decision not null,
  corrected_value jsonb,
  note text,
  created_at timestamptz not null default now()
);

create table publication_batches (
  id uuid primary key default gen_random_uuid(),
  building_id uuid not null references buildings(id),
  approved_by uuid not null references user_profiles(id),
  published_at timestamptz,
  status publication_status not null default 'senior_approved',
  note text
);

create table availability_versions (
  id uuid primary key default gen_random_uuid(),
  building_id uuid not null references buildings(id),
  source_document_id uuid references source_documents(id),
  publication_batch_id uuid references publication_batches(id),
  floor_label text not null,
  space_label text,
  marketed_area_py numeric,
  marketed_area_sqm numeric,
  status text not null,
  effective_from date not null,
  effective_to date,
  publication_status publication_status not null,
  external_shareable boolean not null default false,
  version_no integer not null,
  supersedes_id uuid references availability_versions(id),
  created_at timestamptz not null default now()
);

create table term_versions (
  id uuid primary key default gen_random_uuid(),
  building_id uuid not null references buildings(id),
  source_document_id uuid references source_documents(id),
  publication_batch_id uuid references publication_batches(id),
  floor_label text,
  field_name text not null,
  value_json jsonb not null,
  unit text,
  effective_from date not null,
  effective_to date,
  publication_status publication_status not null,
  external_shareable boolean not null default false,
  version_no integer not null,
  supersedes_id uuid references term_versions(id),
  created_at timestamptz not null default now()
);

create table file_versions (
  id uuid primary key default gen_random_uuid(),
  building_id uuid not null references buildings(id),
  source_document_id uuid references source_documents(id),
  publication_batch_id uuid references publication_batches(id),
  floor_label text,
  file_type text not null,
  filename text not null,
  storage_path text,
  effective_from date not null,
  effective_to date,
  publication_status publication_status not null,
  external_shareable boolean not null default false,
  version_no integer not null,
  supersedes_id uuid references file_versions(id),
  created_at timestamptz not null default now()
);

create table activities (
  id uuid primary key default gen_random_uuid(),
  building_id uuid references buildings(id),
  channel text not null,
  external_id text,
  occurred_at timestamptz not null,
  subject text,
  raw_text text,
  summary text,
  extracted_facts jsonb not null default '[]',
  share_scope share_scope not null default 'client_confidential',
  created_by uuid references user_profiles(id),
  created_at timestamptz not null default now()
);

create table tasks (
  id uuid primary key default gen_random_uuid(),
  building_id uuid references buildings(id),
  source_activity_id uuid references activities(id),
  task_type text not null,
  request_json jsonb not null,
  status text not null default 'draft',
  due_at timestamptz,
  created_at timestamptz not null default now()
);

create table output_packages (
  id uuid primary key default gen_random_uuid(),
  building_id uuid references buildings(id),
  task_id uuid references tasks(id),
  subject text not null,
  body text not null,
  to_recipients jsonb not null,
  cc_recipients jsonb not null,
  facts jsonb not null,
  files jsonb not null,
  unresolved jsonb not null default '[]',
  status text not null default 'draft',
  approved_by uuid references user_profiles(id),
  approved_at timestamptz,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

create table weekly_reports (
  id uuid primary key default gen_random_uuid(),
  building_id uuid not null references buildings(id),
  period_start date not null,
  period_end date not null,
  report_json jsonb not null,
  status text not null default 'draft',
  approved_by uuid references user_profiles(id),
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  unique(building_id,period_start,period_end)
);

create table audit_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id),
  actor_id uuid references user_profiles(id),
  event_type text not null,
  entity_type text not null,
  entity_id text not null,
  metadata jsonb not null default '{}',
  occurred_at timestamptz not null default now()
);

-- Production: enable RLS on all exposed tables and add organization, role,
-- building-access, and MFA assurance policies before real data is used.
