-- Ledgerly Phase 1: trustworthy ingestion and normalization.
-- Source evidence is immutable; active transactions are created only by an atomic commit RPC.

create extension if not exists pgcrypto;

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 120),
  country_code text not null default 'IN' check (country_code ~ '^[A-Z]{2}$'),
  functional_currency text not null default 'INR' check (functional_currency ~ '^[A-Z]{3}$'),
  timezone text not null default 'Asia/Kolkata',
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.organization_members (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner','admin','founder_reviewer','accountant_reviewer','read_only_auditor')),
  status text not null default 'active' check (status in ('active','revoked')),
  created_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);

create or replace function public.add_organization_owner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.organization_members (organization_id, user_id, role)
  values (new.id, new.created_by, 'owner');
  return new;
end;
$$;

drop trigger if exists organizations_add_owner on public.organizations;
create trigger organizations_add_owner
after insert on public.organizations
for each row execute function public.add_organization_owner();

create or replace function public.is_org_member(p_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_members m
    where m.organization_id = p_organization_id
      and m.user_id = auth.uid()
      and m.status = 'active'
  );
$$;

create or replace function public.has_org_role(p_organization_id uuid, p_roles text[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_members m
    where m.organization_id = p_organization_id
      and m.user_id = auth.uid()
      and m.status = 'active'
      and m.role = any(p_roles)
  );
$$;

create table if not exists public.financial_accounts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  institution_name text,
  account_type text not null check (account_type in ('bank_current','bank_savings','credit_card','payment_processor','cash','other')),
  currency text not null default 'INR' check (currency ~ '^[A-Z]{3}$'),
  masked_identifier text check (masked_identifier is null or char_length(masked_identifier) <= 32),
  opening_balance_minor bigint,
  opening_balance_date date,
  status text not null default 'active' check (status in ('active','archived')),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.imports (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  financial_account_id uuid not null references public.financial_accounts(id),
  source_type text not null check (source_type in ('bank_csv','stripe_csv','razorpay_csv','manual')),
  original_filename text not null check (char_length(original_filename) between 1 and 255),
  status text not null default 'created' check (status in (
    'created','uploading','uploaded','detecting','awaiting_mapping','parsing','staged',
    'awaiting_confirmation','committing','committed','committed_with_issues',
    'quarantined','failed','cancelled','superseded'
  )),
  detection_json jsonb,
  committed_attempt_id uuid,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.import_files (
  id uuid primary key default gen_random_uuid(),
  import_id uuid not null references public.imports(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  financial_account_id uuid not null references public.financial_accounts(id),
  storage_object_key text not null unique,
  original_filename text not null,
  content_type_claimed text,
  content_type_detected text not null,
  byte_size bigint not null check (byte_size > 0),
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  encoding_detected text,
  line_ending text,
  uploaded_by uuid not null references auth.users(id),
  uploaded_at timestamptz not null default now(),
  unique (organization_id, financial_account_id, sha256)
);

create table if not exists public.mapping_profiles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  financial_account_id uuid not null references public.financial_accounts(id),
  source_type text not null,
  header_fingerprint text not null,
  mapping_json jsonb not null,
  version integer not null default 1,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  unique (organization_id, financial_account_id, header_fingerprint, version)
);

create table if not exists public.import_attempts (
  id uuid primary key default gen_random_uuid(),
  import_id uuid not null references public.imports(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  parser_version text not null,
  normalization_version text not null,
  mapping_json jsonb not null,
  source_file_sha256 text not null,
  manifest_json jsonb not null default '{}'::jsonb,
  status text not null default 'created' check (status in ('created','running','staged','committed','failed','superseded')),
  supersedes_attempt_id uuid references public.import_attempts(id),
  created_by uuid not null references auth.users(id),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  committed_at timestamptz
);

alter table public.imports
  drop constraint if exists imports_committed_attempt_id_fkey;
alter table public.imports
  add constraint imports_committed_attempt_id_fkey
  foreign key (committed_attempt_id) references public.import_attempts(id);

create table if not exists public.raw_rows (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  import_id uuid not null references public.imports(id) on delete cascade,
  physical_row_number integer not null check (physical_row_number > 0),
  raw_text text not null,
  raw_fields jsonb not null,
  raw_row_sha256 text not null,
  created_at timestamptz not null default now(),
  unique (import_id, physical_row_number)
);

create table if not exists public.normalized_transaction_staging (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  import_attempt_id uuid not null references public.import_attempts(id) on delete cascade,
  raw_row_id uuid not null references public.raw_rows(id),
  financial_account_id uuid not null references public.financial_accounts(id),
  posted_date date,
  transaction_date date,
  description_original text not null,
  description_normalized text not null,
  amount_minor bigint check (amount_minor is null or amount_minor >= 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  direction text check (direction is null or direction in ('debit','credit')),
  external_reference text,
  counterparty_raw text,
  balance_after_minor bigint,
  disposition text not null check (disposition in (
    'normalized','needs_mapping','potential_duplicate','confirmed_duplicate',
    'confirmed_unique','rejected','needs_review'
  )),
  issue_code text,
  issue_message text,
  strong_identity_key text,
  candidate_similarity_key text,
  created_at timestamptz not null default now(),
  unique (import_attempt_id, raw_row_id)
);

create table if not exists public.row_issues (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  import_attempt_id uuid not null references public.import_attempts(id) on delete cascade,
  raw_row_id uuid not null references public.raw_rows(id),
  issue_code text not null,
  human_message text not null,
  technical_context jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.normalized_transactions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  source_import_id uuid not null references public.imports(id),
  source_attempt_id uuid not null references public.import_attempts(id),
  source_row_id uuid not null references public.raw_rows(id),
  financial_account_id uuid not null references public.financial_accounts(id),
  posted_date date not null,
  transaction_date date,
  description_original text not null,
  description_normalized text not null,
  amount_minor bigint not null check (amount_minor >= 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  direction text not null check (direction in ('debit','credit')),
  external_reference text,
  counterparty_raw text,
  balance_after_minor bigint,
  strong_identity_key text,
  candidate_similarity_key text,
  created_at timestamptz not null default now(),
  unique (source_attempt_id, source_row_id)
);

create unique index if not exists normalized_transactions_strong_identity_unique
  on public.normalized_transactions (organization_id, financial_account_id, strong_identity_key)
  where strong_identity_key is not null;
create index if not exists normalized_transactions_candidate_lookup
  on public.normalized_transactions (organization_id, financial_account_id, candidate_similarity_key)
  where candidate_similarity_key is not null;

create table if not exists public.audit_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  event_type text not null,
  entity_type text not null,
  entity_id uuid not null,
  actor_type text not null check (actor_type in ('user','rule','model','system','integration')),
  actor_id uuid,
  occurred_at timestamptz not null default now(),
  reason text not null,
  before_json jsonb,
  after_json jsonb,
  evidence_references jsonb not null default '[]'::jsonb,
  policy_version text not null default 'phase-0-v1'
);

alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.financial_accounts enable row level security;
alter table public.imports enable row level security;
alter table public.import_files enable row level security;
alter table public.mapping_profiles enable row level security;
alter table public.import_attempts enable row level security;
alter table public.raw_rows enable row level security;
alter table public.normalized_transaction_staging enable row level security;
alter table public.row_issues enable row level security;
alter table public.normalized_transactions enable row level security;
alter table public.audit_events enable row level security;

create policy organizations_insert_self on public.organizations
for insert to authenticated with check (created_by = auth.uid());
create policy organizations_select_member on public.organizations
for select to authenticated using (public.is_org_member(id));
create policy organizations_update_admin on public.organizations
for update to authenticated using (public.has_org_role(id, array['owner','admin']))
with check (public.has_org_role(id, array['owner','admin']));

create policy members_select_member on public.organization_members
for select to authenticated using (public.is_org_member(organization_id));
create policy members_manage_admin on public.organization_members
for all to authenticated using (public.has_org_role(organization_id, array['owner','admin']))
with check (public.has_org_role(organization_id, array['owner','admin']));

create policy accounts_select_member on public.financial_accounts
for select to authenticated using (public.is_org_member(organization_id));
create policy accounts_insert_admin on public.financial_accounts
for insert to authenticated with check (
  created_by = auth.uid() and public.has_org_role(organization_id, array['owner','admin'])
);
create policy accounts_update_admin on public.financial_accounts
for update to authenticated using (public.has_org_role(organization_id, array['owner','admin']))
with check (public.has_org_role(organization_id, array['owner','admin']));

create policy imports_select_member on public.imports
for select to authenticated using (public.is_org_member(organization_id));
create policy imports_insert_reviewer on public.imports
for insert to authenticated with check (
  created_by = auth.uid()
  and public.has_org_role(organization_id, array['owner','admin','founder_reviewer'])
  and exists (
    select 1 from public.financial_accounts a
    where a.id = financial_account_id and a.organization_id = organization_id
  )
);
create policy imports_update_reviewer on public.imports
for update to authenticated using (
  public.has_org_role(organization_id, array['owner','admin','founder_reviewer'])
) with check (
  public.has_org_role(organization_id, array['owner','admin','founder_reviewer'])
);

create policy files_select_member on public.import_files
for select to authenticated using (public.is_org_member(organization_id));
create policy files_insert_reviewer on public.import_files
for insert to authenticated with check (
  uploaded_by = auth.uid()
  and public.has_org_role(organization_id, array['owner','admin','founder_reviewer'])
  and exists (
    select 1 from public.imports i
    where i.id = import_id
      and i.organization_id = organization_id
      and i.financial_account_id = financial_account_id
  )
);

create policy mapping_select_member on public.mapping_profiles
for select to authenticated using (public.is_org_member(organization_id));
create policy mapping_manage_reviewer on public.mapping_profiles
for all to authenticated using (
  public.has_org_role(organization_id, array['owner','admin','founder_reviewer'])
) with check (
  public.has_org_role(organization_id, array['owner','admin','founder_reviewer'])
);

create policy attempts_select_member on public.import_attempts
for select to authenticated using (public.is_org_member(organization_id));
create policy raw_rows_select_member on public.raw_rows
for select to authenticated using (public.is_org_member(organization_id));
create policy staging_select_member on public.normalized_transaction_staging
for select to authenticated using (public.is_org_member(organization_id));
create policy issues_select_member on public.row_issues
for select to authenticated using (public.is_org_member(organization_id));
create policy transactions_select_member on public.normalized_transactions
for select to authenticated using (public.is_org_member(organization_id));
create policy audits_select_member on public.audit_events
for select to authenticated using (public.is_org_member(organization_id));

create or replace function public.stage_import_attempt(
  p_import_id uuid,
  p_mapping jsonb,
  p_parser_version text,
  p_normalization_version text,
  p_source_file_sha256 text,
  p_rows jsonb,
  p_manifest jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_import public.imports%rowtype;
  v_attempt_id uuid := gen_random_uuid();
  v_prior_attempt_id uuid;
  v_row jsonb;
  v_raw_row_id uuid;
  v_raw_hash text;
begin
  select * into v_import from public.imports where id = p_import_id for update;
  if not found then raise exception 'IMPORT_NOT_FOUND'; end if;
  if not public.has_org_role(v_import.organization_id, array['owner','admin','founder_reviewer']) then
    raise exception 'FORBIDDEN';
  end if;
  if v_import.status in ('committed','committed_with_issues') then raise exception 'IMPORT_ALREADY_COMMITTED'; end if;
  if not exists (
    select 1 from public.import_files f
    where f.import_id = p_import_id and f.sha256 = p_source_file_sha256
  ) then raise exception 'IMPORT_STORAGE_INTEGRITY_FAILED'; end if;
  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) = 0 then raise exception 'IMPORT_EMPTY_ROWS'; end if;

  select id into v_prior_attempt_id
  from public.import_attempts
  where import_id = p_import_id and status = 'staged'
  order by started_at desc limit 1;

  if v_prior_attempt_id is not null then
    update public.import_attempts set status = 'superseded', completed_at = now()
    where id = v_prior_attempt_id;
  end if;

  insert into public.import_attempts (
    id, import_id, organization_id, parser_version, normalization_version,
    mapping_json, source_file_sha256, manifest_json, status, supersedes_attempt_id, created_by
  ) values (
    v_attempt_id, p_import_id, v_import.organization_id, p_parser_version, p_normalization_version,
    p_mapping, p_source_file_sha256, p_manifest, 'running', v_prior_attempt_id, auth.uid()
  );

  for v_row in select value from jsonb_array_elements(p_rows)
  loop
    v_raw_hash := encode(digest(
      p_source_file_sha256 || ':' || (v_row->>'physicalRowNumber') || ':' || coalesce(v_row->>'rawText',''),
      'sha256'
    ), 'hex');

    insert into public.raw_rows (
      organization_id, import_id, physical_row_number, raw_text, raw_fields, raw_row_sha256
    ) values (
      v_import.organization_id,
      p_import_id,
      (v_row->>'physicalRowNumber')::integer,
      coalesce(v_row->>'rawText',''),
      coalesce(v_row->'rawFields','[]'::jsonb),
      v_raw_hash
    )
    on conflict (import_id, physical_row_number) do nothing;

    select id into v_raw_row_id
    from public.raw_rows
    where import_id = p_import_id and physical_row_number = (v_row->>'physicalRowNumber')::integer;

    insert into public.normalized_transaction_staging (
      organization_id, import_attempt_id, raw_row_id, financial_account_id,
      posted_date, transaction_date, description_original, description_normalized,
      amount_minor, currency, direction, external_reference, counterparty_raw,
      balance_after_minor, disposition, issue_code, issue_message,
      strong_identity_key, candidate_similarity_key
    ) values (
      v_import.organization_id,
      v_attempt_id,
      v_raw_row_id,
      v_import.financial_account_id,
      nullif(v_row->>'postedDate','')::date,
      nullif(v_row->>'transactionDate','')::date,
      coalesce(v_row->>'descriptionOriginal',''),
      coalesce(v_row->>'descriptionNormalized',''),
      nullif(v_row->>'amountMinor','')::bigint,
      coalesce(v_row->>'currency','INR'),
      nullif(v_row->>'direction',''),
      nullif(v_row->>'externalReference',''),
      nullif(v_row->>'counterpartyRaw',''),
      nullif(v_row->>'balanceAfterMinor','')::bigint,
      v_row->>'disposition',
      nullif(v_row->>'issueCode',''),
      nullif(v_row->>'issueMessage',''),
      nullif(v_row->>'strongIdentityKey',''),
      nullif(v_row->>'candidateSimilarityKey','')
    );

    if nullif(v_row->>'issueCode','') is not null then
      insert into public.row_issues (
        organization_id, import_attempt_id, raw_row_id, issue_code, human_message, technical_context
      ) values (
        v_import.organization_id, v_attempt_id, v_raw_row_id,
        v_row->>'issueCode', coalesce(v_row->>'issueMessage','Review required'),
        jsonb_build_object('physicalRowNumber', (v_row->>'physicalRowNumber')::integer)
      );
    end if;
  end loop;

  if (select count(*) from public.normalized_transaction_staging where import_attempt_id = v_attempt_id)
     <> jsonb_array_length(p_rows) then
    raise exception 'IMPORT_UNACCOUNTED_ROWS';
  end if;

  update public.import_attempts
  set status = 'staged', completed_at = now()
  where id = v_attempt_id;

  update public.imports
  set status = 'awaiting_confirmation', updated_at = now()
  where id = p_import_id;

  insert into public.audit_events (
    organization_id, event_type, entity_type, entity_id, actor_type, actor_id,
    reason, after_json, evidence_references
  ) values (
    v_import.organization_id, 'import.attempt_staged', 'import_attempt', v_attempt_id,
    'user', auth.uid(), 'CSV parsing and normalization staged for review',
    p_manifest, jsonb_build_array(p_import_id, p_source_file_sha256)
  );

  return jsonb_build_object('attempt_id', v_attempt_id);
end;
$$;

create or replace function public.get_import_preview(p_import_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_import public.imports%rowtype;
  v_attempt public.import_attempts%rowtype;
begin
  select * into v_import from public.imports where id = p_import_id;
  if not found or not public.is_org_member(v_import.organization_id) then raise exception 'NOT_FOUND'; end if;

  select * into v_attempt from public.import_attempts
  where import_id = p_import_id and status = 'staged'
  order by started_at desc limit 1;
  if not found then raise exception 'IMPORT_NOT_READY'; end if;

  return jsonb_build_object(
    'importId', p_import_id,
    'attemptId', v_attempt.id,
    'manifest', v_attempt.manifest_json,
    'rows', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', s.id,
        'physicalRowNumber', r.physical_row_number,
        'postedDate', s.posted_date,
        'descriptionOriginal', s.description_original,
        'amountMinor', s.amount_minor,
        'currency', s.currency,
        'direction', s.direction,
        'disposition', s.disposition,
        'issueCode', s.issue_code,
        'issueMessage', s.issue_message
      ) order by r.physical_row_number)
      from public.normalized_transaction_staging s
      join public.raw_rows r on r.id = s.raw_row_id
      where s.import_attempt_id = v_attempt.id
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.commit_import_attempt(p_import_id uuid, p_attempt_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_import public.imports%rowtype;
  v_attempt public.import_attempts%rowtype;
  v_inserted integer;
  v_potential integer;
  v_confirmed integer;
  v_rejected integer;
  v_review integer;
  v_final_status text;
  v_manifest jsonb;
begin
  select * into v_import from public.imports where id = p_import_id for update;
  if not found then raise exception 'IMPORT_NOT_FOUND'; end if;
  if not public.has_org_role(v_import.organization_id, array['owner','admin','founder_reviewer']) then
    raise exception 'FORBIDDEN';
  end if;
  if v_import.status in ('committed','committed_with_issues') then raise exception 'IMPORT_ALREADY_COMMITTED'; end if;

  select * into v_attempt from public.import_attempts
  where id = p_attempt_id and import_id = p_import_id for update;
  if not found or v_attempt.status <> 'staged' then raise exception 'IMPORT_NOT_READY'; end if;

  update public.imports set status = 'committing', updated_at = now() where id = p_import_id;

  update public.normalized_transaction_staging s
  set disposition = 'confirmed_duplicate',
      issue_code = 'ROW_POTENTIAL_DUPLICATE',
      issue_message = 'Strong external-reference identity already exists in active transactions'
  where s.import_attempt_id = p_attempt_id
    and s.disposition = 'normalized'
    and s.strong_identity_key is not null
    and exists (
      select 1 from public.normalized_transactions t
      where t.organization_id = s.organization_id
        and t.financial_account_id = s.financial_account_id
        and t.strong_identity_key = s.strong_identity_key
    );

  update public.normalized_transaction_staging s
  set disposition = 'potential_duplicate',
      issue_code = 'ROW_POTENTIAL_DUPLICATE',
      issue_message = 'A similar active transaction exists; review before inclusion'
  where s.import_attempt_id = p_attempt_id
    and s.disposition = 'normalized'
    and s.strong_identity_key is null
    and s.candidate_similarity_key is not null
    and exists (
      select 1 from public.normalized_transactions t
      where t.organization_id = s.organization_id
        and t.financial_account_id = s.financial_account_id
        and t.candidate_similarity_key = s.candidate_similarity_key
    );

  insert into public.normalized_transactions (
    organization_id, source_import_id, source_attempt_id, source_row_id, financial_account_id,
    posted_date, transaction_date, description_original, description_normalized,
    amount_minor, currency, direction, external_reference, counterparty_raw,
    balance_after_minor, strong_identity_key, candidate_similarity_key
  )
  select
    s.organization_id, p_import_id, p_attempt_id, s.raw_row_id, s.financial_account_id,
    s.posted_date, s.transaction_date, s.description_original, s.description_normalized,
    s.amount_minor, s.currency, s.direction, s.external_reference, s.counterparty_raw,
    s.balance_after_minor, s.strong_identity_key, s.candidate_similarity_key
  from public.normalized_transaction_staging s
  where s.import_attempt_id = p_attempt_id
    and s.disposition in ('normalized','confirmed_unique')
    and s.posted_date is not null
    and s.amount_minor is not null
    and s.direction is not null;
  get diagnostics v_inserted = row_count;

  select
    count(*) filter (where disposition = 'potential_duplicate'),
    count(*) filter (where disposition = 'confirmed_duplicate'),
    count(*) filter (where disposition = 'rejected'),
    count(*) filter (where disposition in ('needs_review','needs_mapping'))
  into v_potential, v_confirmed, v_rejected, v_review
  from public.normalized_transaction_staging
  where import_attempt_id = p_attempt_id;

  v_final_status := case when (v_potential + v_confirmed + v_rejected + v_review) > 0
    then 'committed_with_issues' else 'committed' end;

  v_manifest := v_attempt.manifest_json || jsonb_build_object(
    'attemptId', p_attempt_id,
    'normalized', v_inserted,
    'potentialDuplicates', v_potential,
    'confirmedDuplicates', v_confirmed,
    'rejected', v_rejected,
    'needsReview', v_review,
    'unaccounted', 0,
    'committedAt', now(),
    'committedBy', auth.uid()
  );

  update public.import_attempts
  set status = 'committed', committed_at = now(), manifest_json = v_manifest
  where id = p_attempt_id;

  update public.imports
  set status = v_final_status, committed_attempt_id = p_attempt_id, updated_at = now()
  where id = p_import_id;

  insert into public.audit_events (
    organization_id, event_type, entity_type, entity_id, actor_type, actor_id,
    reason, after_json, evidence_references
  ) values (
    v_import.organization_id, 'import.committed', 'import', p_import_id,
    'user', auth.uid(), 'User confirmed atomic import commit',
    v_manifest, jsonb_build_array(p_attempt_id, v_attempt.source_file_sha256)
  );

  return jsonb_build_object(
    'importId', p_import_id,
    'attemptId', p_attempt_id,
    'status', v_final_status,
    'manifest', v_manifest
  );
end;
$$;

revoke all on function public.is_org_member(uuid) from public;
revoke all on function public.has_org_role(uuid, text[]) from public;
revoke all on function public.stage_import_attempt(uuid,jsonb,text,text,text,jsonb,jsonb) from public;
revoke all on function public.get_import_preview(uuid) from public;
revoke all on function public.commit_import_attempt(uuid,uuid) from public;
grant execute on function public.is_org_member(uuid) to authenticated;
grant execute on function public.has_org_role(uuid, text[]) to authenticated;
grant execute on function public.stage_import_attempt(uuid,jsonb,text,text,text,jsonb,jsonb) to authenticated;
grant execute on function public.get_import_preview(uuid) to authenticated;
grant execute on function public.commit_import_attempt(uuid,uuid) to authenticated;
