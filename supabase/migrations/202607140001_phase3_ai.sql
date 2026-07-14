-- Ledgerly Phase 3: provider-neutral AI ambiguity suggestions.
-- Model output is isolated from human decisions and can only remain suggested/unresolved.

create table if not exists public.ai_prompt_versions (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  version text not null,
  template_hash text not null check (template_hash ~ '^[0-9a-f]{64}$'),
  schema_version text not null,
  policy_version text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (code, version)
);

create table if not exists public.organization_ai_policies (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  enabled boolean not null default false,
  provider text not null default 'fake',
  model text not null default 'fixture-v1',
  prompt_version text not null default 'phase-3-prompt-v1',
  policy_version text not null default 'phase-3-policy-v1',
  schema_version text not null default 'phase-3-schema-v1',
  monthly_budget_minor bigint not null default 0 check (monthly_budget_minor >= 0),
  timeout_ms integer not null default 10000 check (timeout_ms between 100 and 60000),
  retry_limit integer not null default 0 check (retry_limit between 0 and 2),
  circuit_state text not null default 'closed' check (circuit_state in ('closed','open','half_open')),
  circuit_opened_at timestamptz,
  updated_by uuid not null references auth.users(id),
  updated_at timestamptz not null default now()
);

create table if not exists public.ai_model_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  normalized_transaction_id uuid not null references public.normalized_transactions(id) on delete cascade,
  deterministic_decision_id uuid references public.classification_decisions(id),
  idempotency_key text not null check (char_length(idempotency_key) between 16 and 200),
  provider text not null,
  model text not null,
  prompt_version text not null,
  policy_version text not null,
  schema_version text not null,
  input_hash text not null check (input_hash ~ '^[0-9a-f]{64}$'),
  authorized_evidence_json jsonb not null check (jsonb_typeof(authorized_evidence_json) = 'array'),
  allowed_categories_json jsonb not null check (jsonb_typeof(allowed_categories_json) = 'array'),
  minimized_input_json jsonb not null check (jsonb_typeof(minimized_input_json) = 'object'),
  status text not null default 'pending' check (status in ('pending','running','succeeded','invalid_output','provider_failed','blocked')),
  provider_request_id text,
  output_json jsonb,
  error_code text,
  input_tokens integer check (input_tokens is null or input_tokens >= 0),
  output_tokens integer check (output_tokens is null or output_tokens >= 0),
  estimated_cost_minor bigint check (estimated_cost_minor is null or estimated_cost_minor >= 0),
  latency_ms integer check (latency_ms is null or latency_ms >= 0),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (organization_id, idempotency_key)
);

create index if not exists ai_model_runs_transaction_lookup
  on public.ai_model_runs (organization_id, normalized_transaction_id, created_at desc);
create index if not exists ai_model_runs_budget_lookup
  on public.ai_model_runs (organization_id, created_at)
  where estimated_cost_minor is not null;

create table if not exists public.ai_suggestions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  normalized_transaction_id uuid not null references public.normalized_transactions(id) on delete cascade,
  model_run_id uuid not null references public.ai_model_runs(id) on delete cascade,
  deterministic_decision_id uuid references public.classification_decisions(id),
  outcome text not null check (outcome in ('suggestion','insufficient_evidence','refusal')),
  canonical_category_code text references public.canonical_categories(code),
  confidence_band text not null check (confidence_band in ('unknown','low','medium','high')),
  alternatives_json jsonb not null default '[]'::jsonb check (jsonb_typeof(alternatives_json) = 'array'),
  evidence_reference_ids_json jsonb not null default '[]'::jsonb check (jsonb_typeof(evidence_reference_ids_json) = 'array'),
  reason_codes_json jsonb not null default '[]'::jsonb check (jsonb_typeof(reason_codes_json) = 'array'),
  founder_question text,
  requires_founder_review boolean not null default true check (requires_founder_review),
  requires_accountant_review boolean not null default false,
  explanation text not null check (char_length(explanation) between 1 and 800),
  is_current boolean not null default true,
  created_at timestamptz not null default now(),
  check (
    (outcome = 'suggestion' and canonical_category_code is not null)
    or (outcome in ('insufficient_evidence','refusal') and canonical_category_code is null)
  )
);

create unique index if not exists ai_suggestions_one_current
  on public.ai_suggestions (normalized_transaction_id)
  where is_current;
create index if not exists ai_suggestions_queue_lookup
  on public.ai_suggestions (organization_id, is_current, outcome, created_at desc);

alter table public.ai_prompt_versions enable row level security;
alter table public.organization_ai_policies enable row level security;
alter table public.ai_model_runs enable row level security;
alter table public.ai_suggestions enable row level security;

drop policy if exists ai_prompt_versions_read on public.ai_prompt_versions;
create policy ai_prompt_versions_read on public.ai_prompt_versions
for select to authenticated using (active);

drop policy if exists organization_ai_policies_read_member on public.organization_ai_policies;
create policy organization_ai_policies_read_member on public.organization_ai_policies
for select to authenticated using (public.is_org_member(organization_id));

drop policy if exists ai_model_runs_read_member on public.ai_model_runs;
create policy ai_model_runs_read_member on public.ai_model_runs
for select to authenticated using (public.is_org_member(organization_id));

drop policy if exists ai_suggestions_read_member on public.ai_suggestions;
create policy ai_suggestions_read_member on public.ai_suggestions
for select to authenticated using (public.is_org_member(organization_id));

create or replace function public.configure_ai_policy(
  p_organization_id uuid,
  p_enabled boolean,
  p_provider text,
  p_model text,
  p_prompt_version text,
  p_policy_version text,
  p_schema_version text,
  p_monthly_budget_minor bigint,
  p_timeout_ms integer,
  p_retry_limit integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.has_org_role(p_organization_id, array['owner','admin']) then
    raise exception 'FORBIDDEN';
  end if;
  if p_monthly_budget_minor < 0 or p_timeout_ms not between 100 and 60000 or p_retry_limit not between 0 and 2 then
    raise exception 'AI_POLICY_INVALID';
  end if;

  insert into public.organization_ai_policies (
    organization_id, enabled, provider, model, prompt_version, policy_version,
    schema_version, monthly_budget_minor, timeout_ms, retry_limit, updated_by
  ) values (
    p_organization_id, p_enabled, p_provider, p_model, p_prompt_version, p_policy_version,
    p_schema_version, p_monthly_budget_minor, p_timeout_ms, p_retry_limit, auth.uid()
  ) on conflict (organization_id) do update set
    enabled = excluded.enabled,
    provider = excluded.provider,
    model = excluded.model,
    prompt_version = excluded.prompt_version,
    policy_version = excluded.policy_version,
    schema_version = excluded.schema_version,
    monthly_budget_minor = excluded.monthly_budget_minor,
    timeout_ms = excluded.timeout_ms,
    retry_limit = excluded.retry_limit,
    updated_by = auth.uid(),
    updated_at = now();

  insert into public.audit_events (
    organization_id, event_type, entity_type, entity_id, actor_type, actor_id, reason, after_json
  ) values (
    p_organization_id, 'ai.policy_configured', 'organization', p_organization_id,
    'user', auth.uid(), 'Organization AI policy configured',
    jsonb_build_object('enabled', p_enabled, 'provider', p_provider, 'model', p_model,
      'monthlyBudgetMinor', p_monthly_budget_minor, 'timeoutMs', p_timeout_ms, 'retryLimit', p_retry_limit)
  );

  return jsonb_build_object('organizationId', p_organization_id, 'enabled', p_enabled);
end;
$$;

create or replace function public.begin_ai_model_run(
  p_organization_id uuid,
  p_transaction_id uuid,
  p_idempotency_key text,
  p_input_hash text,
  p_authorized_evidence jsonb,
  p_allowed_categories jsonb,
  p_minimized_input jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_policy public.organization_ai_policies%rowtype;
  v_transaction public.normalized_transactions%rowtype;
  v_decision_id uuid;
  v_spend bigint;
  v_run_id uuid;
begin
  if not public.has_org_role(p_organization_id, array['owner','admin','founder_reviewer','accountant_reviewer']) then
    raise exception 'FORBIDDEN';
  end if;

  select * into v_policy from public.organization_ai_policies
  where organization_id = p_organization_id;
  if not found or not v_policy.enabled then raise exception 'AI_DISABLED'; end if;
  if v_policy.circuit_state = 'open' then raise exception 'AI_CIRCUIT_OPEN'; end if;

  select * into v_transaction from public.normalized_transactions
  where id = p_transaction_id and organization_id = p_organization_id;
  if not found then raise exception 'TRANSACTION_NOT_FOUND'; end if;

  select id into v_decision_id from public.classification_decisions
  where normalized_transaction_id = p_transaction_id and is_current
    and status in ('unresolved','conflict')
  limit 1;
  if v_decision_id is null then raise exception 'AI_NOT_ELIGIBLE'; end if;

  select coalesce(sum(estimated_cost_minor), 0) into v_spend
  from public.ai_model_runs
  where organization_id = p_organization_id
    and created_at >= date_trunc('month', now());
  if v_policy.monthly_budget_minor > 0 and v_spend >= v_policy.monthly_budget_minor then
    raise exception 'AI_BUDGET_EXHAUSTED';
  end if;

  select id into v_run_id from public.ai_model_runs
  where organization_id = p_organization_id and idempotency_key = p_idempotency_key;
  if v_run_id is not null then
    return jsonb_build_object('runId', v_run_id, 'cached', true);
  end if;

  insert into public.ai_model_runs (
    organization_id, normalized_transaction_id, deterministic_decision_id, idempotency_key,
    provider, model, prompt_version, policy_version, schema_version, input_hash,
    authorized_evidence_json, allowed_categories_json, minimized_input_json,
    status, created_by
  ) values (
    p_organization_id, p_transaction_id, v_decision_id, p_idempotency_key,
    v_policy.provider, v_policy.model, v_policy.prompt_version, v_policy.policy_version,
    v_policy.schema_version, p_input_hash, p_authorized_evidence, p_allowed_categories,
    p_minimized_input, 'running', auth.uid()
  ) returning id into v_run_id;

  return jsonb_build_object(
    'runId', v_run_id, 'cached', false, 'provider', v_policy.provider,
    'model', v_policy.model, 'timeoutMs', v_policy.timeout_ms, 'retryLimit', v_policy.retry_limit
  );
end;
$$;

create or replace function public.complete_ai_model_run(
  p_run_id uuid,
  p_status text,
  p_output jsonb,
  p_error_code text,
  p_provider_request_id text,
  p_input_tokens integer,
  p_output_tokens integer,
  p_estimated_cost_minor bigint,
  p_latency_ms integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_run public.ai_model_runs%rowtype;
  v_category_risk text;
  v_evidence text;
  v_suggestion_id uuid;
begin
  select * into v_run from public.ai_model_runs where id = p_run_id for update;
  if not found or not public.has_org_role(v_run.organization_id, array['owner','admin','founder_reviewer','accountant_reviewer']) then
    raise exception 'NOT_FOUND';
  end if;
  if v_run.status not in ('pending','running') then
    return jsonb_build_object('runId', v_run.id, 'cached', true, 'status', v_run.status);
  end if;
  if p_status not in ('succeeded','invalid_output','provider_failed','blocked') then
    raise exception 'AI_RUN_STATUS_INVALID';
  end if;

  if p_status = 'succeeded' then
    if jsonb_typeof(p_output) <> 'object' or p_output->>'outcome' not in ('suggestion','insufficient_evidence','refusal') then
      raise exception 'AI_OUTPUT_INVALID';
    end if;
    if coalesce((p_output->>'requiresFounderReview')::boolean, false) is not true then
      raise exception 'AI_OUTPUT_CANNOT_APPROVE';
    end if;
    if p_output->>'suggestedCategoryCode' is not null then
      if not (v_run.allowed_categories_json ? (p_output->>'suggestedCategoryCode')) then
        raise exception 'AI_CATEGORY_NOT_ALLOWED';
      end if;
      select risk into v_category_risk from public.canonical_categories
      where code = p_output->>'suggestedCategoryCode' and active;
      if v_category_risk = 'high' and coalesce((p_output->>'requiresAccountantReview')::boolean, false) is not true then
        raise exception 'AI_HIGH_RISK_REQUIRES_ACCOUNTANT';
      end if;
    end if;
    for v_evidence in select value from jsonb_array_elements_text(coalesce(p_output->'evidenceReferenceIds','[]'::jsonb))
    loop
      if not (v_run.authorized_evidence_json ? v_evidence) then
        raise exception 'AI_EVIDENCE_NOT_AUTHORIZED';
      end if;
    end loop;
  end if;

  update public.ai_model_runs set
    status = p_status,
    output_json = p_output,
    error_code = p_error_code,
    provider_request_id = p_provider_request_id,
    input_tokens = p_input_tokens,
    output_tokens = p_output_tokens,
    estimated_cost_minor = p_estimated_cost_minor,
    latency_ms = p_latency_ms,
    completed_at = now()
  where id = p_run_id;

  update public.ai_suggestions set is_current = false
  where normalized_transaction_id = v_run.normalized_transaction_id and is_current;

  insert into public.ai_suggestions (
    organization_id, normalized_transaction_id, model_run_id, deterministic_decision_id,
    outcome, canonical_category_code, confidence_band, alternatives_json,
    evidence_reference_ids_json, reason_codes_json, founder_question,
    requires_founder_review, requires_accountant_review, explanation
  ) values (
    v_run.organization_id, v_run.normalized_transaction_id, v_run.id, v_run.deterministic_decision_id,
    case when p_status = 'succeeded' then p_output->>'outcome' else 'insufficient_evidence' end,
    case when p_status = 'succeeded' then nullif(p_output->>'suggestedCategoryCode','') else null end,
    case when p_status = 'succeeded' then coalesce(p_output->>'confidenceBand','unknown') else 'unknown' end,
    case when p_status = 'succeeded' then coalesce(p_output->'alternatives','[]'::jsonb) else '[]'::jsonb end,
    case when p_status = 'succeeded' then coalesce(p_output->'evidenceReferenceIds','[]'::jsonb) else '[]'::jsonb end,
    case when p_status = 'succeeded' then coalesce(p_output->'reasonCodes','[]'::jsonb) else jsonb_build_array('insufficient_business_context') end,
    case when p_status = 'succeeded' then nullif(p_output->>'founderQuestion','') else 'Please provide the business purpose of this transaction.' end,
    true,
    case when p_status = 'succeeded' then coalesce((p_output->>'requiresAccountantReview')::boolean, false) else false end,
    case when p_status = 'succeeded' then coalesce(p_output->>'explanation','Model suggestion requires review') else 'The AI provider or policy gate failed; no category was applied.' end
  ) returning id into v_suggestion_id;

  insert into public.audit_events (
    organization_id, event_type, entity_type, entity_id, actor_type, actor_id,
    reason, after_json, evidence_references, policy_version
  ) values (
    v_run.organization_id, 'ai.run_completed', 'ai_model_run', v_run.id,
    'model', null, 'AI ambiguity run completed without approval authority',
    jsonb_build_object('status', p_status, 'suggestionId', v_suggestion_id, 'errorCode', p_error_code),
    v_run.authorized_evidence_json, v_run.policy_version
  );

  return jsonb_build_object('runId', v_run.id, 'suggestionId', v_suggestion_id, 'status', p_status);
end;
$$;

create or replace function public.get_ai_policy_context(p_organization_id uuid, p_transaction_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_policy public.organization_ai_policies%rowtype;
  v_transaction public.normalized_transactions%rowtype;
  v_decision public.classification_decisions%rowtype;
begin
  if not public.is_org_member(p_organization_id) then raise exception 'NOT_FOUND'; end if;
  select * into v_policy from public.organization_ai_policies where organization_id = p_organization_id;
  if not found then raise exception 'AI_DISABLED'; end if;
  select * into v_transaction from public.normalized_transactions
    where id = p_transaction_id and organization_id = p_organization_id;
  if not found then raise exception 'TRANSACTION_NOT_FOUND'; end if;
  select * into v_decision from public.classification_decisions
    where normalized_transaction_id = p_transaction_id and is_current limit 1;

  return jsonb_build_object(
    'policy', jsonb_build_object(
      'enabled', v_policy.enabled, 'provider', v_policy.provider, 'model', v_policy.model,
      'promptVersion', v_policy.prompt_version, 'policyVersion', v_policy.policy_version,
      'schemaVersion', v_policy.schema_version, 'timeoutMs', v_policy.timeout_ms,
      'retryLimit', v_policy.retry_limit, 'circuitState', v_policy.circuit_state
    ),
    'transaction', jsonb_build_object(
      'transactionId', v_transaction.id,
      'evidenceVersion', encode(digest(v_transaction.id::text || ':' || v_transaction.created_at::text, 'sha256'), 'hex'),
      'postedDate', v_transaction.posted_date,
      'amountMinor', v_transaction.amount_minor,
      'currency', v_transaction.currency,
      'direction', v_transaction.direction,
      'description', v_transaction.description_original,
      'counterparty', v_transaction.counterparty_raw,
      'externalReferencePresent', v_transaction.external_reference is not null
    ),
    'deterministic', jsonb_build_object(
      'status', coalesce(v_decision.status, 'unresolved'),
      'decisionVersion', coalesce(v_decision.id::text, 'none'),
      'matchedRuleIds', case when v_decision.source_rule_id is null then '[]'::jsonb else jsonb_build_array(v_decision.source_rule_id) end,
      'alternatives', coalesce(v_decision.alternatives_json, '[]'::jsonb)
    ),
    'allowedCategories', coalesce((
      select jsonb_agg(jsonb_build_object('code', c.code, 'label', c.label, 'risk', c.risk) order by c.code)
      from public.canonical_categories c where c.active
    ), '[]'::jsonb),
    'authorizedEvidence', jsonb_build_array(
      jsonb_build_object('id', 'transaction:' || v_transaction.id::text, 'type', 'transaction'),
      jsonb_build_object('id', 'source_row:' || v_transaction.source_row_id::text, 'type', 'source_row')
    )
  );
end;
$$;
