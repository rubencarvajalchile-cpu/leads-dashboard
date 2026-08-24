-- Synchronize eligible Proyecta leads from the legacy n8n table into the CRM.
-- The legacy table remains authoritative for the AI funnel. CRM rows become
-- human-editable only after an explicit legacy takeover or crm_take_human_lead.

create unique index if not exists crm_leads_org_contact_idx
on public.crm_leads(organization_id, contact_id);

create or replace function public.crm_sync_proyecta_legacy_lead(p_legacy_id bigint)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_legacy public."clientes agente test"%rowtype;
  v_organization_id uuid;
  v_owner_id uuid;
  v_contact_id uuid;
  v_lead public.crm_leads;
  v_phone_digits text;
  v_phone_e164 text;
  v_explicit_human boolean;
  v_call_requested boolean;
  v_target_authority public.crm_authority;
  v_target_stage public.crm_lead_stage;
  v_previous_ai_stage public.crm_lead_stage;
  v_priority public.crm_priority;
begin
  select * into v_legacy
  from public."clientes agente test"
  where id = p_legacy_id;

  if not found then
    return null;
  end if;

  v_explicit_human := coalesce(v_legacy.trava, false)
    or lower(coalesce(v_legacy.derivacion, '')) like '%ejecutivo_humano%';
  v_call_requested := coalesce(v_legacy.acepta_llamada, false);

  if not (v_explicit_human or v_call_requested) then
    return null;
  end if;

  select id into v_organization_id
  from public.crm_organizations
  where slug = 'proyecta-energia';

  if v_organization_id is null then
    raise exception 'CRM_PROYECTA_ORGANIZATION_MISSING';
  end if;

  select user_id into v_owner_id
  from public.crm_organization_members
  where organization_id = v_organization_id
    and role = 'OWNER'
    and active
  order by created_at
  limit 1;

  v_phone_digits := regexp_replace(coalesce(v_legacy.telefone, ''), '[^0-9]', '', 'g');
  v_phone_e164 := case
    when length(v_phone_digits) not between 8 and 15 then null
    when trim(coalesce(v_legacy.telefone, '')) like '+%' then '+' || v_phone_digits
    when v_phone_digits like '56%' then '+' || v_phone_digits
    when length(v_phone_digits) = 9 and v_phone_digits like '9%' then '+56' || v_phone_digits
    else null
  end;

  select id into v_contact_id
  from public.crm_contacts
  where organization_id = v_organization_id
    and legacy_table = 'clientes agente test'
    and legacy_id = v_legacy.id
  for update;

  if v_contact_id is null and v_phone_e164 is not null then
    select id into v_contact_id
    from public.crm_contacts
    where organization_id = v_organization_id
      and phone_e164 = v_phone_e164
    for update;
  end if;

  if v_contact_id is null then
    insert into public.crm_contacts(
      organization_id, name, phone_e164, source, legacy_table, legacy_id, created_at, updated_at
    ) values (
      v_organization_id,
      coalesce(nullif(trim(v_legacy.nome), ''), 'Contacto sin nombre'),
      v_phone_e164,
      'N8N_PROYECTA',
      'clientes agente test',
      v_legacy.id,
      coalesce(v_legacy.created_at, now()),
      coalesce(v_legacy.updated_at, now())
    ) returning id into v_contact_id;
  else
    update public.crm_contacts
    set name = coalesce(nullif(trim(v_legacy.nome), ''), name),
        phone_e164 = coalesce(v_phone_e164, phone_e164),
        source = case when source = 'CRM_PREVIEW' then 'N8N_PROYECTA' else coalesce(source, 'N8N_PROYECTA') end,
        legacy_table = coalesce(legacy_table, 'clientes agente test'),
        legacy_id = coalesce(legacy_id, v_legacy.id)
    where id = v_contact_id;
  end if;

  v_target_authority := case when v_explicit_human then 'HUMAN' else 'AI' end;
  v_target_stage := case when v_explicit_human then 'HUMAN_NEW' else 'AI_CALL_REQUESTED' end;
  v_previous_ai_stage := case
    when v_call_requested then 'AI_CALL_REQUESTED'
    when coalesce(v_legacy.califica, false) then 'AI_QUALIFIED'
    else 'AI_QUALIFYING'
  end;
  v_priority := case when v_explicit_human then 'P1' else 'P2' end;

  select * into v_lead
  from public.crm_leads
  where organization_id = v_organization_id
    and contact_id = v_contact_id
  for update;

  if not found then
    insert into public.crm_leads(
      organization_id,
      contact_id,
      authority,
      stage,
      previous_ai_stage,
      assigned_to,
      product_interest,
      qualification_status,
      priority,
      human_taken_at,
      human_taken_by,
      created_at,
      updated_at
    ) values (
      v_organization_id,
      v_contact_id,
      v_target_authority,
      v_target_stage,
      case when v_explicit_human then v_previous_ai_stage else null end,
      case when v_explicit_human then v_owner_id else null end,
      nullif(trim(v_legacy.product_interes), ''),
      case when v_legacy.califica is true then 'QUALIFIED'
           when v_legacy.califica is false then 'NOT_QUALIFIED'
           else 'PENDING' end,
      v_priority,
      case when v_explicit_human then coalesce(v_legacy.updated_at, now()) else null end,
      case when v_explicit_human then v_owner_id else null end,
      coalesce(v_legacy.created_at, now()),
      coalesce(v_legacy.updated_at, now())
    ) returning * into v_lead;
  else
    update public.crm_leads
    set authority = case when v_lead.authority = 'HUMAN' then v_lead.authority else v_target_authority end,
        stage = case when v_lead.authority = 'HUMAN' then v_lead.stage else v_target_stage end,
        previous_ai_stage = case
          when v_lead.authority = 'HUMAN' then v_lead.previous_ai_stage
          when v_explicit_human then coalesce(v_lead.previous_ai_stage, v_previous_ai_stage)
          else v_lead.previous_ai_stage
        end,
        assigned_to = case when v_lead.authority = 'HUMAN' or v_explicit_human
          then coalesce(v_lead.assigned_to, v_owner_id) else v_lead.assigned_to end,
        product_interest = coalesce(nullif(trim(v_legacy.product_interes), ''), v_lead.product_interest),
        qualification_status = case when v_legacy.califica is true then 'QUALIFIED'
          when v_legacy.califica is false then 'NOT_QUALIFIED'
          else v_lead.qualification_status end,
        priority = case when v_lead.authority = 'HUMAN' then v_lead.priority else v_priority end,
        human_taken_at = case when v_lead.authority = 'HUMAN' or v_explicit_human
          then coalesce(v_lead.human_taken_at, v_legacy.updated_at, now()) else null end,
        human_taken_by = case when v_lead.authority = 'HUMAN' or v_explicit_human
          then coalesce(v_lead.human_taken_by, v_owner_id) else null end,
        version = v_lead.version + 1,
        updated_at = greatest(v_lead.updated_at, coalesce(v_legacy.updated_at, now()))
    where id = v_lead.id
    returning * into v_lead;
  end if;

  insert into public.crm_activities(
    organization_id, lead_id, actor_type, event_type, from_stage, to_stage, payload
  )
  select
    v_organization_id,
    v_lead.id,
    'SYSTEM',
    'LEGACY_IMPORTED',
    null,
    v_lead.stage,
    jsonb_build_object(
      'legacy_table', 'clientes agente test',
      'legacy_id', v_legacy.id,
      'explicit_human', v_explicit_human,
      'call_requested', v_call_requested
    )
  where not exists (
    select 1
    from public.crm_activities a
    where a.lead_id = v_lead.id
      and a.event_type = 'LEGACY_IMPORTED'
  );

  return v_lead.id;
end;
$$;

create or replace function public.crm_sync_proyecta_legacy_human_leads()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row record;
  v_eligible bigint := 0;
  v_synced bigint := 0;
begin
  for v_row in
    select id
    from public."clientes agente test"
    where coalesce(acepta_llamada, false)
       or coalesce(trava, false)
       or lower(coalesce(derivacion, '')) like '%ejecutivo_humano%'
    order by id
  loop
    v_eligible := v_eligible + 1;
    if public.crm_sync_proyecta_legacy_lead(v_row.id) is not null then
      v_synced := v_synced + 1;
    end if;
  end loop;

  return jsonb_build_object('eligible', v_eligible, 'synced', v_synced);
end;
$$;

create or replace function public.crm_sync_proyecta_legacy_trigger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(new.acepta_llamada, false)
     or coalesce(new.trava, false)
     or lower(coalesce(new.derivacion, '')) like '%ejecutivo_humano%'
  then
    perform public.crm_sync_proyecta_legacy_lead(new.id);
  end if;
  return new;
exception
  when others then
    raise warning 'CRM_LEGACY_SYNC_FAILED legacy_id=% sqlstate=%', new.id, sqlstate;
    return new;
end;
$$;

drop trigger if exists crm_sync_proyecta_legacy_after_write on public."clientes agente test";
create trigger crm_sync_proyecta_legacy_after_write
after insert or update of
  nome, telefone, trava, product_interes, califica, acepta_llamada,
  estado, fase, derivacion, updated_at
on public."clientes agente test"
for each row execute function public.crm_sync_proyecta_legacy_trigger();

revoke all on function public.crm_sync_proyecta_legacy_lead(bigint) from public, anon, authenticated;
revoke all on function public.crm_sync_proyecta_legacy_human_leads() from public, anon, authenticated;
revoke all on function public.crm_sync_proyecta_legacy_trigger() from public, anon, authenticated;
grant execute on function public.crm_sync_proyecta_legacy_lead(bigint) to service_role;
grant execute on function public.crm_sync_proyecta_legacy_human_leads() to service_role;

-- Remove only the two disposable preview rows before importing real records.
delete from public.crm_contacts
where source = 'CRM_PREVIEW'
  and legacy_table = 'crm_preview';

select public.crm_sync_proyecta_legacy_human_leads();
