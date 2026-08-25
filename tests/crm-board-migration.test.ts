import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

const migration = readFileSync(new URL("../supabase/migrations/202608250001_crm_board_columns.sql", import.meta.url), "utf8")
const sync = readFileSync(new URL("../supabase/migrations/202608250002_crm_sync_full_lucas_funnel.sql", import.meta.url), "utf8")
const alignment = readFileSync(new URL("../supabase/migrations/202608250003_crm_align_sales_inbox.sql", import.meta.url), "utf8")
const contactTruth = readFileSync(new URL("../supabase/migrations/202608250004_crm_preserve_contact_truth.sql", import.meta.url), "utf8")

test("claves y etapas son inmutables", () => {
  assert.match(migration, /CRM_COLUMN_IDENTITY_IMMUTABLE/)
  assert.match(migration, /new\.stage_keys <> old\.stage_keys/)
  assert.match(migration, /CRM_BASE_COLUMN_DELETE_FORBIDDEN/)
})
test("solo managers configuran columnas por RPC", () => {
  assert.match(migration, /crm_is_org_manager\(p_organization_id\)/)
  assert.doesNotMatch(migration, /grant update[^;]+crm_board_columns/i)
})
test("configuración exige posiciones y colores válidos", () => {
  assert.match(migration, /v_distinct_positions <> v_expected/)
  assert.match(migration, /v_min_position <> 0/)
  assert.match(migration, /\^#\[0-9A-Fa-f\]\{6\}\$/)
})
test("Lucas sincroniza todos los leads sin rebajar humanos", () => {
  assert.match(sync, /select id from public\."clientes agente test" order by id/)
  assert.match(sync, /elsif v_lead\.authority = 'AI'/)
  assert.doesNotMatch(sync, /delete from public\.crm_/i)
})

test("conserva trazabilidad de la alineación anterior", () => {
  assert.match(alignment, /SALES_INBOX'[\s\S]+array\['AI_CALL_REQUESTED'\]/)
  assert.match(alignment, /SALES_CONTACTED'[\s\S]+array\['HUMAN_NEW','HUMAN_CONTACTING'\]/)
})

test("tomar un lead no fabrica evidencia de contacto", () => {
  assert.match(contactTruth, /SALES_INBOX'[\s\S]+array\['AI_CALL_REQUESTED','HUMAN_NEW'\]/)
  assert.match(contactTruth, /SALES_CONTACTED'[\s\S]+array\['HUMAN_CONTACTING'\]/)
})
