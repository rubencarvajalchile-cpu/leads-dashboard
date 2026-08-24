"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { HUMAN_STAGES } from "@/lib/crm-model"
import { moveHumanCrmLead, returnHumanCrmLeadToAi, takeHumanCrmLead } from "@/lib/crm/server"

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
