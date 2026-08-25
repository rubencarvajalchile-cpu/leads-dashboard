"use client"

import { useMemo, useState, useTransition } from "react"
import { ArrowLeft, ArrowRight, Bot, Check, CircleAlert, Clock3, Eye, Phone, Search, Settings2, UserRound, X } from "lucide-react"
import { moveHumanLeadAction, saveBoardColumnsAction, takeHumanLeadAction } from "@/app/dashboard/crm/actions"
import { LeadWorkspacePanel } from "@/components/crm/lead-workspace-panel"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import {
  SALES_MOVE_TARGETS, columnsForBoard, defaultCrmBoardColumns, leadColumnKey, salesSelectValue,
  type CrmBoard, type CrmBoardColumnDTO,
} from "@/lib/crm-board-model"
import { isTerminalStage, type CrmLeadDTO, type HumanStage } from "@/lib/crm-model"

interface Props {
  initialAiLeads: CrmLeadDTO[]
  initialHumanLeads: CrmLeadDTO[]
  initialColumns?: CrmBoardColumnDTO[]
  organizationId: string
  canManageColumns?: boolean
  readOnly?: boolean
  demoMode?: boolean
  currentUserId?: string | null
}

const copy: Record<CrmBoard, { title: string; description: string }> = {
  LUCAS: { title: "CRM Lucas", description: "Marketing automático: recibe, conversa y califica los leads de WhatsApp." },
  SALES: { title: "CRM Ventas", description: "Gestión humana: toma los leads listos para llamada y conduce el cierre comercial." },
}

type SalesFocus = "ALL" | "TAKE" | "NO_CONTACT" | "OVERDUE" | "MINE" | "P1"

function normalizeSearch(value: string) {
  return value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLocaleLowerCase().trim()
}

function isOverdue(dueAt: string | null | undefined) {
  return Boolean(dueAt && new Date(dueAt).getTime() < Date.now())
}

function taskTiming(dueAt: string | null) {
  if (!dueAt) return "Sin fecha"
  const due = new Date(dueAt)
  if (due.getTime() < Date.now()) return "Vencida"
  const today = new Date()
  if (due.toDateString() === today.toDateString()) return `Hoy · ${due.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })}`
  return due.toLocaleDateString("es-CL", { day: "numeric", month: "short" })
}

function matchesSearch(lead: CrmLeadDTO, query: string) {
  const normalized = normalizeSearch(query)
  if (!normalized) return true
  const digits = normalized.replace(/\D/g, "")
  return normalizeSearch(lead.contactName).includes(normalized)
    || normalizeSearch(lead.productInterest ?? "").includes(normalized)
    || (digits.length > 0 && (lead.phoneE164 ?? "").replace(/\D/g, "").includes(digits))
}

function matchesSalesFocus(lead: CrmLeadDTO, focus: SalesFocus, currentUserId?: string | null) {
  if (focus === "ALL") return true
  if (focus === "TAKE") return lead.authority === "AI" && lead.stage === "AI_CALL_REQUESTED"
  if (focus === "NO_CONTACT") return lead.authority === "HUMAN" && lead.stage === "HUMAN_NEW"
  if (focus === "OVERDUE") return lead.authority === "HUMAN" && isOverdue(lead.nextTask?.dueAt)
  if (focus === "MINE") return Boolean(currentUserId && lead.authority === "HUMAN" && lead.assignedTo === currentUserId)
  return lead.priority === "P1"
}

function LeadCard({ lead, board, busy, readOnly, demoMode, take, move, open }: {
  lead: CrmLeadDTO; board: CrmBoard; busy: boolean; readOnly: boolean
  demoMode: boolean
  take: (lead: CrmLeadDTO, openAfterTaking?: boolean) => void; move: (lead: CrmLeadDTO, stage: HumanStage) => void
  open: (lead: CrmLeadDTO) => void
}) {
  const pendingTakeover = board === "SALES" && lead.authority === "AI" && lead.stage === "AI_CALL_REQUESTED"
  const terminal = lead.authority === "HUMAN" && isTerminalStage(lead.stage)
  const awaitingFirstContact = board === "SALES" && lead.authority === "HUMAN" && lead.stage === "HUMAN_NEW"
  const task = lead.nextTask
  return (
    <article className="rounded-xl border border-[#373c35] bg-[#222620] p-3.5 shadow-[0_10px_28px_rgba(0,0,0,0.12)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-medium text-[#ecece7]">{lead.contactName}</p>
          <p className="mt-1 text-xs text-[#7f8981]">Prioridad {lead.priority}</p>
        </div>
        {lead.authority === "AI" ? <Bot className="h-4 w-4 text-[#7aab8d]" /> : <UserRound className="h-4 w-4 text-[#8b91bd]" />}
      </div>
      {lead.productInterest && <p className="mt-3 text-xs leading-5 text-[#aab1aa]">{lead.productInterest}</p>}
      {lead.stage === "DO_NOT_CONTACT" && <span className="mt-3 inline-flex rounded-full bg-[#4a2b2b] px-2 py-1 text-[10px] font-semibold uppercase text-[#e4a2a2]">No contactar</span>}
      {awaitingFirstContact && (
        <span className="mt-3 inline-flex rounded-full bg-[#493d25] px-2 py-1 text-[10px] font-semibold uppercase text-[#ddc48e]">
          Sin contacto registrado
        </span>
      )}
      {board === "SALES" && lead.authority === "HUMAN" && task && (
        <div className={`mt-3 rounded-lg border px-2.5 py-2 text-xs ${isOverdue(task.dueAt) ? "border-[#7b4f48] bg-[#33201f] text-[#e6b3aa]" : "border-[#3c4a3e] bg-[#202921] text-[#b7cbb9]"}`}>
          <div className="flex items-center gap-1.5 font-medium"><Clock3 className="h-3.5 w-3.5" /> {isOverdue(task.dueAt) ? "Acción vencida" : "Próxima acción"}</div>
          <p className="mt-1 truncate">{task.title} · {taskTiming(task.dueAt)}</p>
        </div>
      )}
      {lead.phoneE164 && board === "SALES" && lead.authority === "HUMAN" && (
        <a className="mt-3 flex items-center gap-1.5 text-xs text-[#80b395]" href={`https://wa.me/${lead.phoneE164.replace(/\D/g, "")}`} target="_blank" rel="noreferrer">
          <Phone className="h-3.5 w-3.5" /> Abrir WhatsApp
        </a>
      )}
      {pendingTakeover && (
        <div className="mt-4 border-t border-[#343831] pt-3">
          <p className="mb-2 text-[11px] leading-4 text-[#9da79f]">Listo para llamada. Lucas conserva el control hasta que una persona lo tome.</p>
          <Button type="button" size="sm" disabled={readOnly || busy} onClick={() => take(lead, true)} className="w-full">
            <UserRound className="h-3.5 w-3.5" /> {busy ? "Tomando..." : "Revisar y tomar"}
          </Button>
        </div>
      )}
      {awaitingFirstContact && (
        <div className="mt-4 border-t border-[#343831] pt-3">
          <p className="mb-2 text-[11px] leading-4 text-[#9da79f]">Primero conversa con el cliente y registra ese primer contacto desde su ficha.</p>
          <Button type="button" size="sm" disabled={readOnly || demoMode} onClick={() => open(lead)} className="w-full">
            <Check className="h-3.5 w-3.5" /> Registrar primer contacto
          </Button>
        </div>
      )}
      {board === "SALES" && lead.authority === "HUMAN" && !awaitingFirstContact && !terminal && (
        <label className="mt-4 block border-t border-[#343831] pt-3 text-[11px] uppercase tracking-wide text-[#727b73]">
          Etapa comercial
          <select value={salesSelectValue(lead)} disabled={readOnly || busy || terminal}
            onChange={(event) => move(lead, event.target.value as HumanStage)}
            className="mt-1.5 w-full rounded-md border border-[#3b4139] bg-[#191c18] px-2 py-2 text-xs text-[#dfe1dc]">
            {SALES_MOVE_TARGETS.map((target) => <option key={target.stage} value={target.stage}>{target.label}</option>)}
          </select>
        </label>
      )}
      {!pendingTakeover && !awaitingFirstContact && <Button type="button" size="sm" variant={terminal ? "ghost" : "outline"} disabled={demoMode} title={demoMode ? "La ficha operativa está disponible al ingresar al CRM." : undefined}
        onClick={() => open(lead)} className="mt-3 w-full text-[#b9c4b8]">
        <Eye className="h-3.5 w-3.5" /> {terminal ? "Ver ficha" : "Abrir ficha"}
      </Button>}
    </article>
  )
}

export function DualCrmBoard({ initialAiLeads, initialHumanLeads, initialColumns, organizationId, canManageColumns = false, readOnly = false, demoMode = false, currentUserId = null }: Props) {
  const [board, setBoard] = useState<CrmBoard>("SALES")
  const [aiLeads, setAiLeads] = useState(initialAiLeads)
  const [humanLeads, setHumanLeads] = useState(initialHumanLeads)
  const [columns, setColumns] = useState(initialColumns?.length ? initialColumns : defaultCrmBoardColumns())
  const [draft, setDraft] = useState<CrmBoardColumnDTO[] | null>(null)
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [selectedLead, setSelectedLead] = useState<CrmLeadDTO | null>(null)
  const [search, setSearch] = useState("")
  const [salesFocus, setSalesFocus] = useState<SalesFocus>("ALL")
  const [isPending, startTransition] = useTransition()
  const { toast } = useToast()
  const visibleColumns = useMemo(() => columnsForBoard(draft ?? columns, board), [board, columns, draft])
  const salesLeads = useMemo(() => [...aiLeads, ...humanLeads].filter((lead) => leadColumnKey(lead, "SALES") !== null), [aiLeads, humanLeads])
  const leads = useMemo(() => {
    const source = board === "LUCAS" ? aiLeads : salesLeads
    return source.filter((lead) => matchesSearch(lead, search) && (board !== "SALES" || matchesSalesFocus(lead, salesFocus, currentUserId)))
  }, [aiLeads, board, currentUserId, salesFocus, salesLeads, search])
  const salesCounts = useMemo(() => ({
    all: salesLeads.length,
    take: salesLeads.filter((lead) => matchesSalesFocus(lead, "TAKE", currentUserId)).length,
    noContact: salesLeads.filter((lead) => matchesSalesFocus(lead, "NO_CONTACT", currentUserId)).length,
    overdue: salesLeads.filter((lead) => matchesSalesFocus(lead, "OVERDUE", currentUserId)).length,
    mine: salesLeads.filter((lead) => matchesSalesFocus(lead, "MINE", currentUserId)).length,
    p1: salesLeads.filter((lead) => matchesSalesFocus(lead, "P1", currentUserId)).length,
  }), [currentUserId, salesLeads])

  const take = (lead: CrmLeadDTO, openAfterTaking = false) => {
    const humanLead = { ...lead, authority: "HUMAN" as const, stage: "HUMAN_NEW" as const, assignedTo: currentUserId, nextTask: null }
    if (demoMode) {
      setAiLeads((items) => items.filter((item) => item.id !== lead.id))
      setHumanLeads((items) => [humanLead, ...items])
      toast({ title: "Lead tomado en la demostración. Lucas dejó de intervenir." })
      return
    }
    setPendingId(lead.id)
    startTransition(async () => {
      const result = await takeHumanLeadAction({ leadId: lead.id, reason: "Toma explícita desde CRM Ventas" })
      setPendingId(null)
      if (!result.ok) {
        toast({ title: result.error, variant: "destructive" })
        return
      }
      setAiLeads((items) => items.filter((item) => item.id !== lead.id))
      setHumanLeads((items) => [humanLead, ...items])
      if (openAfterTaking) setSelectedLead(humanLead)
      toast({ title: "Lead tomado. Lucas dejó de intervenir." })
    })
  }

  const move = (lead: CrmLeadDTO, nextStage: HumanStage) => {
    const previous = humanLeads
    setHumanLeads((items) => items.map((item) => item.id === lead.id ? { ...item, stage: nextStage } : item))
    if (demoMode) {
      toast({ title: "Lead movido en la demostración." })
      return
    }
    setPendingId(lead.id)
    startTransition(async () => {
      const result = await moveHumanLeadAction({ leadId: lead.id, nextStage })
      setPendingId(null)
      if (!result.ok) { setHumanLeads(previous); toast({ title: result.error, variant: "destructive" }) }
    })
  }

  const markContacted = (leadId: string) => {
    const now = new Date().toISOString()
    setHumanLeads((items) => items.map((item) => item.id === leadId
      ? { ...item, stage: "HUMAN_CONTACTING", updatedAt: now }
      : item))
    setSelectedLead((current) => current?.id === leadId
      ? { ...current, stage: "HUMAN_CONTACTING", updatedAt: now }
      : current)
  }

  const updateDraft = (key: string, patch: Partial<CrmBoardColumnDTO>) =>
    setDraft((current) => current?.map((column) => column.key === key ? { ...column, ...patch } : column) ?? null)

  const shiftColumn = (index: number, direction: -1 | 1) => {
    if (!draft) return
    const scoped = columnsForBoard(draft, board)
    const target = index + direction
    if (target < 0 || target >= scoped.length) return
    ;[scoped[index], scoped[target]] = [scoped[target], scoped[index]]
    const positions = new Map(scoped.map((column, position) => [column.key, position]))
    setDraft(draft.map((column) => column.board === board ? { ...column, position: positions.get(column.key) ?? column.position } : column))
  }

  const save = () => {
    if (!draft) return
    const scoped = columnsForBoard(draft, board)
    if (demoMode) {
      setColumns(draft); setDraft(null); toast({ title: "Columnas actualizadas en la demostración." })
      return
    }
    startTransition(async () => {
      const result = await saveBoardColumnsAction({ organizationId, board, columns: scoped })
      if (!result.ok) {
        toast({ title: result.error, variant: "destructive" })
        return
      }
      setColumns(draft); setDraft(null); toast({ title: "Columnas actualizadas." })
    })
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 rounded-2xl border border-[#343b34] bg-[#1b1f1b] p-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex rounded-xl bg-[#141714] p-1">
          {(["LUCAS", "SALES"] as const).map((value) => (
            <button key={value} type="button" onClick={() => { setBoard(value); setDraft(null); setSalesFocus("ALL") }}
              className={`rounded-lg px-4 py-2.5 text-sm font-medium ${board === value ? "bg-[#2b352d] text-[#e8ece8] shadow" : "text-[#858e86]"}`}>
              {copy[value].title}
            </button>
          ))}
        </div>
        <div className="flex items-center justify-between gap-4">
          <p className="max-w-xl text-xs leading-5 text-[#858e86]">{copy[board].description}</p>
          {canManageColumns && !readOnly && !draft && <Button size="sm" variant="outline" onClick={() => setDraft(columns.map((column) => ({ ...column })))}><Settings2 className="h-3.5 w-3.5" /> Editar columnas</Button>}
        </div>
      </div>

      <section className="rounded-2xl border border-[#343b34] bg-[#1b1f1b] p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative w-full lg:max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#778078]" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por nombre, teléfono o interés"
              className="h-10 w-full rounded-lg border border-[#3b4239] bg-[#151815] pl-9 pr-3 text-sm text-[#e5e8e3] placeholder:text-[#687168]" />
          </div>
          {board === "SALES" && <div className="flex flex-wrap items-center gap-2">
            {([
              ["ALL", "Todos", salesCounts.all],
              ["TAKE", "Para tomar", salesCounts.take],
              ["NO_CONTACT", "Sin contacto", salesCounts.noContact],
              ["OVERDUE", "Vencidas", salesCounts.overdue],
              ["MINE", "Mis leads", salesCounts.mine],
              ["P1", "P1", salesCounts.p1],
            ] as const).map(([value, label, count]) => <button key={value} type="button" onClick={() => setSalesFocus(value)}
              className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${salesFocus === value ? "border-[#5b8068] bg-[#26382b] text-[#c9e0ce]" : "border-[#3c433b] bg-[#20241f] text-[#98a198] hover:bg-[#2a3029]"}`}>
              {label} <span className="ml-1 opacity-70">{count}</span>
            </button>)}
          </div>}
        </div>
        {board === "SALES" && <p className="mt-3 flex items-center gap-2 text-xs text-[#98a199]">
          <CircleAlert className="h-3.5 w-3.5 text-[#b89a5d]" />
          {salesCounts.take > 0 ? `${salesCounts.take} lead${salesCounts.take === 1 ? "" : "s"} listo${salesCounts.take === 1 ? "" : "s"} para que una persona revise y tome.`
            : salesCounts.noContact > 0 ? `${salesCounts.noContact} lead${salesCounts.noContact === 1 ? "" : "s"} bajo atención humana todavía no tiene${salesCounts.noContact === 1 ? "" : "n"} un contacto registrado.`
              : "No hay una acción urgente en la cola de Ventas."}
        </p>}
      </section>

      {draft && (
        <section className="rounded-2xl border border-[#4a5148] bg-[#20241f] p-4">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div><h2 className="text-sm font-semibold text-[#e7e8e2]">Personalizar {copy[board].title}</h2><p className="mt-1 text-xs text-[#89938b]">Cambia nombres, colores y orden. La lógica queda protegida.</p></div>
            <div className="flex gap-2"><Button size="sm" variant="ghost" onClick={() => setDraft(null)}><X className="h-4 w-4" /> Cancelar</Button><Button size="sm" disabled={isPending} onClick={save}><Check className="h-4 w-4" /> Guardar</Button></div>
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {visibleColumns.map((column, index) => (
              <div key={column.key} className="rounded-xl border border-[#3a4039] bg-[#191c18] p-3"><div className="flex items-center gap-2">
                <input aria-label={`Color de ${column.label}`} type="color" value={column.color} onChange={(event) => updateDraft(column.key, { color: event.target.value })} className="h-9 w-10" />
                <input value={column.label} maxLength={48} onChange={(event) => updateDraft(column.key, { label: event.target.value })} className="min-w-0 flex-1 rounded-md border border-[#3b4139] bg-[#151815] px-2.5 py-2 text-sm text-[#e2e4df]" />
                <button aria-label="Mover a la izquierda" disabled={index === 0} onClick={() => shiftColumn(index, -1)}><ArrowLeft className="h-4 w-4" /></button>
                <button aria-label="Mover a la derecha" disabled={index === visibleColumns.length - 1} onClick={() => shiftColumn(index, 1)}><ArrowRight className="h-4 w-4" /></button>
              </div></div>
            ))}
          </div>
        </section>
      )}

      <div className="overflow-x-auto pb-4">
        <div className={`grid gap-4 ${board === "LUCAS" ? "min-w-[860px] grid-cols-3" : "min-w-[1480px] grid-cols-6"}`}>
          {visibleColumns.map((column) => {
            const items = leads.filter((lead) => leadColumnKey(lead, board) === column.key)
            return <section key={column.key} className="overflow-hidden rounded-2xl border border-[#343831] bg-[#1d201c]">
              <div className="h-1" style={{ backgroundColor: column.color }} />
              <header className="flex items-center justify-between border-b border-[#343831] px-4 py-3.5"><div><h2 className="text-sm font-medium text-[#d7d9d3]">{column.label}</h2>{board === "LUCAS" && <p className="mt-1 text-[10px] uppercase tracking-wider text-[#6f7d72]">Automático</p>}</div><span className="rounded-full bg-[#292e28] px-2 py-0.5 text-xs text-[#9ca49d]">{items.length}</span></header>
              <div className="min-h-[260px] space-y-3 p-3">{items.length === 0 && <p className="px-2 py-8 text-center text-xs text-[#697169]">Sin leads en esta etapa</p>}{items.map((lead) => <LeadCard key={lead.id} lead={lead} board={board} busy={isPending && pendingId === lead.id} readOnly={readOnly} demoMode={demoMode} take={take} move={move} open={setSelectedLead} />)}</div>
            </section>
          })}
        </div>
      </div>
      <LeadWorkspacePanel lead={selectedLead} readOnly={readOnly || demoMode} onClose={() => setSelectedLead(null)} onContactRecorded={markContacted} />
    </div>
  )
}
