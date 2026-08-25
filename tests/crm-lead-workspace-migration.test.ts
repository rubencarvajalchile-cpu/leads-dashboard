import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

const migration = readFileSync(
  new URL("../supabase/migrations/202608250006_crm_lead_workspace.sql", import.meta.url),
  "utf8",
)
const commercialMigration = readFileSync(
  new URL("../supabase/migrations/202608250009_crm_commercial_profile.sql", import.meta.url),
  "utf8",
)
const conversationMigration = readFileSync(
  new URL("../supabase/migrations/202608250010_crm_readonly_conversation.sql", import.meta.url),
  "utf8",
)
const server = readFileSync(new URL("../lib/crm/server.ts", import.meta.url), "utf8")
const panel = readFileSync(new URL("../components/crm/lead-workspace-panel.tsx", import.meta.url), "utf8")

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

test("la ficha comercial lee hechos reales mediante una frontera autenticada", () => {
  assert.match(commercialMigration, /create or replace function public\.crm_get_lead_commercial_profile/)
  assert.match(commercialMigration, /security definer/)
  assert.match(commercialMigration, /crm_is_org_member\(v_organization_id\)/)
  assert.match(commercialMigration, /v_legacy_table = 'clientes agente test'/)
  assert.match(commercialMigration, /source\.comuna/)
  assert.match(commercialMigration, /source\.consumo_clp/)
  assert.match(commercialMigration, /source\.propietario/)
  assert.match(commercialMigration, /source\.tipo_techo/)
  assert.match(commercialMigration, /grant execute on function public\.crm_get_lead_commercial_profile\(uuid\) to authenticated/)
  assert.doesNotMatch(commercialMigration, /grant select on .*clientes agente test/)
})

test("el servidor carga el perfil comercial junto con la ficha", () => {
  assert.match(server, /supabase\.rpc\("crm_get_lead_commercial_profile"/)
  assert.match(server, /commercialProfile:/)
})

test("el chat se expone por una frontera autenticada y exclusivamente de lectura", () => {
  assert.match(conversationMigration, /create or replace function public\.crm_get_lead_conversation/)
  assert.match(conversationMigration, /security definer/)
  assert.match(conversationMigration, /crm_is_org_member\(v_organization_id\)/)
  assert.match(conversationMigration, /from public\.n8n_chat_histories history/)
  assert.match(conversationMigration, /substring\(history\.session_id from/)
  assert.match(conversationMigration, /history\.message ->> 'type' in \('human', 'ai'\)/)
  assert.match(conversationMigration, /revoke all on function public\.crm_get_lead_conversation\(uuid\) from public, anon/)
  assert.match(conversationMigration, /grant execute on function public\.crm_get_lead_conversation\(uuid\) to authenticated/)
  assert.doesNotMatch(conversationMigration, /\b(insert|update|delete|truncate)\s+(into|public|from)/i)
})

test("la ficha muestra el historial como WhatsApp sin controles de envío", () => {
  assert.match(server, /supabase\.rpc\("crm_get_lead_conversation"/)
  assert.match(panel, /Conversación con Lucas/)
  assert.match(panel, /solo lectura/)
  assert.match(panel, /WhatsAppConversation/)
  assert.match(panel, /Desde aquí no se pueden enviar ni modificar mensajes/)
  assert.doesNotMatch(panel, /Enviar mensaje/)
})
