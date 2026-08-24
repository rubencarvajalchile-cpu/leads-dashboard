-- CRM foundation: protected AI funnel and explicit human ownership.
-- This migration is additive. It does not alter legacy n8n tables.

create type public.crm_member_role as enum ('OWNER', 'MANAGER', 'SELLER', 'VIEWER');
create type public.crm_authority as enum ('AI', 'HUMAN');
create type public.crm_lead_stage as enum (
  'AI_NEW',
  'AI_QUALIFYING',
  'AI_QUALIFIED',
  'AI_CALL_REQUESTED',
  'HUMAN_NEW',
  'HUMAN_CONTACTING',
  'HUMAN_PROPOSAL',
  'HUMAN_NEGOTIATION',
  'WON',
  'LOST',
  'DO_NOT_CONTACT'
);
create type public.crm_priority as enum ('P1', 'P2', 'P3');
create type public.crm_task_status as enum ('OPEN', 'DONE', 'CANCELLED');
create type public.crm_actor_type as enum ('SYSTEM', 'AI', 'HUMAN');

create table public.crm_organizations (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,62}$'),
  name text not null check (length(trim(name)) between 2 and 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.crm_organization_members (
  organization_id uuid not null references public.crm_organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.crm_member_role not null default 'SELLER',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);

create table public.crm_contacts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.crm_organizations(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 160),
  phone_e164 text check (phone_e164 is null or phone_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  email text,
  source text,
  legacy_table text,
  legacy_id bigint,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, phone_e164),
  unique (organization_id, legacy_table, legacy_id)
);

create table public.crm_leads (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.crm_organizations(id) on delete cascade,
  contact_id uuid not null references public.crm_contacts(id) on delete cascade,
  authority public.crm_authority not null default 'AI',
  stage public.crm_lead_stage not null default 'AI_NEW',
  previous_ai_stage public.crm_lead_stage,
  assigned_to uuid references auth.users(id) on delete set null,
  product_interest text,
  qualification_status text,
  priority public.crm_priority not null default 'P3',
  human_taken_at timestamptz,
  human_taken_by uuid references auth.users(id) on delete set null,
  closed_at timestamptz,
  version bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint crm_leads_authority_stage_check check (
    (authority = 'AI' and stage in ('AI_NEW', 'AI_QUALIFYING', 'AI_QUALIFIED', 'AI_CALL_REQUESTED'))
    or
    (authority = 'HUMAN' and stage in (
      'HUMAN_NEW', 'HUMAN_CONTACTING', 'HUMAN_PROPOSAL', 'HUMAN_NEGOTIATION',
      'WON', 'LOST', 'DO_NOT_CONTACT'
    ))
  ),
  constraint crm_leads_previous_ai_stage_check check (
    previous_ai_stage is null
    or previous_ai_stage in ('AI_NEW', 'AI_QUALIFYING', 'AI_QUALIFIED', 'AI_CALL_REQUESTED')
  )
);

create index crm_leads_org_stage_idx on public.crm_leads(organization_id, authority, stage);
create index crm_leads_assigned_idx on public.crm_leads(assigned_to) where assigned_to is not null;
create index crm_leads_updated_idx on public.crm_leads(organization_id, updated_at desc);

create table public.crm_activities (
  id bigint generated always as identity primary key,
  organization_id uuid not null references public.crm_organizations(id) on delete cascade,
  lead_id uuid not null references public.crm_leads(id) on delete cascade,
  actor_type public.crm_actor_type not null,
  actor_user_id uuid references auth.users(id) on delete set null,
  event_type text not null,
  from_stage public.crm_lead_stage,
  to_stage public.crm_lead_stage,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index crm_activities_lead_idx on public.crm_activities(lead_id, created_at desc);

create table public.crm_notes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.crm_organizations(id) on delete cascade,
  lead_id uuid not null references public.crm_leads(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete restrict,
  body text not null check (length(trim(body)) between 1 and 4000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.crm_tasks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.crm_organizations(id) on delete cascade,
  lead_id uuid not null references public.crm_leads(id) on delete cascade,
  assigned_to uuid not null references auth.users(id) on delete restrict,
  created_by uuid not null references auth.users(id) on delete restrict,
  title text not null check (length(trim(title)) between 1 and 240),
  due_at timestamptz,
  status public.crm_task_status not null default 'OPEN',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.crm_is_org_member(p_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.crm_organization_members m
    where m.organization_id = p_organization_id
      and m.user_id = auth.uid()
      and m.active
  );
$$;

create or replace function public.crm_is_org_manager(p_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.crm_organization_members m
    where m.organization_id = p_organization_id
      and m.user_id = auth.uid()
      and m.active
      and m.role in ('OWNER', 'MANAGER')
  );
$$;

create or replace function public.crm_can_operate_org(p_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.crm_organization_members m
    where m.organization_id = p_organization_id
      and m.user_id = auth.uid()
      and m.active
      and m.role in ('OWNER', 'MANAGER', 'SELLER')
  );
$$;

create or replace function public.crm_touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger crm_organizations_touch_updated_at
before update on public.crm_organizations
for each row execute function public.crm_touch_updated_at();

create trigger crm_contacts_touch_updated_at
before update on public.crm_contacts
for each row execute function public.crm_touch_updated_at();

create trigger crm_notes_touch_updated_at
before update on public.crm_notes
for each row execute function public.crm_touch_updated_at();

create trigger crm_tasks_touch_updated_at
before update on public.crm_tasks
for each row execute function public.crm_touch_updated_at();

alter table public.crm_organizations enable row level security;
alter table public.crm_organization_members enable row level security;
alter table public.crm_contacts enable row level security;
alter table public.crm_leads enable row level security;
alter table public.crm_activities enable row level security;
alter table public.crm_notes enable row level security;
alter table public.crm_tasks enable row level security;

create policy crm_organizations_select on public.crm_organizations
for select to authenticated using (public.crm_is_org_member(id));

create policy crm_members_select on public.crm_organization_members
for select to authenticated using (
  user_id = auth.uid() or public.crm_is_org_manager(organization_id)
);

create policy crm_contacts_select on public.crm_contacts
for select to authenticated using (public.crm_is_org_member(organization_id));

create policy crm_leads_select on public.crm_leads
for select to authenticated using (public.crm_is_org_member(organization_id));

create policy crm_activities_select on public.crm_activities
for select to authenticated using (public.crm_is_org_member(organization_id));

create policy crm_notes_select on public.crm_notes
for select to authenticated using (public.crm_is_org_member(organization_id));

create policy crm_notes_insert_human on public.crm_notes
for insert to authenticated with check (
  author_id = auth.uid()
  and public.crm_can_operate_org(organization_id)
  and exists (
    select 1 from public.crm_leads l
    where l.id = lead_id
      and l.organization_id = organization_id
      and l.authority = 'HUMAN'
  )
);

create policy crm_notes_update_human on public.crm_notes
for update to authenticated
using (author_id = auth.uid() and public.crm_can_operate_org(organization_id))
with check (
  author_id = auth.uid()
  and public.crm_can_operate_org(organization_id)
  and exists (
    select 1 from public.crm_leads l
    where l.id = lead_id
      and l.organization_id = organization_id
      and l.authority = 'HUMAN'
  )
);

create policy crm_tasks_select on public.crm_tasks
for select to authenticated using (public.crm_is_org_member(organization_id));

create policy crm_tasks_insert_human on public.crm_tasks
for insert to authenticated with check (
  created_by = auth.uid()
  and public.crm_can_operate_org(organization_id)
  and exists (
    select 1 from public.crm_organization_members m
    where m.organization_id = organization_id
      and m.user_id = assigned_to
      and m.active
      and m.role in ('OWNER', 'MANAGER', 'SELLER')
  )
  and exists (
    select 1 from public.crm_leads l
    where l.id = lead_id
      and l.organization_id = organization_id
      and l.authority = 'HUMAN'
  )
);

create policy crm_tasks_update_human on public.crm_tasks
for update to authenticated
using (public.crm_can_operate_org(organization_id))
with check (
  public.crm_can_operate_org(organization_id)
  and exists (
    select 1 from public.crm_organization_members m
    where m.organization_id = organization_id
      and m.user_id = assigned_to
      and m.active
      and m.role in ('OWNER', 'MANAGER', 'SELLER')
  )
  and exists (
    select 1 from public.crm_leads l
    where l.id = lead_id
      and l.organization_id = organization_id
      and l.authority = 'HUMAN'
  )
);

create or replace function public.crm_take_human_lead(p_lead_id uuid, p_reason text default null)
returns public.crm_leads
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_lead public.crm_leads;
begin
  select * into v_lead from public.crm_leads where id = p_lead_id for update;
  if not found or not public.crm_can_operate_org(v_lead.organization_id) then
    raise exception 'CRM_LEAD_NOT_AVAILABLE';
  end if;
  if v_lead.authority = 'HUMAN' then
    raise exception 'CRM_LEAD_ALREADY_HUMAN';
  end if;

  update public.crm_leads
  set authority = 'HUMAN',
      previous_ai_stage = stage,
      stage = 'HUMAN_NEW',
      assigned_to = auth.uid(),
      human_taken_at = now(),
      human_taken_by = auth.uid(),
      version = version + 1,
      updated_at = now()
  where id = p_lead_id
  returning * into v_lead;

  insert into public.crm_activities(
    organization_id, lead_id, actor_type, actor_user_id, event_type, from_stage, to_stage, payload
  ) values (
    v_lead.organization_id, v_lead.id, 'HUMAN', auth.uid(), 'HUMAN_TAKEOVER',
    v_lead.previous_ai_stage, v_lead.stage, jsonb_build_object('reason', p_reason)
  );

  return v_lead;
end;
$$;

create or replace function public.crm_move_human_lead(
  p_lead_id uuid,
  p_next_stage public.crm_lead_stage,
  p_reason text default null
)
returns public.crm_leads
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_lead public.crm_leads;
  v_from public.crm_lead_stage;
begin
  if p_next_stage not in (
    'HUMAN_NEW', 'HUMAN_CONTACTING', 'HUMAN_PROPOSAL', 'HUMAN_NEGOTIATION',
    'WON', 'LOST', 'DO_NOT_CONTACT'
  ) then
    raise exception 'CRM_HUMAN_STAGE_REQUIRED';
  end if;

  select * into v_lead from public.crm_leads where id = p_lead_id for update;
  if not found or not public.crm_can_operate_org(v_lead.organization_id) then
    raise exception 'CRM_LEAD_NOT_AVAILABLE';
  end if;
  if v_lead.authority <> 'HUMAN' then
    raise exception 'CRM_HUMAN_AUTHORITY_REQUIRED';
  end if;
  if v_lead.stage in ('WON', 'LOST', 'DO_NOT_CONTACT') and v_lead.stage <> p_next_stage then
    raise exception 'CRM_TERMINAL_STAGE';
  end if;
  if v_lead.stage = p_next_stage then
    return v_lead;
  end if;

  v_from := v_lead.stage;
  update public.crm_leads
  set stage = p_next_stage,
      closed_at = case when p_next_stage in ('WON', 'LOST', 'DO_NOT_CONTACT') then now() else null end,
      version = version + 1,
      updated_at = now()
  where id = p_lead_id
  returning * into v_lead;

  insert into public.crm_activities(
    organization_id, lead_id, actor_type, actor_user_id, event_type, from_stage, to_stage, payload
  ) values (
    v_lead.organization_id, v_lead.id, 'HUMAN', auth.uid(), 'HUMAN_STAGE_CHANGED',
    v_from, v_lead.stage, jsonb_build_object('reason', p_reason)
  );

  return v_lead;
end;
$$;

create or replace function public.crm_return_lead_to_ai(p_lead_id uuid, p_reason text)
returns public.crm_leads
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_lead public.crm_leads;
  v_from public.crm_lead_stage;
  v_restore public.crm_lead_stage;
begin
  select * into v_lead from public.crm_leads where id = p_lead_id for update;
  if not found or not public.crm_can_operate_org(v_lead.organization_id) then
    raise exception 'CRM_LEAD_NOT_AVAILABLE';
  end if;
  if v_lead.authority <> 'HUMAN' or v_lead.stage in ('WON', 'LOST', 'DO_NOT_CONTACT') then
    raise exception 'CRM_RETURN_TO_AI_FORBIDDEN';
  end if;
  if p_reason is null or length(trim(p_reason)) < 3 then
    raise exception 'CRM_RETURN_REASON_REQUIRED';
  end if;

  v_from := v_lead.stage;
  v_restore := coalesce(v_lead.previous_ai_stage, 'AI_QUALIFYING');

  update public.crm_leads
  set authority = 'AI',
      stage = v_restore,
      assigned_to = null,
      human_taken_at = null,
      human_taken_by = null,
      version = version + 1,
      updated_at = now()
  where id = p_lead_id
  returning * into v_lead;

  insert into public.crm_activities(
    organization_id, lead_id, actor_type, actor_user_id, event_type, from_stage, to_stage, payload
  ) values (
    v_lead.organization_id, v_lead.id, 'HUMAN', auth.uid(), 'RETURNED_TO_AI',
    v_from, v_lead.stage, jsonb_build_object('reason', p_reason)
  );

  return v_lead;
end;
$$;

create or replace function public.crm_agent_move_lead(
  p_lead_id uuid,
  p_next_stage public.crm_lead_stage,
  p_context jsonb default '{}'::jsonb
)
returns public.crm_leads
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_lead public.crm_leads;
  v_from public.crm_lead_stage;
  v_allowed boolean;
begin
  select * into v_lead from public.crm_leads where id = p_lead_id for update;
  if not found then raise exception 'CRM_LEAD_NOT_AVAILABLE'; end if;
  if v_lead.authority <> 'AI' then raise exception 'CRM_AI_BLOCKED_BY_HUMAN'; end if;
  if v_lead.stage = p_next_stage then return v_lead; end if;

  v_allowed := (
    (v_lead.stage = 'AI_NEW' and p_next_stage = 'AI_QUALIFYING')
    or (v_lead.stage = 'AI_QUALIFYING' and p_next_stage = 'AI_QUALIFIED')
    or (v_lead.stage = 'AI_QUALIFIED' and p_next_stage = 'AI_CALL_REQUESTED')
  );
  if not v_allowed then raise exception 'CRM_AI_TRANSITION_FORBIDDEN'; end if;

  v_from := v_lead.stage;
  update public.crm_leads
  set stage = p_next_stage, version = version + 1, updated_at = now()
  where id = p_lead_id
  returning * into v_lead;

  insert into public.crm_activities(
    organization_id, lead_id, actor_type, event_type, from_stage, to_stage, payload
  ) values (
    v_lead.organization_id, v_lead.id, 'AI', 'AI_STAGE_CHANGED', v_from, v_lead.stage, p_context
  );
  return v_lead;
end;
$$;

revoke all on public.crm_organizations from anon, authenticated;
revoke all on public.crm_organization_members from anon, authenticated;
revoke all on public.crm_contacts from anon, authenticated;
revoke all on public.crm_leads from anon, authenticated;
revoke all on public.crm_activities from anon, authenticated;
revoke all on public.crm_notes from anon, authenticated;
revoke all on public.crm_tasks from anon, authenticated;

grant select on public.crm_organizations to authenticated;
grant select on public.crm_organization_members to authenticated;
grant select on public.crm_contacts to authenticated;
grant select on public.crm_leads to authenticated;
grant select on public.crm_activities to authenticated;
grant select on public.crm_notes to authenticated;
grant insert (organization_id, lead_id, author_id, body) on public.crm_notes to authenticated;
grant update (body) on public.crm_notes to authenticated;
grant select on public.crm_tasks to authenticated;
grant insert (organization_id, lead_id, assigned_to, created_by, title, due_at, status)
  on public.crm_tasks to authenticated;
grant update (assigned_to, title, due_at, status) on public.crm_tasks to authenticated;

revoke all on function public.crm_is_org_member(uuid) from public, anon;
revoke all on function public.crm_is_org_manager(uuid) from public, anon;
revoke all on function public.crm_can_operate_org(uuid) from public, anon;
revoke all on function public.crm_touch_updated_at() from public, anon;

grant execute on function public.crm_is_org_member(uuid) to authenticated;
grant execute on function public.crm_is_org_manager(uuid) to authenticated;
grant execute on function public.crm_can_operate_org(uuid) to authenticated;

revoke execute on function public.crm_take_human_lead(uuid, text) from public, anon;
revoke execute on function public.crm_move_human_lead(uuid, public.crm_lead_stage, text) from public, anon;
revoke execute on function public.crm_return_lead_to_ai(uuid, text) from public, anon;
revoke execute on function public.crm_agent_move_lead(uuid, public.crm_lead_stage, jsonb) from public, anon, authenticated;

grant execute on function public.crm_take_human_lead(uuid, text) to authenticated;
grant execute on function public.crm_move_human_lead(uuid, public.crm_lead_stage, text) to authenticated;
grant execute on function public.crm_return_lead_to_ai(uuid, text) to authenticated;
grant execute on function public.crm_agent_move_lead(uuid, public.crm_lead_stage, jsonb) to service_role;
