drop trigger if exists crm_sync_proyecta_legacy_after_write on public."clientes agente test";
drop function if exists public.crm_sync_proyecta_legacy_trigger();
drop function if exists public.crm_sync_proyecta_legacy_human_leads();
drop function if exists public.crm_sync_proyecta_legacy_lead(bigint);
drop index if exists public.crm_leads_org_contact_idx;

-- Imported CRM rows are intentionally retained. The legacy source remains intact,
-- and deleting human work during an operational rollback would be destructive.
