import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

const migration = readFileSync(
  new URL("../supabase/migrations/202608250007_crm_sales_usability_guards.sql", import.meta.url),
  "utf8",
)

test("la etiqueta heredada se corrige sin sobrescribir una personalización", () => {
  assert.match(migration, /set label = 'Derivado a humano · sin contacto'/)
  assert.match(migration, /column_key = 'SALES_TAKEN'/)
  assert.match(migration, /and label = 'Tomado · pendiente de contacto'/)
})

test("un vendedor no puede declarar contacto sin evidencia verificable", () => {
  assert.match(migration, /create or replace function public\.crm_move_human_lead/)
  assert.match(migration, /v_lead\.stage = 'HUMAN_NEW'/)
  assert.match(migration, /'HUMAN_CONTACTING', 'HUMAN_PROPOSAL', 'HUMAN_NEGOTIATION', 'WON'/)
  assert.match(migration, /CRM_CONTACT_EVIDENCE_REQUIRED/)
  assert.match(migration, /crm_record_human_contact/)
})

test("el cierre sin contacto sigue siendo una decisión humana explícita", () => {
  assert.doesNotMatch(migration, /'LOST', 'DO_NOT_CONTACT'\) then\s+raise exception 'CRM_CONTACT_EVIDENCE_REQUIRED'/)
  assert.match(migration, /'LOST', 'DO_NOT_CONTACT'/)
})
