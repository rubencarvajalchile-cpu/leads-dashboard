import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

const migration = readFileSync(
  new URL("../supabase/migrations/202608250006_crm_lead_workspace.sql", import.meta.url),
  "utf8",
)

test("el contacto humano se registra mediante una única frontera auditada", () => {
  assert.match(migration, /create or replace function public\.crm_record_human_contact/)
  assert.match(migration, /p_operation_id uuid/)
  assert.match(migration, /'HUMAN_CONTACT_RECORDED'/)
  assert.match(migration, /actor_type[\s\S]*'HUMAN'/)
  assert.match(migration, /operation_id/)
  assert.match(migration, /grant execute on function public\.crm_record_human_contact[^;]+to authenticated/)
})

test("un contacto no puede convertir un lead de Lucas ni uno cerrado", () => {
  assert.match(migration, /v_lead\.authority <> 'HUMAN'/)
  assert.match(migration, /v_lead\.stage in \('WON', 'LOST', 'DO_NOT_CONTACT'\)/)
  assert.match(migration, /CRM_HUMAN_AUTHORITY_REQUIRED/)
  assert.match(migration, /CRM_TERMINAL_STAGE/)
})

test("el primer contacto mueve solo HUMAN_NEW a HUMAN_CONTACTING", () => {
  assert.match(migration, /if v_lead\.stage = 'HUMAN_NEW' then/)
  assert.match(migration, /set stage = 'HUMAN_CONTACTING'/)
  assert.match(migration, /v_from, v_lead\.stage/)
})

test("reintentar el mismo clic no duplica contacto ni nota", () => {
  assert.match(migration, /create unique index if not exists crm_human_contact_operation_idx/)
  assert.match(migration, /event_type = 'HUMAN_CONTACT_RECORDED'/)
  assert.match(migration, /payload ->> 'operation_id' = p_operation_id::text/)
  assert.match(migration, /then\s+return v_lead;/)
})

test("la nota de contacto queda separada de la telemetría de actividad", () => {
  assert.match(migration, /insert into public\.crm_notes/)
  assert.match(migration, /'note_recorded', v_note is not null/)
  assert.doesNotMatch(migration, /jsonb_build_object\([\s\S]*p_note/)
})
