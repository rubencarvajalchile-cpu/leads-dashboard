import { Building2, Eye } from "lucide-react"
import { DualCrmBoard } from "@/components/crm/dual-crm-board"
import type { CrmLeadDTO } from "@/lib/crm-model"

const previewHumanLeads: CrmLeadDTO[] = [
  {
    id: "preview-human-negotiation",
    contactName: "Cliente piloto - negociación humana",
    phoneE164: null,
    authority: "HUMAN",
    stage: "HUMAN_NEGOTIATION",
    productInterest: "Proyecto comercial",
    priority: "P2",
    assignedTo: "preview-owner",
    updatedAt: "2026-08-24T12:00:00.000Z",
  },
]

const previewAiLeads: CrmLeadDTO[] = [
  {
    id: "preview-ai-new", contactName: "Camila - nuevo lead", phoneE164: null,
    authority: "AI", stage: "AI_NEW", productInterest: "Paneles solares",
    priority: "P3", assignedTo: null, updatedAt: "2026-08-25T12:00:00.000Z",
  },
  {
    id: "preview-ai-qualifying", contactName: "Javier - calificando", phoneE164: null,
    authority: "AI", stage: "AI_QUALIFYING", productInterest: "Evaluación residencial",
    priority: "P2", assignedTo: null, updatedAt: "2026-08-25T12:00:00.000Z",
  },
  {
    id: "preview-ai-call-requested",
    contactName: "Lead piloto - solicitud de llamada",
    phoneE164: null,
    authority: "AI",
    stage: "AI_CALL_REQUESTED",
    productInterest: "Evaluación comercial",
    priority: "P1",
    assignedTo: null,
    updatedAt: "2026-08-24T12:00:00.000Z",
  },
]

export default function CrmDemoPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-[#30342e] bg-[#171916]">
        <div className="mx-auto flex max-w-[1800px] items-center justify-between px-5 py-4 sm:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-[#4d6658] bg-[#202a24] text-[#79b994]">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-[17px] font-semibold text-[#ebece6]">CRM comercial</h1>
              <p className="text-xs text-muted-foreground">Proyecta Energía</p>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-[#3d5447] px-3 py-1.5 text-xs text-[#84a995]">
            <Eye className="h-3.5 w-3.5" /> Vista demostrativa
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1800px] space-y-8 px-5 py-10 sm:px-8 sm:py-12">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#6fa485]">Atención humana</p>
            <h2 className="mt-2 text-[30px] font-semibold tracking-[-0.035em] text-[#e7e8e2]">Tablero comercial</h2>
          </div>
          <p className="max-w-xl text-sm leading-6 text-[#8d978f]">
            Esta vista usa datos ficticios. Puedes tomar y mover leads, además de cambiar nombres, colores y orden de columnas sin afectar información real.
          </p>
        </div>

        <DualCrmBoard initialAiLeads={previewAiLeads} initialHumanLeads={previewHumanLeads}
          organizationId="00000000-0000-0000-0000-000000000000" currentUserId="preview-owner" canManageColumns demoMode />
      </main>
    </div>
  )
}
