-- Expose Lucas' commercial facts to authenticated CRM members without giving
-- the browser direct access to the legacy n8n table.

create or replace function public.crm_get_lead_commercial_profile(p_lead_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_organization_id uuid;
  v_legacy_table text;
  v_legacy_id bigint;
  v_profile jsonb;
begin
  select l.organization_id, c.legacy_table, c.legacy_id
  into v_organization_id, v_legacy_table, v_legacy_id
  from public.crm_leads l
  join public.crm_contacts c on c.id = l.contact_id
  where l.id = p_lead_id;

  if v_organization_id is null or not public.crm_is_org_member(v_organization_id) then
    raise exception 'CRM_LEAD_NOT_AVAILABLE';
  end if;

  if v_legacy_table = 'clientes agente test' and v_legacy_id is not null then
    select jsonb_build_object(
      'interested', source.interessado,
      'commune', source.comuna,
      'monthlyConsumptionClp', source.consumo_clp,
      'consumptionRange', source.consumo_rango,
      'qualified', source.califica,
      'owner', source.propietario,
      'roofType', source.tipo_techo,
      'homeType', source.tipo_vivienda,
      'acceptsCall', source.acepta_llamada,
      'urgency', source.urgencia,
      'preferredDay', source.dia_tentativo,
      'preferredTime', source.hora_tentativo,
      'phase', source.fase,
      'handoffReason', source.derivacion,
      'missingField', source.dato_pendiente,
      'projectType', source.tipo_proyecto,
      'quotingOthers', source.cotizando_otras,
      'enthusiastic', source.entusiasta,
      'requestedMeeting', source.pidio_reunion,
      'sourceUpdatedAt', source.updated_at
    )
    into v_profile
    from public."clientes agente test" source
    where source.id = v_legacy_id;
  end if;

  return coalesce(v_profile, '{}'::jsonb);
end;
$$;

revoke all on function public.crm_get_lead_commercial_profile(uuid) from public, anon;
grant execute on function public.crm_get_lead_commercial_profile(uuid) to authenticated;

