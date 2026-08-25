import type { CrmLeadDTO, CrmLeadStage } from "@/lib/crm-model"

export type CrmTaskStatus = "OPEN" | "DONE" | "CANCELLED"

export interface CrmActivityDTO {
  id: string
  actorType: "SYSTEM" | "AI" | "HUMAN"
  eventType: string
  fromStage: CrmLeadStage | null
  toStage: CrmLeadStage | null
  payload: Record<string, unknown>
  createdAt: string
}

export interface CrmNoteDTO {
  id: string
  body: string
  createdAt: string
  updatedAt: string
}

export interface CrmTaskDTO {
  id: string
  title: string
  dueAt: string | null
  status: CrmTaskStatus
  createdAt: string
  updatedAt: string
}

export interface CrmCommercialProfileDTO {
  interested: boolean | null
  commune: string | null
  monthlyConsumptionClp: number | null
  consumptionRange: string | null
  qualified: boolean | null
  owner: boolean | null
  roofType: string | null
  homeType: string | null
  acceptsCall: boolean | null
  urgency: string | null
  preferredDay: string | null
  preferredTime: string | null
  phase: string | null
  handoffReason: string | null
  missingField: string | null
  projectType: string | null
  quotingOthers: boolean | null
  enthusiastic: boolean | null
  requestedMeeting: boolean | null
  sourceUpdatedAt: string | null
}

export interface CrmLeadWorkspaceDTO {
  lead: CrmLeadDTO
  qualificationStatus: string | null
  humanTakenAt: string | null
  createdAt: string
  commercialProfile: CrmCommercialProfileDTO | null
  activities: CrmActivityDTO[]
  notes: CrmNoteDTO[]
  tasks: CrmTaskDTO[]
}
