-- Editable presentation for the two CRM boards. Technical keys and stage
-- semantics stay immutable; owners may only change labels, colors and order.

create table public.crm_board_columns (
  organization_id uuid not null references public.crm_organizations(id) on delete cascade,
  board text not null check (board in ('LUCAS', 'SALES')),
  column_key text not null,
  stage_keys public.crm_lead_stage[] not null,
  label text not null check (length(trim(label)) between 1 and 48),
  color text not null check (color ~ '^#[0-9A-Fa-f]{6}$'),
  position integer not null check (position between 0 and 20),
  is_base boolean not null default true,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  primary key (organization_id, board, column_key),
  constraint crm_board_columns_position_unique
    unique (organization_id, board, position) deferrable initially immediate
);

create or replace function public.crm_seed_board_columns(p_organization_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  insert into public.crm_board_columns(
    organization_id, board, column_key, stage_keys, label, color, position, is_base
  ) values
    (p_organization_id, 'LUCAS', 'LUCAS_INBOX', array['AI_NEW']::public.crm_lead_stage[], 'Lead entrante', '#5F8F73', 0, true),
    (p_organization_id, 'LUCAS', 'LUCAS_QUALIFYING', array['AI_QUALIFYING','AI_QUALIFIED']::public.crm_lead_stage[], 'Calificando', '#B69052', 1, true),
    (p_organization_id, 'LUCAS', 'LUCAS_READY', array['AI_CALL_REQUESTED']::public.crm_lead_stage[], 'Listo para llamada', '#6E8FBA', 2, true),
    (p_organization_id, 'SALES', 'SALES_INBOX', array['HUMAN_NEW']::public.crm_lead_stage[], 'Lead entrante', '#6E8FBA', 0, true),
    (p_organization_id, 'SALES', 'SALES_CONTACTED', array['HUMAN_CONTACTING']::public.crm_lead_stage[], 'Contactado', '#8C7DB5', 1, true),
    (p_organization_id, 'SALES', 'SALES_MANAGING', array['HUMAN_PROPOSAL','HUMAN_NEGOTIATION']::public.crm_lead_stage[], 'En gestión', '#B69052', 2, true),
    (p_organization_id, 'SALES', 'SALES_WON', array['WON']::public.crm_lead_stage[], 'Ganado', '#5F9F78', 3, true),
    (p_organization_id, 'SALES', 'SALES_LOST', array['LOST','DO_NOT_CONTACT']::public.crm_lead_stage[], 'Perdido', '#9B6969', 4, true)
  on conflict (organization_id, board, column_key) do nothing;
end;
$$;

create or replace function public.crm_seed_board_columns_after_org()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform public.crm_seed_board_columns(new.id);
  return new;
end;
$$;

create trigger crm_seed_board_columns_after_org
after insert on public.crm_organizations
for each row execute function public.crm_seed_board_columns_after_org();

select public.crm_seed_board_columns(id) from public.crm_organizations;

create or replace function public.crm_protect_board_column_identity()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    if old.is_base then raise exception 'CRM_BASE_COLUMN_DELETE_FORBIDDEN'; end if;
    return old;
  end if;
  if new.organization_id <> old.organization_id
     or new.board <> old.board
     or new.column_key <> old.column_key
     or new.stage_keys <> old.stage_keys
     or new.is_base <> old.is_base
  then raise exception 'CRM_COLUMN_IDENTITY_IMMUTABLE'; end if;
  return new;
end;
$$;

create trigger crm_protect_board_column_identity
before update or delete on public.crm_board_columns
for each row execute function public.crm_protect_board_column_identity();

alter table public.crm_board_columns enable row level security;
create policy crm_board_columns_select on public.crm_board_columns
for select to authenticated using (public.crm_is_org_member(organization_id));

create or replace function public.crm_update_board_columns(
  p_organization_id uuid, p_board text, p_columns jsonb
)
returns setof public.crm_board_columns
language plpgsql security definer set search_path = '' as $$
declare
  v_expected integer; v_received integer; v_distinct_keys integer;
  v_distinct_positions integer; v_min_position integer; v_max_position integer;
begin
  if p_board not in ('LUCAS', 'SALES') then raise exception 'CRM_BOARD_INVALID'; end if;
  if not public.crm_is_org_manager(p_organization_id) then raise exception 'CRM_BOARD_MANAGER_REQUIRED'; end if;
  if jsonb_typeof(p_columns) <> 'array' then raise exception 'CRM_BOARD_COLUMNS_INVALID'; end if;

  select count(*) into v_expected from public.crm_board_columns
  where organization_id = p_organization_id and board = p_board;
  select count(*), count(distinct x.column_key), count(distinct x.position), min(x.position), max(x.position)
  into v_received, v_distinct_keys, v_distinct_positions, v_min_position, v_max_position
  from jsonb_to_recordset(p_columns) as x(column_key text, label text, color text, position integer);

  if v_received <> v_expected or v_distinct_keys <> v_expected or v_distinct_positions <> v_expected
     or v_min_position <> 0 or v_max_position <> v_expected - 1
  then raise exception 'CRM_BOARD_COLUMN_SET_INVALID'; end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_columns) as x(column_key text, label text, color text, position integer)
    left join public.crm_board_columns c on c.organization_id = p_organization_id
      and c.board = p_board and c.column_key = x.column_key
    where c.column_key is null or length(trim(coalesce(x.label, ''))) not between 1 and 48
      or coalesce(x.color, '') !~ '^#[0-9A-Fa-f]{6}$'
  ) then raise exception 'CRM_BOARD_COLUMN_VALUE_INVALID'; end if;

  set constraints crm_board_columns_position_unique deferred;
  update public.crm_board_columns c
  set label = trim(x.label), color = upper(x.color), position = x.position,
      updated_at = now(), updated_by = auth.uid()
  from jsonb_to_recordset(p_columns) as x(column_key text, label text, color text, position integer)
  where c.organization_id = p_organization_id and c.board = p_board and c.column_key = x.column_key;

  return query select * from public.crm_board_columns
    where organization_id = p_organization_id and board = p_board order by position;
end;
$$;

revoke all on public.crm_board_columns from anon, authenticated;
grant select on public.crm_board_columns to authenticated;
revoke all on function public.crm_seed_board_columns(uuid) from public, anon, authenticated;
revoke all on function public.crm_seed_board_columns_after_org() from public, anon, authenticated;
revoke all on function public.crm_protect_board_column_identity() from public, anon, authenticated;
revoke all on function public.crm_update_board_columns(uuid, text, jsonb) from public, anon;
grant execute on function public.crm_update_board_columns(uuid, text, jsonb) to authenticated;
