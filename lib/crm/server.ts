import "server-only"

import { createClient } from "@/lib/supabase-server"
import { resolveCrmEnabled } from "@/lib/crm-config"
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
  return supabase
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

  const supabase = await createAuthenticatedClient()

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

  const supabase = await createAuthenticatedClient()
  const { data, error } = await supabase
    .from("crm_leads")
    .select(CRM_LEAD_SELECT)
    .eq("authority", "AI")
    .eq("stage", "AI_CALL_REQUESTED")
    .order("updated_at", { ascending: true })

  if (error) throw new Error(`CRM_QUEUE_READ_FAILED:${error.code}`)
  return mapLeadRows(data)
}

export async function takeHumanCrmLead(leadId: string, reason?: string) {
  if (!isCrmEnabled()) throw new Error("CRM_NOT_ENABLED")

  const supabase = await createAuthenticatedClient()
  const { data, error } = await supabase.rpc("crm_take_human_lead", {
    p_lead_id: leadId,
    p_reason: reason?.trim() || null,
  })

  if (error) throw new Error(`CRM_TAKE_FAILED:${error.code}`)
  return data
}

export async function moveHumanCrmLead(leadId: string, nextStage: HumanStage, reason?: string) {
  if (!isCrmEnabled()) throw new Error("CRM_NOT_ENABLED")

  const supabase = await createAuthenticatedClient()
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

  const supabase = await createAuthenticatedClient()
  const { data, error } = await supabase.rpc("crm_return_lead_to_ai", {
    p_lead_id: leadId,
    p_reason: reason,
  })

  if (error) throw new Error(`CRM_RETURN_FAILED:${error.code}`)
  return data
}
