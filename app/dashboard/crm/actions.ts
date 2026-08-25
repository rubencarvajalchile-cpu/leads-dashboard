"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { CRM_BOARDS, CRM_COLUMN_KEYS } from "@/lib/crm-board-model"
import { HUMAN_STAGES } from "@/lib/crm-model"
import { moveHumanCrmLead, returnHumanCrmLeadToAi, takeHumanCrmLead, updateCrmBoardColumns } from "@/lib/crm/server"

const takeSchema = z.object({
  leadId: z.string().uuid(),
  reason: z.string().trim().max(500).optional(),
})

const moveSchema = z.object({
  leadId: z.string().uuid(),
  nextStage: z.enum(HUMAN_STAGES),
  reason: z.string().trim().max(500).optional(),
})

const returnSchema = z.object({
  leadId: z.string().uuid(),
  reason: z.string().trim().min(3).max(500),
})

const saveColumnsSchema = z.object({
  organizationId: z.string().uuid(),
  board: z.enum(CRM_BOARDS),
  columns: z.array(z.object({
    board: z.enum(CRM_BOARDS), key: z.enum(CRM_COLUMN_KEYS),
    label: z.string().trim().min(1).max(48),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/), position: z.number().int().min(0).max(20),
  })).min(1).max(8),
})

export async function takeHumanLeadAction(input: unknown) {
  const parsed = takeSchema.safeParse(input)
  if (!parsed.success) return { ok: false as const, error: "Datos inválidos." }

  try {
    await takeHumanCrmLead(parsed.data.leadId, parsed.data.reason)
    revalidatePath("/dashboard/crm")
    return { ok: true as const }
  } catch {
    return { ok: false as const, error: "No se pudo tomar la conversación." }
  }
}

export async function moveHumanLeadAction(input: unknown) {
  const parsed = moveSchema.safeParse(input)
  if (!parsed.success) return { ok: false as const, error: "Datos inválidos." }

  try {
    await moveHumanCrmLead(parsed.data.leadId, parsed.data.nextStage, parsed.data.reason)
    revalidatePath("/dashboard/crm")
    return { ok: true as const }
  } catch {
    return { ok: false as const, error: "No se pudo mover el lead." }
  }
}

export async function returnLeadToAiAction(input: unknown) {
  const parsed = returnSchema.safeParse(input)
  if (!parsed.success) return { ok: false as const, error: "Debes indicar el motivo de devolución." }

  try {
    await returnHumanCrmLeadToAi(parsed.data.leadId, parsed.data.reason)
    revalidatePath("/dashboard/crm")
    return { ok: true as const }
  } catch {
    return { ok: false as const, error: "No se pudo devolver el lead a la IA." }
  }
}

export async function saveBoardColumnsAction(input: unknown) {
  const parsed = saveColumnsSchema.safeParse(input)
  if (!parsed.success) return { ok: false as const, error: "Configuración de columnas inválida." }
  if (parsed.data.columns.some((column) => column.board !== parsed.data.board)) {
    return { ok: false as const, error: "Las columnas no corresponden al tablero." }
  }
  try {
    await updateCrmBoardColumns(parsed.data.organizationId, parsed.data.board, parsed.data.columns)
    revalidatePath("/dashboard/crm")
    return { ok: true as const }
  } catch {
    return { ok: false as const, error: "No se pudo guardar la configuración." }
  }
}
