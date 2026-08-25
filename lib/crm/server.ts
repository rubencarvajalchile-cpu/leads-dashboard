import "server-only"

import { createClient } from "@/lib/supabase-server"
import { resolveCrmEnabled } from "@/lib/crm-config"
import {
  CRM_COLUMN_KEYS,
  defaultCrmBoardColumns,
  type CrmBoard,
  type CrmBoardColumnDTO,
  type CrmColumnKey,
} from "@/lib/crm-board-model"
import type { CrmLeadDTO, HumanStage } from "@/lib/crm-model"
import type { CrmActivityDTO, CrmCommercialProfileDTO, CrmLeadWorkspaceDTO, CrmTaskStatus } from "@/lib/crm-workspace-model"

interface CrmLeadRow {
  id: string
  authority: "AI" | "HUMAN"
  stage: CrmLeadDTO["stage"]
  product_interest: string | null
  priority: CrmLeadDTO["priority"]
  assigned_to: string | null
  updated_at: string
  contact:
    | { name: string; phone_e164: string | null }
    | Array<{ name: string; phone_e164: string | null }>
    | null
}

interface CrmLeadWorkspaceRow extends CrmLeadRow {
  organization_id: string
  qualification_status: string | null
  human_taken_at: string | null
  created_at: string
}

interface CrmActivityRow {
  id: number
  actor_type: CrmActivityDTO["actorType"]
  event_type: string
  from_stage: CrmActivityDTO["fromStage"]
  to_stage: CrmActivityDTO["toStage"]
  payload: Record<string, unknown> | null
  created_at: string
}

interface CrmNoteRow {
  id: string
  body: string
  created_at: string
  updated_at: string
}

interface CrmTaskRow {
  id: string
  title: string
  due_at: string | null
  status: CrmTaskStatus
  created_at: string
  updated_at: string
}

interface CrmOpenTaskPreviewRow {
  lead_id: string
  title: string
  due_at: string | null
  created_at: string
}

const CRM_LEAD_SELECT =
  "id, authority, stage, product_interest, priority, assigned_to, updated_at, contact:crm_contacts!crm_leads_contact_id_fkey(name, phone_e164)"
const CRM_LEAD_WORKSPACE_SELECT =
  "organization_id, qualification_status, human_taken_at, created_at, id, authority, stage, product_interest, priority, assigned_to, updated_at, contact:crm_contacts!crm_leads_contact_id_fkey(name, phone_e164)"

export function isCrmEnabled() {
  return resolveCrmEnabled(process.env.CRM_ENABLED)
}

async function createAuthenticatedClient() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) throw new Error("CRM_UNAUTHENTICATED")
  return { supabase, user }
}

function mapLeadRows(data: unknown): CrmLeadDTO[] {
  return ((data ?? []) as CrmLeadRow[]).map((row) => {
    const contact = Array.isArray(row.contact) ? row.contact[0] : row.contact
    return {
      id: row.id,
      contactName: contact?.name ?? "Contacto sin nombre",
      phoneE164: contact?.phone_e164 ?? null,
      authority: row.authority,
      stage: row.stage,
      productInterest: row.product_interest,
      priority: row.priority,
      assignedTo: row.assigned_to,
      updatedAt: row.updated_at,
      nextTask: null,
    }
  })
}

async function withNextOpenTasks(supabase: Awaited<ReturnType<typeof createAuthenticatedClient>>["supabase"], leads: CrmLeadDTO[]) {
  if (leads.length === 0) return leads
  const { data, error } = await supabase.from("crm_tasks")
    .select("lead_id, title, due_at, created_at")
    .in("lead_id", leads.map((lead) => lead.id))
    .eq("status", "OPEN")
    .order("due_at", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true })
  if (error) throw new Error(`CRM_TASK_PREVIEW_READ_FAILED:${error.code}`)

  const nextTaskByLead = new Map<string, { title: string; dueAt: string | null }>()
  for (const task of (data ?? []) as CrmOpenTaskPreviewRow[]) {
    if (!nextTaskByLead.has(task.lead_id)) {
      nextTaskByLead.set(task.lead_id, { title: task.title, dueAt: task.due_at })
    }
  }
  return leads.map((lead) => ({ ...lead, nextTask: nextTaskByLead.get(lead.id) ?? null }))
}

export async function listHumanCrmLeads(): Promise<CrmLeadDTO[]> {
  if (!isCrmEnabled()) return []

  const { supabase } = await createAuthenticatedClient()

  const { data, error } = await supabase
    .from("crm_leads")
    .select(CRM_LEAD_SELECT)
    .eq("authority", "HUMAN")
    .order("updated_at", { ascending: false })

  if (error) throw new Error(`CRM_READ_FAILED:${error.code}`)

  return withNextOpenTasks(supabase, mapLeadRows(data))
}

export async function listTakeoverQueue(): Promise<CrmLeadDTO[]> {
  if (!isCrmEnabled()) return []

  const { supabase } = await createAuthenticatedClient()
  const { data, error } = await supabase
    .from("crm_leads")
    .select(CRM_LEAD_SELECT)
    .eq("authority", "AI")
    .eq("stage", "AI_CALL_REQUESTED")
    .order("updated_at", { ascending: true })

  if (error) throw new Error(`CRM_QUEUE_READ_FAILED:${error.code}`)
  return mapLeadRows(data)
}

export async function listAiCrmLeads(): Promise<CrmLeadDTO[]> {
  if (!isCrmEnabled()) return []
  const { supabase } = await createAuthenticatedClient()
  const { data, error } = await supabase.from("crm_leads").select(CRM_LEAD_SELECT)
    .eq("authority", "AI").order("updated_at", { ascending: false })
  if (error) throw new Error(`CRM_AI_READ_FAILED:${error.code}`)
  return mapLeadRows(data)
}

export async function getCrmWorkspaceAccess() {
  const { supabase, user } = await createAuthenticatedClient()
  const { data, error } = await supabase.from("crm_organization_members")
    .select("organization_id, role").eq("user_id", user.id).eq("active", true).limit(1).maybeSingle()
  if (error || !data) throw new Error(`CRM_MEMBERSHIP_REQUIRED:${error?.code ?? "NOT_FOUND"}`)
  return {
    organizationId: data.organization_id as string,
    canManageColumns: data.role === "OWNER" || data.role === "MANAGER",
  }
}

interface CrmBoardColumnRow {
  board: CrmBoard
  column_key: CrmColumnKey
  label: string
  color: string
  position: number
}

export async function listCrmBoardColumns(organizationId: string): Promise<CrmBoardColumnDTO[]> {
  const { supabase } = await createAuthenticatedClient()
  const { data, error } = await supabase.from("crm_board_columns")
    .select("board, column_key, label, color, position")
    .eq("organization_id", organizationId).order("position", { ascending: true })
  if (error) return defaultCrmBoardColumns()
  const rows = (data ?? []) as CrmBoardColumnRow[]
  if (rows.length === 0) return defaultCrmBoardColumns()
  return rows.filter((row) => (CRM_COLUMN_KEYS as readonly string[]).includes(row.column_key)).map((row) => ({
    board: row.board, key: row.column_key, label: row.label, color: row.color, position: row.position,
  }))
}

export async function updateCrmBoardColumns(
  organizationId: string, board: CrmBoard, columns: readonly CrmBoardColumnDTO[],
) {
  if (!isCrmEnabled()) throw new Error("CRM_NOT_ENABLED")
  const { supabase } = await createAuthenticatedClient()
  const { data, error } = await supabase.rpc("crm_update_board_columns", {
    p_organization_id: organizationId,
    p_board: board,
    p_columns: columns.map((column) => ({
      column_key: column.key, label: column.label, color: column.color, position: column.position,
    })),
  })
  if (error) throw new Error(`CRM_COLUMNS_UPDATE_FAILED:${error.code}`)
  return data
}

export async function takeHumanCrmLead(leadId: string, reason?: string) {
  if (!isCrmEnabled()) throw new Error("CRM_NOT_ENABLED")

  const { supabase } = await createAuthenticatedClient()
  const { data, error } = await supabase.rpc("crm_take_human_lead", {
    p_lead_id: leadId,
    p_reason: reason?.trim() || null,
  })

  if (error) throw new Error(`CRM_TAKE_FAILED:${error.code}`)
  return data
}

export async function moveHumanCrmLead(leadId: string, nextStage: HumanStage, reason?: string) {
  if (!isCrmEnabled()) throw new Error("CRM_NOT_ENABLED")

  const { supabase } = await createAuthenticatedClient()
  const { data, error } = await supabase.rpc("crm_move_human_lead", {
    p_lead_id: leadId,
    p_next_stage: nextStage,
    p_reason: reason?.trim() || null,
  })

  if (error) throw new Error(`CRM_MOVE_FAILED:${error.code}`)
  return data
}

export async function returnHumanCrmLeadToAi(leadId: string, reason: string) {
  if (!isCrmEnabled()) throw new Error("CRM_NOT_ENABLED")

  const { supabase } = await createAuthenticatedClient()
  const { data, error } = await supabase.rpc("crm_return_lead_to_ai", {
    p_lead_id: leadId,
    p_reason: reason,
  })

  if (error) throw new Error(`CRM_RETURN_FAILED:${error.code}`)
  return data
}

async function getHumanMutableLead(leadId: string) {
  if (!isCrmEnabled()) throw new Error("CRM_NOT_ENABLED")
  const { supabase, user } = await createAuthenticatedClient()
  const { data, error } = await supabase.from("crm_leads")
    .select("organization_id, authority")
    .eq("id", leadId)
    .maybeSingle()
  if (error || !data) throw new Error(`CRM_LEAD_READ_FAILED:${error?.code ?? "NOT_FOUND"}`)
  if (data.authority !== "HUMAN") throw new Error("CRM_HUMAN_AUTHORITY_REQUIRED")
  return { supabase, user, organizationId: data.organization_id as string }
}

export async function getCrmLeadWorkspace(leadId: string): Promise<CrmLeadWorkspaceDTO> {
  if (!isCrmEnabled()) throw new Error("CRM_NOT_ENABLED")
  const { supabase } = await createAuthenticatedClient()
  const { data, error } = await supabase.from("crm_leads")
    .select(CRM_LEAD_WORKSPACE_SELECT)
    .eq("id", leadId)
    .maybeSingle()
  if (error || !data) throw new Error(`CRM_WORKSPACE_READ_FAILED:${error?.code ?? "NOT_FOUND"}`)

  const row = data as CrmLeadWorkspaceRow
  const [commercialResult, activitiesResult, notesResult, tasksResult] = await Promise.all([
    supabase.rpc("crm_get_lead_commercial_profile", { p_lead_id: leadId }),
    supabase.from("crm_activities")
      .select("id, actor_type, event_type, from_stage, to_stage, payload, created_at")
      .eq("lead_id", leadId).order("created_at", { ascending: false }).limit(40),
    supabase.from("crm_notes")
      .select("id, body, created_at, updated_at")
      .eq("lead_id", leadId).order("created_at", { ascending: false }).limit(40),
    supabase.from("crm_tasks")
      .select("id, title, due_at, status, created_at, updated_at")
      .eq("lead_id", leadId).order("due_at", { ascending: true, nullsFirst: false }).limit(40),
  ])
  if (commercialResult.error || activitiesResult.error || notesResult.error || tasksResult.error) {
    throw new Error("CRM_WORKSPACE_TIMELINE_READ_FAILED")
  }

  return {
    lead: mapLeadRows([row])[0],
    qualificationStatus: row.qualification_status,
    humanTakenAt: row.human_taken_at,
    createdAt: row.created_at,
    commercialProfile: Object.keys((commercialResult.data ?? {}) as Record<string, unknown>).length > 0
      ? commercialResult.data as CrmCommercialProfileDTO
      : null,
    activities: ((activitiesResult.data ?? []) as CrmActivityRow[]).map((activity) => ({
      id: String(activity.id), actorType: activity.actor_type, eventType: activity.event_type,
      fromStage: activity.from_stage, toStage: activity.to_stage,
      payload: activity.payload ?? {}, createdAt: activity.created_at,
    })),
    notes: ((notesResult.data ?? []) as CrmNoteRow[]).map((note) => ({
      id: note.id, body: note.body, createdAt: note.created_at, updatedAt: note.updated_at,
    })),
    tasks: ((tasksResult.data ?? []) as CrmTaskRow[]).map((task) => ({
      id: task.id, title: task.title, dueAt: task.due_at, status: task.status,
      createdAt: task.created_at, updatedAt: task.updated_at,
    })),
  }
}

export async function recordCrmHumanContact(
  leadId: string,
  operationId: string,
  channel: "WHATSAPP" | "LLAMADA" | "OTRO",
  note?: string,
) {
  if (!isCrmEnabled()) throw new Error("CRM_NOT_ENABLED")
  const { supabase } = await createAuthenticatedClient()
  const { data, error } = await supabase.rpc("crm_record_human_contact", {
    p_lead_id: leadId,
    p_operation_id: operationId,
    p_channel: channel,
    p_note: note?.trim() || null,
  })
  if (error) throw new Error(`CRM_CONTACT_RECORD_FAILED:${error.code}`)
  return data
}

export async function addCrmLeadNote(leadId: string, body: string) {
  const { supabase, user, organizationId } = await getHumanMutableLead(leadId)
  const { data, error } = await supabase.from("crm_notes").insert({
    organization_id: organizationId, lead_id: leadId, author_id: user.id, body: body.trim(),
  }).select("id, body, created_at, updated_at").single()
  if (error) throw new Error(`CRM_NOTE_CREATE_FAILED:${error.code}`)
  return data
}

export async function createCrmLeadTask(leadId: string, title: string, dueAt: string | null) {
  const { supabase, user, organizationId } = await getHumanMutableLead(leadId)
  const { data, error } = await supabase.from("crm_tasks").insert({
    organization_id: organizationId, lead_id: leadId, assigned_to: user.id, created_by: user.id,
    title: title.trim(), due_at: dueAt, status: "OPEN",
  }).select("id, title, due_at, status, created_at, updated_at").single()
  if (error) throw new Error(`CRM_TASK_CREATE_FAILED:${error.code}`)
  return data
}

export async function completeCrmLeadTask(leadId: string, taskId: string) {
  const { supabase } = await getHumanMutableLead(leadId)
  const { data, error } = await supabase.from("crm_tasks")
    .update({ status: "DONE" })
    .eq("id", taskId).eq("lead_id", leadId).eq("status", "OPEN")
    .select("id")
    .maybeSingle()
  if (error || !data) throw new Error(`CRM_TASK_COMPLETE_FAILED:${error?.code ?? "NOT_FOUND"}`)
}
