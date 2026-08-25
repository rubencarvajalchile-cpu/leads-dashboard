"use client"

import { useState, useTransition } from "react"
import { Bot, RotateCcw, UserRound } from "lucide-react"
import {
  moveHumanLeadAction,
  returnLeadToAiAction,
  takeHumanLeadAction,
} from "@/app/dashboard/crm/actions"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import {
  HUMAN_STAGES,
  HUMAN_STAGE_LABELS,
  canReturnToAi,
  type CrmLeadDTO,
  type HumanStage,
} from "@/lib/crm-model"

interface HumanCrmBoardProps {
  initialLeads: CrmLeadDTO[]
  initialTakeoverQueue: CrmLeadDTO[]
  readOnly?: boolean
}

const activeColumns: readonly HumanStage[] = [
  "HUMAN_NEW",
  "HUMAN_CONTACTING",
  "HUMAN_PROPOSAL",
  "HUMAN_NEGOTIATION",
  "WON",
  "LOST",
  "DO_NOT_CONTACT",
]

export function HumanCrmBoard({ initialLeads, initialTakeoverQueue, readOnly = false }: HumanCrmBoardProps) {
  const [leads, setLeads] = useState(initialLeads)
  const [takeoverQueue, setTakeoverQueue] = useState(initialTakeoverQueue)
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [returnReasons, setReturnReasons] = useState<Record<string, string>>({})
  const [isPending, startTransition] = useTransition()
  const { toast } = useToast()

  const takeLead = (lead: CrmLeadDTO) => {
    setPendingId(lead.id)
    startTransition(async () => {
      const result = await takeHumanLeadAction({
        leadId: lead.id,
        reason: "Toma explícita desde CRM",
      })
      setPendingId(null)
      if (result.ok) {
        setTakeoverQueue((items) => items.filter((item) => item.id !== lead.id))
        setLeads((items) => [{ ...lead, authority: "HUMAN", stage: "HUMAN_NEW" }, ...items])
        toast({ title: "Conversación tomada. La IA quedó bloqueada." })
      } else {
        toast({ title: result.error, variant: "destructive" })
      }
    })
  }

  const moveLead = (lead: CrmLeadDTO, nextStage: HumanStage) => {
    const previous = leads
    setLeads((items) => items.map((item) => (item.id === lead.id ? { ...item, stage: nextStage } : item)))
    setPendingId(lead.id)

    startTransition(async () => {
      const result = await moveHumanLeadAction({ leadId: lead.id, nextStage })
      setPendingId(null)
      if (!result.ok) {
        setLeads(previous)
        toast({ title: result.error, variant: "destructive" })
      }
    })
  }

  const returnToAi = (lead: CrmLeadDTO) => {
    const reason = returnReasons[lead.id]?.trim() ?? ""
    if (reason.length < 3) {
      toast({ title: "Escribe por qué devuelves este lead a la IA.", variant: "destructive" })
      return
    }

    setPendingId(lead.id)
    startTransition(async () => {
      const result = await returnLeadToAiAction({ leadId: lead.id, reason })
      setPendingId(null)
      if (result.ok) {
        setLeads((items) => items.filter((item) => item.id !== lead.id))
        toast({ title: "Lead devuelto explícitamente a la IA." })
      } else {
        toast({ title: result.error, variant: "destructive" })
      }
    })
  }

  if (leads.length === 0 && takeoverQueue.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-[#3b423a] bg-[#1d201c] px-6 py-16 text-center">
        <UserRound className="mx-auto h-9 w-9 text-[#6da685]" />
        <h2 className="mt-4 text-lg font-semibold text-[#e7e8e2]">Sin leads bajo atención humana</h2>
        <p className="mt-2 text-sm text-[#8d978f]">Los leads aparecerán aquí únicamente después de una toma explícita.</p>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {takeoverQueue.length > 0 && (
        <section className="rounded-xl border border-[#3e4d42] bg-[#1d231e] p-4">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-[#e7e8e2]">Solicitudes listas para atención humana</h2>
              <p className="mt-1 text-xs text-[#89938b]">La IA conserva el control hasta que un vendedor pulse Tomar.</p>
            </div>
            <span className="rounded-full bg-[#2a382f] px-2.5 py-1 text-xs text-[#8ec5a2]">{takeoverQueue.length}</span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {takeoverQueue.map((lead) => {
              const busy = isPending && pendingId === lead.id
              return (
                <article key={lead.id} className="rounded-lg border border-[#3a443c] bg-[#222820] p-3">
                  <p className="font-medium text-[#ecece7]">{lead.contactName}</p>
                  <p className="mt-1 text-xs text-[#7f8981]">Prioridad {lead.priority}</p>
                  {lead.productInterest && <p className="mt-2 text-xs text-[#aab1aa]">{lead.productInterest}</p>}
                  <Button type="button" size="sm" disabled={readOnly || busy} onClick={() => takeLead(lead)} className="mt-3 w-full">
                    <UserRound className="h-3.5 w-3.5" />
                    {busy ? "Tomando..." : "Tomar conversación"}
                  </Button>
                </article>
              )
            })}
          </div>
        </section>
      )}

      <div className="overflow-x-auto pb-4">
        <div className="grid min-w-[1540px] grid-cols-7 gap-4">
          {activeColumns.map((stage) => {
            const columnLeads = leads.filter((lead) => lead.stage === stage)
            return (
              <section key={stage} className="rounded-xl border border-[#343831] bg-[#1d201c]">
                <header className="flex items-center justify-between border-b border-[#343831] px-4 py-3">
                  <h2 className="text-sm font-medium text-[#d7d9d3]">{HUMAN_STAGE_LABELS[stage]}</h2>
                  <span className="rounded-full bg-[#292e28] px-2 py-0.5 text-xs text-[#9ca49d]">
                    {columnLeads.length}
                  </span>
                </header>
                <div className="space-y-3 p-3">
                  {columnLeads.map((lead) => {
                    const busy = isPending && pendingId === lead.id
                    return (
                      <article key={lead.id} className="rounded-lg border border-[#373c35] bg-[#222620] p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-medium text-[#ecece7]">{lead.contactName}</p>
                          <p className="mt-1 text-xs text-[#7f8981]">Prioridad {lead.priority}</p>
                        </div>
                        <UserRound className="h-4 w-4 text-[#7aab8d]" />
                      </div>

                      {lead.productInterest && <p className="mt-3 text-xs leading-5 text-[#aab1aa]">{lead.productInterest}</p>}

                      <label className="mt-4 block text-[11px] uppercase tracking-wide text-[#727b73]">
                        Mover a
                        <select
                          value={lead.stage}
                          disabled={readOnly || busy}
                          onChange={(event) => moveLead(lead, event.target.value as HumanStage)}
                          className="mt-1.5 w-full rounded-md border border-[#3b4139] bg-[#191c18] px-2 py-2 text-xs text-[#dfe1dc]"
                        >
                          {HUMAN_STAGES.map((option) => (
                            <option key={option} value={option}>{HUMAN_STAGE_LABELS[option]}</option>
                          ))}
                        </select>
                      </label>

                      {canReturnToAi(lead.stage, lead.authority) && (
                        <div className="mt-3 border-t border-[#343831] pt-3">
                          <input
                            value={returnReasons[lead.id] ?? ""}
                            disabled={readOnly}
                            onChange={(event) => setReturnReasons((current) => ({ ...current, [lead.id]: event.target.value }))}
                            placeholder="Motivo para devolver a IA"
                            className="w-full rounded-md border border-[#3b4139] bg-[#191c18] px-2 py-2 text-xs text-[#dfe1dc] placeholder:text-[#667067]"
                          />
                          <Button type="button" variant="ghost" size="sm" disabled={readOnly || busy} onClick={() => returnToAi(lead)} className="mt-2 w-full text-xs text-[#9dbba8]">
                            {busy ? <Bot className="h-3.5 w-3.5 animate-pulse" /> : <RotateCcw className="h-3.5 w-3.5" />}
                            Devolver a IA
                          </Button>
                        </div>
                      )}
                      </article>
                    )
                  })}
                </div>
              </section>
            )
          })}
        </div>
      </div>
    </div>
  )
}
