drop trigger if exists crm_seed_board_columns_after_org on public.crm_organizations;
drop trigger if exists crm_protect_board_column_identity on public.crm_board_columns;
drop function if exists public.crm_update_board_columns(uuid, text, jsonb);
drop function if exists public.crm_protect_board_column_identity();
drop function if exists public.crm_seed_board_columns_after_org();
drop function if exists public.crm_seed_board_columns(uuid);
drop table if exists public.crm_board_columns;
