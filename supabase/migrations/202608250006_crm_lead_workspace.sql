-- First operational CRM workspace: explicit, idempotent proof of human contact.
-- Notes and tasks already exist; these indexes make the lead workspace fast.

create index if not exists crm_notes_lead_created_idx
on public.crm_notes(lead_id, created_at desc);

create index if not exists crm_tasks_lead_status_due_idx
on public.crm_tasks(lead_id, status, due_at asc nulls last);

create unique index if not exists crm_human_contact_operation_idx
on public.crm_activities(lead_id, (payload ->> 'operation_id'))
where event_type = 'HUMAN_CONTACT_RECORDED';

create or replace function public.crm_record_human_contact(
  p_lead_id uuid,
  p_operation_id uuid,
  p_channel text default 'WHATSAPP',
  p_note text default null
)
returns public.crm_leads
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_lead public.crm_leads;
  v_from public.crm_lead_stage;
  v_note text;
begin
  if p_channel not in ('WHATSAPP', 'LLAMADA', 'OTRO') then
    raise exception 'CRM_CONTACT_CHANNEL_INVALID';
  end if;
  v_note := nullif(trim(coalesce(p_note, '')), '');
  if p_note is not null and v_note is null then
    raise exception 'CRM_CONTACT_NOTE_INVALID';
  end if;
  if v_note is not null and length(v_note) > 4000 then
    raise exception 'CRM_CONTACT_NOTE_TOO_LONG';
  end if;

  select * into v_lead from public.crm_leads where id = p_lead_id for update;
  if not found or not public.crm_can_operate_org(v_lead.organization_id) then
    raise exception 'CRM_LEAD_NOT_AVAILABLE';
  end if;
  if v_lead.authority <> 'HUMAN' then
    raise exception 'CRM_HUMAN_AUTHORITY_REQUIRED';
  end if;
  if v_lead.stage in ('WON', 'LOST', 'DO_NOT_CONTACT') then
    raise exception 'CRM_TERMINAL_STAGE';
  end if;

  if exists (
    select 1 from public.crm_activities
    where lead_id = v_lead.id
      and event_type = 'HUMAN_CONTACT_RECORDED'
      and payload ->> 'operation_id' = p_operation_id::text
  ) then
    return v_lead;
  end if;

  v_from := v_lead.stage;
  if v_lead.stage = 'HUMAN_NEW' then
    update public.crm_leads
    set stage = 'HUMAN_CONTACTING', version = version + 1, updated_at = now()
    where id = v_lead.id
    returning * into v_lead;
  end if;

  if v_note is not null then
    insert into public.crm_notes(organization_id, lead_id, author_id, body)
    values (v_lead.organization_id, v_lead.id, auth.uid(), v_note);
  end if;

  insert into public.crm_activities(
    organization_id, lead_id, actor_type, actor_user_id, event_type, from_stage, to_stage, payload
  ) values (
    v_lead.organization_id, v_lead.id, 'HUMAN', auth.uid(), 'HUMAN_CONTACT_RECORDED',
    v_from, v_lead.stage,
    jsonb_build_object('operation_id', p_operation_id, 'channel', p_channel, 'note_recorded', v_note is not null)
  );

  return v_lead;
end;
$$;

revoke execute on function public.crm_record_human_contact(uuid, uuid, text, text) from public, anon;
grant execute on function public.crm_record_human_contact(uuid, uuid, text, text) to authenticated;
