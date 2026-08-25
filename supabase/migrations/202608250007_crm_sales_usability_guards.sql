-- Sales usability: a seller must leave evidence before calling a lead contacted.
-- Existing customized column labels are never overwritten.

update public.crm_board_columns
set label = 'Derivado a humano · sin contacto'
where board = 'SALES'
  and column_key = 'SALES_TAKEN'
  and label = 'Tomado · pendiente de contacto';

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

  -- HUMAN_NEW is a derivation, not proof that a seller interacted with the client.
  -- The only path to an active sales stage is crm_record_human_contact.
  if v_lead.stage = 'HUMAN_NEW'
    and p_next_stage in ('HUMAN_CONTACTING', 'HUMAN_PROPOSAL', 'HUMAN_NEGOTIATION', 'WON') then
    raise exception 'CRM_CONTACT_EVIDENCE_REQUIRED';
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
