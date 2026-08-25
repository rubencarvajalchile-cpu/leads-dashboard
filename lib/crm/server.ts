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

const CRM_LEAD_SELECT =
  "id, authority, stage, product_interest, priority, assigned_to, updated_at, contact:crm_contacts!crm_leads_contact_id_fkey(name, phone_e164)"

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
    }
  })
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

  return mapLeadRows(data)
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
