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

export interface CrmLeadWorkspaceDTO {
  lead: CrmLeadDTO
  qualificationStatus: string | null
  humanTakenAt: string | null
  createdAt: string
  activities: CrmActivityDTO[]
  notes: CrmNoteDTO[]
  tasks: CrmTaskDTO[]
}
