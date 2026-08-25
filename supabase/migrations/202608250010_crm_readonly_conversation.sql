-- Expose the Lucas conversation to authenticated CRM members without granting
-- direct access to n8n's memory table. The source remains read-only and the
-- response contains only the speaker and rendered text required by the CRM.

create or replace function public.crm_get_lead_conversation(p_lead_id uuid)
returns table (
  message_id bigint,
  speaker text,
  content text,
  sequence_number bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_organization_id uuid;
  v_phone_digits text;
begin
  select lead.organization_id,
         regexp_replace(coalesce(contact.phone_e164, ''), '[^0-9]', '', 'g')
  into v_organization_id, v_phone_digits
  from public.crm_leads lead
  join public.crm_contacts contact on contact.id = lead.contact_id
  where lead.id = p_lead_id;

  if v_organization_id is null or not public.crm_is_org_member(v_organization_id) then
    raise exception 'CRM_MEMBERSHIP_REQUIRED';
  end if;

  if nullif(v_phone_digits, '') is null then
    return;
  end if;

  return query
  select history.id::bigint,
         case history.message ->> 'type'
           when 'human' then 'CLIENT'
           when 'ai' then 'LUCAS'
           else 'UNKNOWN'
         end,
         left(history.message ->> 'content', 10000),
         row_number() over (order by history.id)::bigint
  from public.n8n_chat_histories history
  where substring(history.session_id from '^([0-9]{8,15})') = v_phone_digits
    and history.message ->> 'type' in ('human', 'ai')
    and nullif(trim(history.message ->> 'content'), '') is not null
  order by history.id
  limit 500;
end;
$$;

revoke all on function public.crm_get_lead_conversation(uuid) from public, anon;
grant execute on function public.crm_get_lead_conversation(uuid) to authenticated;
