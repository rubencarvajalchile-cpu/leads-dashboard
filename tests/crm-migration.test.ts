import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

const migration = readFileSync(
  new URL("../supabase/migrations/202608240001_crm_human_handoff.sql", import.meta.url),
  "utf8",
)
const rollback = readFileSync(
  new URL("../supabase/rollback/202608240001_crm_human_handoff_down.sql", import.meta.url),
  "utf8",
)

test("la migración es aditiva y no altera las tablas heredadas", () => {
  assert.doesNotMatch(migration, /alter table public\.clientes/i)
  assert.doesNotMatch(migration, /drop table/i)
  assert.match(migration, /create table public\.crm_leads/)
})

test("todas las entidades comerciales nuevas activan RLS", () => {
  for (const table of [
    "crm_organizations",
    "crm_organization_members",
    "crm_contacts",
    "crm_leads",
    "crm_activities",
    "crm_notes",
    "crm_tasks",
  ]) {
    assert.match(migration, new RegExp(`alter table public\\.${table} enable row level security`))
  }
})

test("los vendedores no reciben UPDATE directo sobre el funnel protegido", () => {
  assert.doesNotMatch(migration, /grant update[^;]*crm_leads/i)
  assert.match(migration, /revoke all on public\.crm_leads from anon, authenticated/)
  assert.match(migration, /grant execute on function public\.crm_agent_move_lead[^;]+to service_role/)
  assert.match(migration, /CRM_AI_BLOCKED_BY_HUMAN/)
})

test("la toma y la devolución a IA son acciones explícitas y auditadas", () => {
  assert.match(migration, /create or replace function public\.crm_take_human_lead/)
  assert.match(migration, /'HUMAN_TAKEOVER'/)
  assert.match(migration, /create or replace function public\.crm_return_lead_to_ai/)
  assert.match(migration, /CRM_RETURN_REASON_REQUIRED/)
  assert.match(migration, /'RETURNED_TO_AI'/)
})

test("existe rollback completo para la fundación CRM", () => {
  assert.match(rollback, /drop table if exists public\.crm_leads/)
  assert.match(rollback, /drop type if exists public\.crm_authority/)
  assert.match(rollback, /drop function if exists public\.crm_agent_move_lead/)
})
