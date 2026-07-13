-- Ledgerly Phase 2: deterministic categorization rules and correction memory.
-- Rules are entity-scoped; decisions are versioned; corrections never overwrite history.

create table if not exists public.canonical_categories (
  code text primary key,
  label text not null,
  account_type text not null check (account_type in ('asset','liability','equity','income','expense')),
  risk text not null check (risk in ('low','medium','high')),
  active boolean not null default true,
  seeded_at timestamptz not null default now()
);

insert into public.canonical_categories (code, label, account_type, risk) values
  ('asset.bank','Bank','asset','low'),
  ('asset.cash','Cash','asset','medium'),
  ('asset.accounts_receivable','Accounts Receivable','asset','medium'),
  ('asset.prepaid_expense','Prepaid Expense','asset','high'),
  ('asset.security_deposit','Security Deposit','asset','high'),
  ('asset.computer_equipment','Computer Equipment','asset','high'),
  ('liability.accounts_payable','Accounts Payable','liability','medium'),
  ('liability.loan_payable','Loan Payable','liability','high'),
  ('liability.gst_payable','GST Payable','liability','high'),
  ('liability.tds_payable','TDS Payable','liability','high'),
  ('liability.customer_advance','Customer Advance','liability','high'),
  ('equity.owner_capital','Owner Capital','equity','high'),
  ('equity.owner_drawings','Owner Drawings','equity','high'),
  ('income.service_revenue','Service Revenue','income','medium'),
  ('income.subscription_revenue','Subscription Revenue','income','medium'),
  ('income.interest','Interest Income','income','medium'),
  ('expense.software_subscription','Software and Subscriptions','expense','low'),
  ('expense.hosting','Hosting and Infrastructure','expense','low'),
  ('expense.advertising','Advertising','expense','medium'),
  ('expense.professional_fees','Professional Fees','expense','medium'),
  ('expense.contractors','Contractors','expense','medium'),
  ('expense.rent','Rent','expense','medium'),
  ('expense.travel','Travel','expense','medium'),
  ('expense.meals','Meals','expense','medium'),
  ('expense.office_supplies','Office Supplies','expense','low'),
  ('expense.bank_charges','Bank Charges','expense','low'),
  ('expense.payment_processing','Payment Processing Fees','expense','low'),
  ('expense.internet','Telephone and Internet','expense','low'),
  ('expense.training','Training','expense','medium'),
  ('expense.statutory_fees','Taxes and Statutory Fees','expense','high')
on conflict (code) do update set
  label = excluded.label,
  account_type = excluded.account_type,
  risk = excluded.risk,
  active = true;

create table if not exists public.organization_category_mappings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  canonical_category_code text not null references public.canonical_categories(code),
  account_name text not null check (char_length(account_name) between 1 and 160),
  external_account_code text,
  active boolean not null default true,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, canonical_category_code)
);

create table if not exists public.classification_rules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 160),
  scope text not null check (scope in (
    'exact_description','merchant_amount_range','recurring_series',
    'merchant_entity_future','historical_and_future_matches'
  )),
  predicate_json jsonb not null check (jsonb_typeof(predicate_json) = 'object'),
  canonical_category_code text not null references public.canonical_categories(code),
  organization_category_mapping_id uuid references public.organization_category_mappings(id),
  priority integer not null check (priority between 0 and 2000),
  specificity integer not null check (specificity >= 0),
  source_role text not null check (source_role in ('founder','accountant')),
  status text not null default 'active' check (status in ('draft','active','disabled','superseded')),
  version integer not null default 1 check (version > 0),
  created_by uuid not null references auth.users(id),
  approved_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  disabled_at timestamptz,
  disabled_reason text
);

create index if not exists classification_rules_active_lookup
  on public.classification_rules (organization_id, status, priority desc, specificity desc);

create table if not exists public.classification_decisions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  normalized_transaction_id uuid not null references public.normalized_transactions(id) on delete cascade,
  canonical_category_code text references public.canonical_categories(code),
  organization_category_mapping_id uuid references public.organization_category_mappings(id),
  decision_source text not null check (decision_source in ('rule','history','founder','accountant')),
  source_rule_id uuid references public.classification_rules(id),
  confidence_band text not null check (confidence_band in ('unknown','low','medium','high','automation_eligible')),
  status text not null check (status in (
    'suggested','approved','corrected','rejected','unresolved','conflict','superseded'
  )),
  evidence_json jsonb not null default '[]'::jsonb check (jsonb_typeof(evidence_json) = 'array'),
  alternatives_json jsonb not null default '[]'::jsonb check (jsonb_typeof(alternatives_json) = 'array'),
  requires_founder_review boolean not null default true,
  requires_accountant_review boolean not null default false,
  is_current boolean not null default true,
  supersedes_decision_id uuid references public.classification_decisions(id),
  policy_version text not null default 'phase-2-v1',
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create unique index if not exists classification_decisions_one_current
  on public.classification_decisions (normalized_transaction_id)
  where is_current;
create index if not exists classification_decisions_queue_lookup
  on public.classification_decisions (organization_id, is_current, status, created_at desc);

create table if not exists public.correction_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  normalized_transaction_id uuid not null references public.normalized_transactions(id) on delete cascade,
  previous_decision_id uuid references public.classification_decisions(id),
  new_decision_id uuid not null references public.classification_decisions(id),
  correction_scope text not null check (correction_scope in (
    'transaction_only','exact_description','merchant_amount_range','recurring_series',
    'merchant_entity_future','historical_and_future_matches'
  )),
  generated_rule_id uuid references public.classification_rules(id),
  actor_id uuid not null references auth.users(id),
  actor_role text not null check (actor_role in ('founder','accountant')),
  reason text not null check (char_length(reason) between 1 and 500),
  created_at timestamptz not null default now()
);

alter table public.canonical_categories enable row level security;
alter table public.organization_category_mappings enable row level security;
alter table public.classification_rules enable row level security;
alter table public.classification_decisions enable row level security;
alter table public.correction_events enable row level security;

drop policy if exists canonical_categories_read on public.canonical_categories;
create policy canonical_categories_read on public.canonical_categories
for select to authenticated using (active);

drop policy if exists category_mappings_read_member on public.organization_category_mappings;
create policy category_mappings_read_member on public.organization_category_mappings
for select to authenticated using (public.is_org_member(organization_id));

drop policy if exists classification_rules_read_member on public.classification_rules;
create policy classification_rules_read_member on public.classification_rules
for select to authenticated using (public.is_org_member(organization_id));

drop policy if exists classification_decisions_read_member on public.classification_decisions;
create policy classification_decisions_read_member on public.classification_decisions
for select to authenticated using (public.is_org_member(organization_id));

drop policy if exists correction_events_read_member on public.correction_events;
create policy correction_events_read_member on public.correction_events
for select to authenticated using (public.is_org_member(organization_id));

create or replace function public.phase2_actor_role(p_organization_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if public.has_org_role(p_organization_id, array['accountant_reviewer']) then
    return 'accountant';
  end if;
  if public.has_org_role(p_organization_id, array['owner','admin','founder_reviewer']) then
    return 'founder';
  end if;
  raise exception 'FORBIDDEN';
end;
$$;

create or replace function public.validate_classification_predicate(p_scope text, p_predicate jsonb)
returns boolean
language sql
immutable
set search_path = public
as $$
  select case
    when jsonb_typeof(p_predicate) <> 'object' then false
    when p_scope = 'exact_description' then nullif(trim(p_predicate->>'descriptionEquals'),'') is not null
    when p_scope = 'merchant_amount_range' then
      nullif(trim(p_predicate->>'counterpartyEquals'),'') is not null
      and (p_predicate ? 'minAmountMinor')
      and (p_predicate ? 'maxAmountMinor')
      and (p_predicate->>'minAmountMinor')::bigint >= 0
      and (p_predicate->>'maxAmountMinor')::bigint >= (p_predicate->>'minAmountMinor')::bigint
    when p_scope = 'recurring_series' then nullif(trim(p_predicate->>'recurrenceKey'),'') is not null
    when p_scope = 'merchant_entity_future' then nullif(trim(p_predicate->>'counterpartyEquals'),'') is not null
    when p_scope = 'historical_and_future_matches' then
      nullif(trim(p_predicate->>'descriptionEquals'),'') is not null
      or nullif(trim(p_predicate->>'counterpartyEquals'),'') is not null
      or nullif(trim(p_predicate->>'recurrenceKey'),'') is not null
    else false
  end;
$$;

create or replace function public.upsert_category_mapping(
  p_organization_id uuid,
  p_canonical_category_code text,
  p_account_name text,
  p_external_account_code text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_mapping public.organization_category_mappings%rowtype;
begin
  if not public.has_org_role(p_organization_id, array['owner','admin','accountant_reviewer']) then
    raise exception 'FORBIDDEN';
  end if;
  if not exists (select 1 from public.canonical_categories where code = p_canonical_category_code and active) then
    raise exception 'CATEGORY_NOT_FOUND';
  end if;
  if char_length(trim(p_account_name)) < 1 then raise exception 'VALIDATION_FAILED'; end if;

  insert into public.organization_category_mappings (
    organization_id, canonical_category_code, account_name, external_account_code, created_by
  ) values (
    p_organization_id, p_canonical_category_code, trim(p_account_name), nullif(trim(p_external_account_code),''), auth.uid()
  )
  on conflict (organization_id, canonical_category_code) do update set
    account_name = excluded.account_name,
    external_account_code = excluded.external_account_code,
    active = true,
    updated_at = now()
  returning * into v_mapping;

  insert into public.audit_events (
    organization_id, event_type, entity_type, entity_id, actor_type, actor_id,
    reason, after_json, policy_version
  ) values (
    p_organization_id, 'category.mapping_upserted', 'organization_category_mapping', v_mapping.id,
    'user', auth.uid(), 'Organization account mapping created or updated', to_jsonb(v_mapping), 'phase-2-v1'
  );

  return to_jsonb(v_mapping);
end;
$$;

create or replace function public.create_classification_rule(
  p_organization_id uuid,
  p_name text,
  p_scope text,
  p_predicate jsonb,
  p_canonical_category_code text,
  p_organization_category_mapping_id uuid default null,
  p_priority integer default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rule public.classification_rules%rowtype;
  v_actor_role text;
  v_specificity integer;
  v_priority integer;
begin
  v_actor_role := public.phase2_actor_role(p_organization_id);
  if not public.validate_classification_predicate(p_scope, p_predicate) then
    raise exception 'RULE_INVALID_PREDICATE';
  end if;
  if not exists (select 1 from public.canonical_categories where code = p_canonical_category_code and active) then
    raise exception 'CATEGORY_NOT_FOUND';
  end if;
  if p_organization_category_mapping_id is not null and not exists (
    select 1 from public.organization_category_mappings m
    where m.id = p_organization_category_mapping_id
      and m.organization_id = p_organization_id
      and m.canonical_category_code = p_canonical_category_code
      and m.active
  ) then raise exception 'CATEGORY_MAPPING_INVALID'; end if;

  select count(*)::integer into v_specificity from jsonb_object_keys(p_predicate);
  v_priority := coalesce(p_priority, case when v_actor_role = 'accountant' then 1000 else 900 end);
  if v_priority < 0 or v_priority > 2000 then raise exception 'RULE_INVALID_PRIORITY'; end if;

  insert into public.classification_rules (
    organization_id, name, scope, predicate_json, canonical_category_code,
    organization_category_mapping_id, priority, specificity, source_role,
    status, created_by, approved_by
  ) values (
    p_organization_id, trim(p_name), p_scope, p_predicate, p_canonical_category_code,
    p_organization_category_mapping_id, v_priority, v_specificity, v_actor_role,
    'active', auth.uid(), case when v_actor_role = 'accountant' then auth.uid() else null end
  ) returning * into v_rule;

  insert into public.audit_events (
    organization_id, event_type, entity_type, entity_id, actor_type, actor_id,
    reason, after_json, policy_version
  ) values (
    p_organization_id, 'classification.rule_created', 'classification_rule', v_rule.id,
    'user', auth.uid(), 'Explicit entity-scoped classification rule created', to_jsonb(v_rule), 'phase-2-v1'
  );

  return to_jsonb(v_rule);
end;
$$;

create or replace function public.disable_classification_rule(p_rule_id uuid, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rule public.classification_rules%rowtype;
begin
  select * into v_rule from public.classification_rules where id = p_rule_id for update;
  if not found or not public.is_org_member(v_rule.organization_id) then raise exception 'NOT_FOUND'; end if;
  if not public.has_org_role(v_rule.organization_id, array['owner','admin','founder_reviewer','accountant_reviewer']) then
    raise exception 'FORBIDDEN';
  end if;
  update public.classification_rules
  set status = 'disabled', disabled_at = now(), disabled_reason = trim(p_reason), updated_at = now()
  where id = p_rule_id returning * into v_rule;

  insert into public.audit_events (
    organization_id, event_type, entity_type, entity_id, actor_type, actor_id,
    reason, after_json, policy_version
  ) values (
    v_rule.organization_id, 'classification.rule_disabled', 'classification_rule', v_rule.id,
    'user', auth.uid(), trim(p_reason), to_jsonb(v_rule), 'phase-2-v1'
  );
  return to_jsonb(v_rule);
end;
$$;

create or replace function public.get_categorization_candidates(p_organization_id uuid, p_limit integer default 100)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_org_member(p_organization_id) then raise exception 'NOT_FOUND'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', t.id,
      'organizationId', t.organization_id,
      'financialAccountId', t.financial_account_id,
      'postedDate', t.posted_date,
      'descriptionOriginal', t.description_original,
      'descriptionNormalized', t.description_normalized,
      'amountMinor', t.amount_minor,
      'currency', t.currency,
      'direction', t.direction,
      'externalReference', t.external_reference,
      'counterpartyRaw', t.counterparty_raw
    ) order by t.posted_date desc, t.id)
    from (
      select n.* from public.normalized_transactions n
      where n.organization_id = p_organization_id
        and not exists (
          select 1 from public.classification_decisions d
          where d.normalized_transaction_id = n.id
            and d.is_current
            and d.status in ('approved','corrected')
        )
      order by n.posted_date desc, n.id
      limit greatest(1, least(coalesce(p_limit,100),500))
    ) t
  ), '[]'::jsonb);
end;
$$;

create or replace function public.store_rule_suggestions(p_organization_id uuid, p_suggestions jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item jsonb;
  v_transaction_id uuid;
  v_rule_id uuid;
  v_category text;
  v_status text;
  v_inserted integer := 0;
  v_skipped integer := 0;
  v_prior_id uuid;
begin
  if not public.has_org_role(p_organization_id, array['owner','admin','founder_reviewer','accountant_reviewer']) then
    raise exception 'FORBIDDEN';
  end if;
  if jsonb_typeof(p_suggestions) <> 'array' then raise exception 'VALIDATION_FAILED'; end if;

  for v_item in select value from jsonb_array_elements(p_suggestions)
  loop
    v_transaction_id := (v_item->>'transactionId')::uuid;
    v_rule_id := nullif(v_item->>'sourceRuleId','')::uuid;
    v_category := nullif(v_item->>'canonicalCategoryCode','');
    v_status := coalesce(v_item->>'status','suggested');

    if not exists (
      select 1 from public.normalized_transactions t
      where t.id = v_transaction_id and t.organization_id = p_organization_id
    ) then raise exception 'TRANSACTION_NOT_FOUND'; end if;

    if exists (
      select 1 from public.classification_decisions d
      where d.normalized_transaction_id = v_transaction_id and d.is_current
        and d.status in ('approved','corrected')
    ) then
      v_skipped := v_skipped + 1;
      continue;
    end if;

    if v_category is not null and not exists (
      select 1 from public.canonical_categories where code = v_category and active
    ) then raise exception 'CATEGORY_NOT_FOUND'; end if;
    if v_rule_id is not null and not exists (
      select 1 from public.classification_rules r
      where r.id = v_rule_id and r.organization_id = p_organization_id and r.status = 'active'
    ) then raise exception 'RULE_NOT_FOUND'; end if;
    if v_status not in ('suggested','conflict','unresolved') then raise exception 'DECISION_INVALID_STATUS'; end if;

    select id into v_prior_id from public.classification_decisions
    where normalized_transaction_id = v_transaction_id and is_current
    order by created_at desc limit 1;

    update public.classification_decisions
    set is_current = false,
        status = case when status in ('suggested','conflict','unresolved') then 'superseded' else status end
    where normalized_transaction_id = v_transaction_id and is_current;

    insert into public.classification_decisions (
      organization_id, normalized_transaction_id, canonical_category_code,
      decision_source, source_rule_id, confidence_band, status, evidence_json,
      alternatives_json, requires_founder_review, requires_accountant_review,
      supersedes_decision_id, created_by
    ) values (
      p_organization_id, v_transaction_id, v_category,
      'rule', v_rule_id, coalesce(v_item->>'confidenceBand','medium'), v_status,
      coalesce(v_item->'evidence','[]'::jsonb), coalesce(v_item->'alternatives','[]'::jsonb),
      coalesce((v_item->>'requiresFounderReview')::boolean, true),
      coalesce((v_item->>'requiresAccountantReview')::boolean, false),
      v_prior_id, auth.uid()
    );
    v_inserted := v_inserted + 1;
  end loop;

  insert into public.audit_events (
    organization_id, event_type, entity_type, entity_id, actor_type, actor_id,
    reason, after_json, policy_version
  ) values (
    p_organization_id, 'classification.rule_run_stored', 'organization', p_organization_id,
    'rule', auth.uid(), 'Deterministic rule suggestions stored',
    jsonb_build_object('inserted',v_inserted,'skippedApproved',v_skipped), 'phase-2-v1'
  );

  return jsonb_build_object('inserted',v_inserted,'skippedApproved',v_skipped);
end;
$$;

create or replace function public.record_categorization_correction(
  p_organization_id uuid,
  p_transaction_id uuid,
  p_canonical_category_code text,
  p_organization_category_mapping_id uuid,
  p_scope text,
  p_predicate jsonb,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_role text;
  v_previous_id uuid;
  v_decision_id uuid := gen_random_uuid();
  v_rule_id uuid;
  v_status text;
  v_specificity integer;
  v_priority integer;
begin
  v_actor_role := public.phase2_actor_role(p_organization_id);
  if not exists (
    select 1 from public.normalized_transactions t
    where t.id = p_transaction_id and t.organization_id = p_organization_id
  ) then raise exception 'TRANSACTION_NOT_FOUND'; end if;
  if not exists (select 1 from public.canonical_categories where code = p_canonical_category_code and active) then
    raise exception 'CATEGORY_NOT_FOUND';
  end if;
  if p_organization_category_mapping_id is not null and not exists (
    select 1 from public.organization_category_mappings m
    where m.id = p_organization_category_mapping_id
      and m.organization_id = p_organization_id
      and m.canonical_category_code = p_canonical_category_code
      and m.active
  ) then raise exception 'CATEGORY_MAPPING_INVALID'; end if;
  if p_scope <> 'transaction_only' and not public.validate_classification_predicate(p_scope,p_predicate) then
    raise exception 'RULE_INVALID_PREDICATE';
  end if;
  if char_length(trim(p_reason)) < 1 then raise exception 'VALIDATION_FAILED'; end if;

  select id into v_previous_id from public.classification_decisions
  where normalized_transaction_id = p_transaction_id and is_current
  order by created_at desc limit 1;

  update public.classification_decisions
  set is_current = false,
      status = case when status in ('suggested','conflict','unresolved','approved','corrected') then 'superseded' else status end
  where normalized_transaction_id = p_transaction_id and is_current;

  v_status := case when v_previous_id is null then 'approved' else 'corrected' end;
  insert into public.classification_decisions (
    id, organization_id, normalized_transaction_id, canonical_category_code,
    organization_category_mapping_id, decision_source, confidence_band, status,
    evidence_json, alternatives_json, requires_founder_review,
    requires_accountant_review, supersedes_decision_id, created_by
  ) values (
    v_decision_id, p_organization_id, p_transaction_id, p_canonical_category_code,
    p_organization_category_mapping_id, v_actor_role, 'high', v_status,
    jsonb_build_array(jsonb_build_object('type','human_correction','reason',trim(p_reason))),
    '[]'::jsonb, false, false, v_previous_id, auth.uid()
  );

  if p_scope <> 'transaction_only' then
    select count(*)::integer into v_specificity from jsonb_object_keys(p_predicate);
    v_priority := case when v_actor_role = 'accountant' then 1000 else 900 end;
    insert into public.classification_rules (
      organization_id, name, scope, predicate_json, canonical_category_code,
      organization_category_mapping_id, priority, specificity, source_role,
      status, created_by, approved_by
    ) values (
      p_organization_id,
      'Correction rule: ' || left(trim(p_reason),120),
      p_scope, p_predicate, p_canonical_category_code,
      p_organization_category_mapping_id, v_priority, v_specificity, v_actor_role,
      'active', auth.uid(), case when v_actor_role = 'accountant' then auth.uid() else null end
    ) returning id into v_rule_id;
  end if;

  insert into public.correction_events (
    organization_id, normalized_transaction_id, previous_decision_id, new_decision_id,
    correction_scope, generated_rule_id, actor_id, actor_role, reason
  ) values (
    p_organization_id, p_transaction_id, v_previous_id, v_decision_id,
    p_scope, v_rule_id, auth.uid(), v_actor_role, trim(p_reason)
  );

  insert into public.audit_events (
    organization_id, event_type, entity_type, entity_id, actor_type, actor_id,
    reason, before_json, after_json, policy_version
  ) values (
    p_organization_id, 'classification.corrected', 'normalized_transaction', p_transaction_id,
    'user', auth.uid(), trim(p_reason),
    jsonb_build_object('previousDecisionId',v_previous_id),
    jsonb_build_object('newDecisionId',v_decision_id,'generatedRuleId',v_rule_id,'scope',p_scope),
    'phase-2-v1'
  );

  return jsonb_build_object('decisionId',v_decision_id,'generatedRuleId',v_rule_id,'status',v_status);
end;
$$;

create or replace function public.get_categorization_queue(
  p_organization_id uuid,
  p_limit integer default 100,
  p_status text default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_org_member(p_organization_id) then raise exception 'NOT_FOUND'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'transaction', jsonb_build_object(
        'id', t.id,
        'postedDate', t.posted_date,
        'descriptionOriginal', t.description_original,
        'descriptionNormalized', t.description_normalized,
        'amountMinor', t.amount_minor,
        'currency', t.currency,
        'direction', t.direction,
        'counterpartyRaw', t.counterparty_raw
      ),
      'decision', case when d.id is null then null else jsonb_build_object(
        'id', d.id,
        'canonicalCategoryCode', d.canonical_category_code,
        'decisionSource', d.decision_source,
        'sourceRuleId', d.source_rule_id,
        'confidenceBand', d.confidence_band,
        'status', d.status,
        'evidence', d.evidence_json,
        'alternatives', d.alternatives_json,
        'requiresFounderReview', d.requires_founder_review,
        'requiresAccountantReview', d.requires_accountant_review
      ) end
    ) order by t.posted_date desc, t.id)
    from (
      select * from public.normalized_transactions
      where organization_id = p_organization_id
      order by posted_date desc, id
      limit greatest(1,least(coalesce(p_limit,100),500))
    ) t
    left join public.classification_decisions d
      on d.normalized_transaction_id = t.id and d.is_current
    where p_status is null
       or (p_status = 'unclassified' and d.id is null)
       or d.status = p_status
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.phase2_actor_role(uuid) from public;
revoke all on function public.upsert_category_mapping(uuid,text,text,text) from public;
revoke all on function public.create_classification_rule(uuid,text,text,jsonb,text,uuid,integer) from public;
revoke all on function public.disable_classification_rule(uuid,text) from public;
revoke all on function public.get_categorization_candidates(uuid,integer) from public;
revoke all on function public.store_rule_suggestions(uuid,jsonb) from public;
revoke all on function public.record_categorization_correction(uuid,uuid,text,uuid,text,jsonb,text) from public;
revoke all on function public.get_categorization_queue(uuid,integer,text) from public;

grant execute on function public.upsert_category_mapping(uuid,text,text,text) to authenticated;
grant execute on function public.create_classification_rule(uuid,text,text,jsonb,text,uuid,integer) to authenticated;
grant execute on function public.disable_classification_rule(uuid,text) to authenticated;
grant execute on function public.get_categorization_candidates(uuid,integer) to authenticated;
grant execute on function public.store_rule_suggestions(uuid,jsonb) to authenticated;
grant execute on function public.record_categorization_correction(uuid,uuid,text,uuid,text,jsonb,text) to authenticated;
grant execute on function public.get_categorization_queue(uuid,integer,text) to authenticated;

grant select on public.canonical_categories to authenticated;
grant select on public.organization_category_mappings to authenticated;
grant select on public.classification_rules to authenticated;
grant select on public.classification_decisions to authenticated;
grant select on public.correction_events to authenticated;
