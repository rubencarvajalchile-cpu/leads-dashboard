import type { CrmLeadDTO, HumanStage } from "@/lib/crm-model"

export const CRM_BOARDS = ["LUCAS", "SALES"] as const
export const CRM_COLUMN_KEYS = [
  "LUCAS_INBOX", "LUCAS_QUALIFYING", "LUCAS_READY",
  "SALES_INBOX", "SALES_TAKEN", "SALES_CONTACTED", "SALES_MANAGING", "SALES_WON", "SALES_LOST",
] as const

export type CrmBoard = (typeof CRM_BOARDS)[number]
export type CrmColumnKey = (typeof CRM_COLUMN_KEYS)[number]

export interface CrmBoardColumnDTO {
  board: CrmBoard
  key: CrmColumnKey
  label: string
  color: string
  position: number
}

const DEFAULT_COLUMNS: readonly CrmBoardColumnDTO[] = [
  { board: "LUCAS", key: "LUCAS_INBOX", label: "Lead entrante", color: "#5f8f73", position: 0 },
  { board: "LUCAS", key: "LUCAS_QUALIFYING", label: "Calificando", color: "#b69052", position: 1 },
  { board: "LUCAS", key: "LUCAS_READY", label: "Listo para llamada", color: "#6e8fba", position: 2 },
  { board: "SALES", key: "SALES_INBOX", label: "Lead entrante", color: "#6e8fba", position: 0 },
  { board: "SALES", key: "SALES_TAKEN", label: "Derivado a humano · sin contacto", color: "#a47f47", position: 1 },
  { board: "SALES", key: "SALES_CONTACTED", label: "Contactado", color: "#8c7db5", position: 2 },
  { board: "SALES", key: "SALES_MANAGING", label: "En gestión", color: "#b69052", position: 3 },
  { board: "SALES", key: "SALES_WON", label: "Ganado", color: "#5f9f78", position: 4 },
  { board: "SALES", key: "SALES_LOST", label: "Perdido", color: "#9b6969", position: 5 },
]

export function defaultCrmBoardColumns(): CrmBoardColumnDTO[] {
  return DEFAULT_COLUMNS.map((column) => ({ ...column }))
}

export function columnsForBoard(columns: readonly CrmBoardColumnDTO[], board: CrmBoard) {
  return columns.filter((column) => column.board === board).sort((a, b) => a.position - b.position)
}

export function leadColumnKey(lead: CrmLeadDTO, board: CrmBoard): CrmColumnKey | null {
  if (board === "LUCAS") {
    if (lead.authority !== "AI") return null
    if (lead.stage === "AI_NEW") return "LUCAS_INBOX"
    if (lead.stage === "AI_QUALIFYING" || lead.stage === "AI_QUALIFIED") return "LUCAS_QUALIFYING"
    if (lead.stage === "AI_CALL_REQUESTED") return "LUCAS_READY"
    return null
  }

  if (lead.authority === "AI") return lead.stage === "AI_CALL_REQUESTED" ? "SALES_INBOX" : null
  // A takeover changes authority, not contact status. Keep it separate from
  // both the mirrored incoming queue and the explicitly contacted stage.
  if (lead.stage === "HUMAN_NEW") return "SALES_TAKEN"
  if (lead.stage === "HUMAN_CONTACTING") return "SALES_CONTACTED"
  if (lead.stage === "HUMAN_PROPOSAL" || lead.stage === "HUMAN_NEGOTIATION") return "SALES_MANAGING"
  if (lead.stage === "WON") return "SALES_WON"
  if (lead.stage === "LOST" || lead.stage === "DO_NOT_CONTACT") return "SALES_LOST"
  return null
}

export const SALES_MOVE_TARGETS: readonly { stage: HumanStage; label: string }[] = [
  { stage: "HUMAN_NEW", label: "Sin contacto registrado" },
  { stage: "HUMAN_CONTACTING", label: "Contactado" },
  { stage: "HUMAN_NEGOTIATION", label: "En gestión" },
  { stage: "WON", label: "Ganado" },
  { stage: "LOST", label: "Perdido" },
  { stage: "DO_NOT_CONTACT", label: "No contactar" },
]

export function salesSelectValue(lead: CrmLeadDTO): HumanStage {
  if (lead.authority !== "HUMAN") return "HUMAN_NEW"
  if (lead.stage === "HUMAN_PROPOSAL") return "HUMAN_NEGOTIATION"
  return lead.stage as HumanStage
}
