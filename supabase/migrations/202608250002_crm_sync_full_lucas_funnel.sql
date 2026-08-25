-- Feed every WhatsApp lead to Lucas. The verified handoff path remains the
-- authority for call requests and explicit human takeovers.

create or replace function public.crm_sync_proyecta_full_lead(p_legacy_id bigint)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_legacy public."clientes agente test"%rowtype;
  v_organization_id uuid; v_contact_id uuid; v_lead public.crm_leads;
  v_phone_digits text; v_phone_e164 text; v_target_stage public.crm_lead_stage;
begin
  select * into v_legacy from public."clientes agente test" where id = p_legacy_id;
  if not found then return null; end if;

  if coalesce(v_legacy.acepta_llamada, false) or coalesce(v_legacy.trava, false)
     or lower(coalesce(v_legacy.derivacion, '')) like '%ejecutivo_humano%'
  then return public.crm_sync_proyecta_legacy_lead(p_legacy_id); end if;

  select id into v_organization_id from public.crm_organizations where slug = 'proyecta-energia';
  if v_organization_id is null then raise exception 'CRM_PROYECTA_ORGANIZATION_MISSING'; end if;

  v_phone_digits := regexp_replace(coalesce(v_legacy.telefone, ''), '[^0-9]', '', 'g');
  v_phone_e164 := case
    when length(v_phone_digits) not between 8 and 15 then null
    when trim(coalesce(v_legacy.telefone, '')) like '+%' then '+' || v_phone_digits
    when v_phone_digits like '56%' then '+' || v_phone_digits
    when length(v_phone_digits) = 9 and v_phone_digits like '9%' then '+56' || v_phone_digits
    else null end;

  select id into v_contact_id from public.crm_contacts
  where organization_id = v_organization_id and legacy_table = 'clientes agente test'
    and legacy_id = v_legacy.id for update;
  if v_contact_id is null and v_phone_e164 is not null then
    select id into v_contact_id from public.crm_contacts
    where organization_id = v_organization_id and phone_e164 = v_phone_e164 for update;
  end if;

  if v_contact_id is null then
    insert into public.crm_contacts(
      organization_id, name, phone_e164, source, legacy_table, legacy_id, created_at, updated_at
    ) values (
      v_organization_id, coalesce(nullif(trim(v_legacy.nome), ''), 'Contacto sin nombre'),
      v_phone_e164, 'N8N_PROYECTA', 'clientes agente test', v_legacy.id,
      coalesce(v_legacy.created_at, now()), coalesce(v_legacy.updated_at, now())
    ) returning id into v_contact_id;
  else
    update public.crm_contacts set
      name = coalesce(nullif(trim(v_legacy.nome), ''), name),
      phone_e164 = coalesce(v_phone_e164, phone_e164),
      source = coalesce(source, 'N8N_PROYECTA'),
      legacy_table = coalesce(legacy_table, 'clientes agente test'),
      legacy_id = coalesce(legacy_id, v_legacy.id)
    where id = v_contact_id;
  end if;

  v_target_stage := case
    when coalesce(v_legacy.califica, false) then 'AI_QUALIFIED'::public.crm_lead_stage
    when nullif(trim(coalesce(v_legacy.estado, '')), '') is not null
      or nullif(trim(coalesce(v_legacy.fase, '')), '') is not null
      or nullif(trim(coalesce(v_legacy.product_interes, '')), '') is not null
      then 'AI_QUALIFYING'::public.crm_lead_stage
    else 'AI_NEW'::public.crm_lead_stage end;

  select * into v_lead from public.crm_leads
  where organization_id = v_organization_id and contact_id = v_contact_id for update;

  if not found then
    insert into public.crm_leads(
      organization_id, contact_id, authority, stage, product_interest,
      qualification_status, priority, created_at, updated_at
    ) values (
      v_organization_id, v_contact_id, 'AI', v_target_stage,
      nullif(trim(v_legacy.product_interes), ''),
      case when v_legacy.califica is true then 'QUALIFIED'
           when v_legacy.califica is false then 'NOT_QUALIFIED' else 'PENDING' end,
      'P3', coalesce(v_legacy.created_at, now()), coalesce(v_legacy.updated_at, now())
    ) returning * into v_lead;
  elsif v_lead.authority = 'AI' then
    update public.crm_leads set
      stage = case
        when v_lead.stage = 'AI_CALL_REQUESTED' then v_lead.stage
        when v_lead.stage = 'AI_QUALIFIED' and v_target_stage in ('AI_NEW', 'AI_QUALIFYING') then v_lead.stage
        when v_lead.stage = 'AI_QUALIFYING' and v_target_stage = 'AI_NEW' then v_lead.stage
        else v_target_stage end,
      product_interest = coalesce(nullif(trim(v_legacy.product_interes), ''), v_lead.product_interest),
      qualification_status = case when v_legacy.califica is true then 'QUALIFIED'
        when v_legacy.califica is false then 'NOT_QUALIFIED' else v_lead.qualification_status end,
      version = v_lead.version + 1,
      updated_at = greatest(v_lead.updated_at, coalesce(v_legacy.updated_at, now()))
    where id = v_lead.id returning * into v_lead;
  end if;

  insert into public.crm_activities(organization_id, lead_id, actor_type, event_type, from_stage, to_stage, payload)
  select v_organization_id, v_lead.id, 'SYSTEM', 'LEGACY_IMPORTED', null, v_lead.stage,
    jsonb_build_object('legacy_table', 'clientes agente test', 'legacy_id', v_legacy.id)
  where not exists (
    select 1 from public.crm_activities a where a.lead_id = v_lead.id and a.event_type = 'LEGACY_IMPORTED'
  );
  return v_lead.id;
end;
$$;

create or replace function public.crm_sync_proyecta_full_funnel()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_row record; v_total bigint := 0; v_synced bigint := 0;
begin
  for v_row in select id from public."clientes agente test" order by id loop
    v_total := v_total + 1;
    if public.crm_sync_proyecta_full_lead(v_row.id) is not null then v_synced := v_synced + 1; end if;
  end loop;
  return jsonb_build_object('total', v_total, 'synced', v_synced);
end;
$$;

create or replace function public.crm_sync_proyecta_legacy_trigger()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform public.crm_sync_proyecta_full_lead(new.id);
  return new;
exception when others then
  raise warning 'CRM_LEGACY_SYNC_FAILED legacy_id=% sqlstate=%', new.id, sqlstate;
  return new;
end;
$$;

revoke all on function public.crm_sync_proyecta_full_lead(bigint) from public, anon, authenticated;
revoke all on function public.crm_sync_proyecta_full_funnel() from public, anon, authenticated;
grant execute on function public.crm_sync_proyecta_full_lead(bigint) to service_role;
grant execute on function public.crm_sync_proyecta_full_funnel() to service_role;
select public.crm_sync_proyecta_full_funnel();
