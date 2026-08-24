export const AI_STAGES = ["AI_NEW", "AI_QUALIFYING", "AI_QUALIFIED", "AI_CALL_REQUESTED"] as const

export const HUMAN_STAGES = [
  "HUMAN_NEW",
  "HUMAN_CONTACTING",
  "HUMAN_PROPOSAL",
  "HUMAN_NEGOTIATION",
  "WON",
  "LOST",
  "DO_NOT_CONTACT",
] as const

export const TERMINAL_STAGES = ["WON", "LOST", "DO_NOT_CONTACT"] as const

export type AiStage = (typeof AI_STAGES)[number]
export type HumanStage = (typeof HUMAN_STAGES)[number]
export type TerminalStage = (typeof TERMINAL_STAGES)[number]
export type CrmLeadStage = AiStage | HumanStage
export type CrmAuthority = "AI" | "HUMAN"

export const HUMAN_STAGE_LABELS: Record<HumanStage, string> = {
  HUMAN_NEW: "Por contactar",
  HUMAN_CONTACTING: "Contactando",
  HUMAN_PROPOSAL: "Propuesta enviada",
  HUMAN_NEGOTIATION: "Negociación",
  WON: "Ganado",
  LOST: "Perdido",
  DO_NOT_CONTACT: "No contactar",
}

export interface CrmLeadDTO {
  id: string
  contactName: string
  phoneE164: string | null
  authority: CrmAuthority
  stage: CrmLeadStage
  productInterest: string | null
  priority: "P1" | "P2" | "P3"
  assignedTo: string | null
  updatedAt: string
}

export function isAiStage(stage: CrmLeadStage | string): stage is AiStage {
  return (AI_STAGES as readonly string[]).includes(stage)
}

export function isHumanStage(stage: CrmLeadStage | string): stage is HumanStage {
  return (HUMAN_STAGES as readonly string[]).includes(stage)
}

export function isTerminalStage(stage: CrmLeadStage | string): stage is TerminalStage {
  return (TERMINAL_STAGES as readonly string[]).includes(stage)
}

export function canAgentTransition(from: CrmLeadStage, to: CrmLeadStage, authority: CrmAuthority) {
  if (authority !== "AI" || !isAiStage(from) || !isAiStage(to)) return false
  if (from === to) return true

  const allowed: Partial<Record<AiStage, readonly AiStage[]>> = {
    AI_NEW: ["AI_QUALIFYING"],
    AI_QUALIFYING: ["AI_QUALIFIED"],
    AI_QUALIFIED: ["AI_CALL_REQUESTED"],
  }

  return allowed[from]?.includes(to) ?? false
}

export function canHumanMove(from: CrmLeadStage, to: CrmLeadStage, authority: CrmAuthority) {
  if (authority !== "HUMAN" || !isHumanStage(from) || !isHumanStage(to)) return false
  if (isTerminalStage(from)) return from === to
  return true
}

export function canReturnToAi(stage: CrmLeadStage, authority: CrmAuthority) {
  return authority === "HUMAN" && isHumanStage(stage) && !isTerminalStage(stage)
}

