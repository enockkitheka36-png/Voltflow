begin;

create extension if not exists pgcrypto with schema extensions;

create type public.organisation_role as enum (
  'manager', 'engineer', 'sales', 'technician', 'client', 'bank'
);

create type public.membership_status as enum (
  'invited', 'active', 'suspended', 'revoked'
);

create type public.project_status as enum (
  'draft', 'active', 'in_review', 'approved', 'archived'
);

create type public.version_lifecycle as enum ('prepared', 'issued');

create type public.review_status as enum (
  'draft', 'review_ready', 'submitted', 'in_review', 'approved', 'rejected'
);

create type public.evidence_review_status as enum (
  'draft', 'pending_upload', 'submitted', 'verified', 'rejected', 'superseded'
);

create type public.share_audience as enum ('client', 'bank');

create table public.organisations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 2 and 160),
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,62}$'),
  status text not null default 'active' check (status in ('active', 'suspended', 'closed')),
  data_region text,
  created_by uuid references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (length(trim(display_name)) between 1 and 120),
  status text not null default 'active' check (status in ('active', 'disabled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.organisation_memberships (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete restrict,
  role public.organisation_role not null,
  status public.membership_status not null default 'invited',
  invited_by uuid references auth.users(id) on delete set null,
  invited_at timestamptz not null default now(),
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organisation_id, user_id)
);

create index organisation_memberships_user_idx
  on public.organisation_memberships (user_id, status, organisation_id);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete restrict,
  project_ref text not null check (length(trim(project_ref)) between 3 and 80),
  name text not null check (length(trim(name)) between 1 and 200),
  client_name text,
  location text,
  status public.project_status not null default 'draft',
  current_record jsonb not null default '{}'::jsonb check (jsonb_typeof(current_record) = 'object'),
  revision_no integer not null default 1 check (revision_no >= 1),
  latest_version_id uuid,
  migration_fingerprint text,
  migration_provenance jsonb,
  created_by uuid not null references auth.users(id) on delete restrict,
  updated_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  archived_by uuid references auth.users(id) on delete restrict,
  unique (id, organisation_id),
  unique (organisation_id, project_ref),
  unique (organisation_id, migration_fingerprint)
);

create index projects_org_updated_idx on public.projects (organisation_id, updated_at desc);
create index projects_org_status_idx on public.projects (organisation_id, status) where archived_at is null;

create table public.project_members (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete restrict,
  project_id uuid not null,
  user_id uuid not null references auth.users(id) on delete restrict,
  role public.organisation_role not null,
  assigned_by uuid not null references auth.users(id) on delete restrict,
  assigned_at timestamptz not null default now(),
  revoked_at timestamptz,
  unique (organisation_id, project_id, user_id),
  foreign key (project_id, organisation_id)
    references public.projects(id, organisation_id) on delete restrict
);

create index project_members_user_idx
  on public.project_members (user_id, organisation_id, project_id) where revoked_at is null;

create table public.project_versions (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete restrict,
  project_id uuid not null,
  version_no integer not null check (version_no >= 1),
  lifecycle public.version_lifecycle not null default 'prepared',
  snapshot jsonb not null check (jsonb_typeof(snapshot) = 'object'),
  client_snapshot jsonb not null check (jsonb_typeof(client_snapshot) = 'object'),
  bank_snapshot jsonb not null check (jsonb_typeof(bank_snapshot) = 'object'),
  field_snapshot jsonb not null check (jsonb_typeof(field_snapshot) = 'object'),
  snapshot_hash text not null check (snapshot_hash ~ '^[0-9a-f]{64}$'),
  client_snapshot_hash text check (client_snapshot_hash is null or client_snapshot_hash ~ '^[0-9a-f]{64}$'),
  schema_version text not null,
  app_version text not null,
  calculation_version text not null,
  report_metadata jsonb not null default '{}'::jsonb,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  issued_at timestamptz,
  unique (id, organisation_id),
  unique (project_id, version_no),
  foreign key (project_id, organisation_id)
    references public.projects(id, organisation_id) on delete restrict,
  check ((lifecycle = 'issued' and issued_at is not null) or lifecycle = 'prepared')
);

alter table public.projects
  add constraint projects_latest_version_fk
  foreign key (latest_version_id, organisation_id)
  references public.project_versions(id, organisation_id)
  deferrable initially deferred;

create index project_versions_project_idx
  on public.project_versions (organisation_id, project_id, version_no desc);

create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete restrict,
  project_id uuid,
  project_version_id uuid,
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  actor_role public.organisation_role not null,
  action text not null check (action ~ '^[a-z0-9_.-]{3,100}$'),
  old_fields jsonb not null default '{}'::jsonb,
  new_fields jsonb not null default '{}'::jsonb,
  request_id uuid,
  reason text,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  previous_event_hash text check (previous_event_hash is null or previous_event_hash ~ '^[0-9a-f]{64}$'),
  event_hash text not null check (event_hash ~ '^[0-9a-f]{64}$'),
  foreign key (project_id, organisation_id)
    references public.projects(id, organisation_id) on delete restrict,
  foreign key (project_version_id, organisation_id)
    references public.project_versions(id, organisation_id) on delete restrict
);

create unique index audit_events_request_action_uidx
  on public.audit_events (organisation_id, request_id, action)
  where request_id is not null;
create index audit_events_project_idx
  on public.audit_events (organisation_id, project_id, created_at desc);

create table public.evidence_items (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete restrict,
  project_id uuid not null,
  project_version_id uuid,
  kind text not null check (kind ~ '^[a-z0-9_.-]{2,80}$'),
  title text not null check (length(trim(title)) between 1 and 200),
  storage_bucket text not null default 'project-evidence' check (storage_bucket = 'project-evidence'),
  storage_path text not null unique,
  mime_type text not null,
  size_bytes bigint not null check (size_bytes between 1 and 26214400),
  checksum_sha256 text check (checksum_sha256 is null or checksum_sha256 ~ '^[0-9a-f]{64}$'),
  device_captured_at timestamptz,
  server_received_at timestamptz,
  gps_metadata jsonb not null default '{}'::jsonb,
  uploader_user_id uuid not null references auth.users(id) on delete restrict,
  review_status public.evidence_review_status not null default 'pending_upload',
  reviewed_by uuid references auth.users(id) on delete restrict,
  reviewed_at timestamptz,
  review_reason text,
  supersedes_evidence_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, organisation_id),
  foreign key (project_id, organisation_id)
    references public.projects(id, organisation_id) on delete restrict,
  foreign key (project_version_id, organisation_id)
    references public.project_versions(id, organisation_id) on delete restrict,
  foreign key (supersedes_evidence_id, organisation_id)
    references public.evidence_items(id, organisation_id) on delete restrict
);

create index evidence_items_project_idx
  on public.evidence_items (organisation_id, project_id, created_at desc);

create table public.review_submissions (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete restrict,
  project_id uuid not null,
  project_version_id uuid not null,
  status public.review_status not null default 'draft',
  requested_reviewer_id uuid references auth.users(id) on delete restrict,
  submitted_by uuid references auth.users(id) on delete restrict,
  submitted_at timestamptz,
  reviewed_at timestamptz,
  reason text,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, organisation_id),
  foreign key (project_id, organisation_id)
    references public.projects(id, organisation_id) on delete restrict,
  foreign key (project_version_id, organisation_id)
    references public.project_versions(id, organisation_id) on delete restrict
);

create index review_submissions_project_idx
  on public.review_submissions (organisation_id, project_id, created_at desc);

create table public.approvals (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete restrict,
  project_id uuid not null,
  project_version_id uuid not null,
  review_submission_id uuid not null,
  decision text not null check (decision in ('approved', 'rejected')),
  reason text not null check (length(trim(reason)) >= 3),
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  actor_role public.organisation_role not null,
  snapshot_hash text not null check (snapshot_hash ~ '^[0-9a-f]{64}$'),
  decided_at timestamptz not null default now(),
  unique (id, organisation_id),
  foreign key (project_id, organisation_id)
    references public.projects(id, organisation_id) on delete restrict,
  foreign key (project_version_id, organisation_id)
    references public.project_versions(id, organisation_id) on delete restrict,
  foreign key (review_submission_id, organisation_id)
    references public.review_submissions(id, organisation_id) on delete restrict
);

create table public.boq_revisions (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete restrict,
  project_id uuid not null,
  project_version_id uuid not null,
  revision_no integer not null check (revision_no >= 1),
  lines jsonb not null check (jsonb_typeof(lines) = 'array'),
  internal_totals jsonb not null default '{}'::jsonb,
  public_headline jsonb not null default '{}'::jsonb,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (id, organisation_id),
  unique (project_id, revision_no),
  foreign key (project_id, organisation_id)
    references public.projects(id, organisation_id) on delete restrict,
  foreign key (project_version_id, organisation_id)
    references public.project_versions(id, organisation_id) on delete restrict
);

create table public.project_shares (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete restrict,
  project_id uuid not null,
  project_version_id uuid not null,
  shared_with_user_id uuid not null references auth.users(id) on delete restrict,
  audience public.share_audience not null,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  revoked_by uuid references auth.users(id) on delete restrict,
  unique (id, organisation_id),
  foreign key (project_id, organisation_id)
    references public.projects(id, organisation_id) on delete restrict,
  foreign key (project_version_id, organisation_id)
    references public.project_versions(id, organisation_id) on delete restrict,
  check (expires_at > created_at)
);

create unique index project_shares_active_uidx
  on public.project_shares (project_version_id, shared_with_user_id, audience)
  where revoked_at is null;
create index project_shares_recipient_idx
  on public.project_shares (shared_with_user_id, organisation_id, expires_at)
  where revoked_at is null;

commit;
