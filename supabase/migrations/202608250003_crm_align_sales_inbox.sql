-- Keep SALES/Lead entrante as the exact projection of Lucas/Listo para llamada.
-- A human-owned lead has already left Lucas and belongs in SALES_CONTACTED.

drop trigger if exists crm_protect_board_column_identity on public.crm_board_columns;

update public.crm_board_columns
set stage_keys = array['AI_CALL_REQUESTED']::public.crm_lead_stage[],
    updated_at = now()
where board = 'SALES' and column_key = 'SALES_INBOX';

update public.crm_board_columns
set stage_keys = array['HUMAN_NEW','HUMAN_CONTACTING']::public.crm_lead_stage[],
    updated_at = now()
where board = 'SALES' and column_key = 'SALES_CONTACTED';

create trigger crm_protect_board_column_identity
before update or delete on public.crm_board_columns
for each row execute function public.crm_protect_board_column_identity();

create or replace function public.crm_seed_board_columns(p_organization_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  insert into public.crm_board_columns(
    organization_id, board, column_key, stage_keys, label, color, position, is_base
  ) values
    (p_organization_id, 'LUCAS', 'LUCAS_INBOX', array['AI_NEW']::public.crm_lead_stage[], 'Lead entrante', '#5F8F73', 0, true),
    (p_organization_id, 'LUCAS', 'LUCAS_QUALIFYING', array['AI_QUALIFYING','AI_QUALIFIED']::public.crm_lead_stage[], 'Calificando', '#B69052', 1, true),
    (p_organization_id, 'LUCAS', 'LUCAS_READY', array['AI_CALL_REQUESTED']::public.crm_lead_stage[], 'Listo para llamada', '#6E8FBA', 2, true),
    (p_organization_id, 'SALES', 'SALES_INBOX', array['AI_CALL_REQUESTED']::public.crm_lead_stage[], 'Lead entrante', '#6E8FBA', 0, true),
    (p_organization_id, 'SALES', 'SALES_CONTACTED', array['HUMAN_NEW','HUMAN_CONTACTING']::public.crm_lead_stage[], 'Contactado', '#8C7DB5', 1, true),
    (p_organization_id, 'SALES', 'SALES_MANAGING', array['HUMAN_PROPOSAL','HUMAN_NEGOTIATION']::public.crm_lead_stage[], 'En gestión', '#B69052', 2, true),
    (p_organization_id, 'SALES', 'SALES_WON', array['WON']::public.crm_lead_stage[], 'Ganado', '#5F9F78', 3, true),
    (p_organization_id, 'SALES', 'SALES_LOST', array['LOST','DO_NOT_CONTACT']::public.crm_lead_stage[], 'Perdido', '#9B6969', 4, true)
  on conflict (organization_id, board, column_key) do nothing;
end;
$$;

revoke all on function public.crm_seed_board_columns(uuid) from public, anon, authenticated;
