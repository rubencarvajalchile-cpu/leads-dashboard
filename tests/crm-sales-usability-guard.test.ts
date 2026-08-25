import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

const migration = readFileSync(
  new URL("../supabase/migrations/202608250007_crm_sales_usability_guards.sql", import.meta.url),
  "utf8",
)
const restoration = readFileSync(
  new URL("../supabase/migrations/202608250008_crm_restore_seller_movement.sql", import.meta.url),
  "utf8",
)

test("la etiqueta heredada se corrige sin sobrescribir una personalización", () => {
  assert.match(migration, /set label = 'Derivado a humano · sin contacto'/)
  assert.match(migration, /column_key = 'SALES_TAKEN'/)
  assert.match(migration, /and label = 'Tomado · pendiente de contacto'/)
})

test("la migración posterior restaura el movimiento explícito del vendedor", () => {
  assert.match(migration, /CRM_CONTACT_EVIDENCE_REQUIRED/)
  assert.doesNotMatch(restoration, /CRM_CONTACT_EVIDENCE_REQUIRED/)
  assert.match(restoration, /'HUMAN_STAGE_CHANGED'/)
  assert.match(restoration, /actor_type, actor_user_id/)
  assert.match(restoration, /'HUMAN', auth\.uid\(\)/)
})

test("el cierre sin contacto sigue siendo una decisión humana explícita", () => {
  assert.doesNotMatch(migration, /'LOST', 'DO_NOT_CONTACT'\) then\s+raise exception 'CRM_CONTACT_EVIDENCE_REQUIRED'/)
  assert.match(migration, /'LOST', 'DO_NOT_CONTACT'/)
})
