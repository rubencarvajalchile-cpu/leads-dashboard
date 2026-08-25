create or replace function public.crm_sync_proyecta_legacy_trigger()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if coalesce(new.acepta_llamada, false) or coalesce(new.trava, false)
     or lower(coalesce(new.derivacion, '')) like '%ejecutivo_humano%'
  then perform public.crm_sync_proyecta_legacy_lead(new.id); end if;
  return new;
exception when others then
  raise warning 'CRM_LEGACY_SYNC_FAILED legacy_id=% sqlstate=%', new.id, sqlstate;
  return new;
end;
$$;
drop function if exists public.crm_sync_proyecta_full_funnel();
drop function if exists public.crm_sync_proyecta_full_lead(bigint);
