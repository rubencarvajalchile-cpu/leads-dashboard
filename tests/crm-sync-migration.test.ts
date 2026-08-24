import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

const migration = readFileSync(
  new URL("../supabase/migrations/202608240002_crm_sync_legacy_proyecta.sql", import.meta.url),
  "utf8",
)
const rollback = readFileSync(
  new URL("../supabase/rollback/202608240002_crm_sync_legacy_proyecta_down.sql", import.meta.url),
  "utf8",
)

test("sincroniza solo solicitudes de llamada o tomas humanas explícitas", () => {
  assert.match(migration, /coalesce\(acepta_llamada, false\)/)
  assert.match(migration, /coalesce\(trava, false\)/)
  assert.match(migration, /ejecutivo_humano/)
  assert.doesNotMatch(migration, /from public\."clientes beleife"/)
  assert.doesNotMatch(migration, /from public\."clientes cowork"/)
})

test("una solicitud queda en cola IA y una toma explícita queda bajo autoridad humana", () => {
  assert.match(migration, /when v_explicit_human then 'HUMAN' else 'AI'/)
  assert.match(migration, /when v_explicit_human then 'HUMAN_NEW' else 'AI_CALL_REQUESTED'/)
  assert.match(migration, /when v_lead\.authority = 'HUMAN' then v_lead\.authority/)
  assert.match(migration, /when v_lead\.authority = 'HUMAN' then v_lead\.stage/)
})

test("la sincronización es idempotente y no duplica contactos, leads ni evidencia", () => {
  assert.match(migration, /unique index if not exists crm_leads_org_contact_idx/)
  assert.match(migration, /legacy_table = 'clientes agente test'/)
  assert.match(migration, /and a\.event_type = 'LEGACY_IMPORTED'/)
  assert.match(migration, /where not exists/)
})

test("el trigger nunca rompe la escritura operativa de n8n", () => {
  assert.match(migration, /after insert or update of/)
  assert.match(migration, /exception\s+when others then/)
  assert.match(migration, /CRM_LEGACY_SYNC_FAILED/)
  assert.match(migration, /return new/)
})

test("solo service_role puede invocar la sincronización manual", () => {
  assert.match(migration, /revoke all on function public\.crm_sync_proyecta_legacy_lead\(bigint\) from public, anon, authenticated/)
  assert.match(migration, /grant execute on function public\.crm_sync_proyecta_legacy_human_leads\(\) to service_role/)
})

test("el rollback apaga la automatización sin borrar el trabajo humano importado", () => {
  assert.match(rollback, /drop trigger if exists crm_sync_proyecta_legacy_after_write/)
  assert.match(rollback, /drop function if exists public\.crm_sync_proyecta_legacy_lead/)
  assert.doesNotMatch(rollback, /delete from public\.crm_/i)
})
