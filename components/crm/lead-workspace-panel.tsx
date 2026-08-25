"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { CalendarClock, CheckCircle2, ChevronDown, ChevronUp, ClipboardList, FileText, LoaderCircle, MessageCircle, StickyNote, X } from "lucide-react"
import {
  addLeadNoteAction,
  completeLeadTaskAction,
  createLeadTaskAction,
  getLeadWorkspaceAction,
  recordHumanContactAction,
} from "@/app/dashboard/crm/actions"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import type { CrmLeadDTO } from "@/lib/crm-model"
import type { CrmCommercialProfileDTO, CrmLeadWorkspaceDTO } from "@/lib/crm-workspace-model"

interface Props {
  lead: CrmLeadDTO | null
  readOnly?: boolean
  onClose: () => void
  onContactRecorded: (leadId: string) => void
}

function formatDate(value: string | null) {
  if (!value) return "Sin fecha"
  return new Intl.DateTimeFormat("es-CL", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value))
}

function yesNo(value: boolean | null) {
  if (value === null) return "Sin dato"
  return value ? "Sí" : "No"
}

function commercialText(value: string | null) {
  return value?.trim() || "Sin dato"
}

function consumption(profile: CrmCommercialProfileDTO) {
  if (profile.monthlyConsumptionClp !== null) {
    return new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 })
      .format(profile.monthlyConsumptionClp)
  }
  return commercialText(profile.consumptionRange)
}

function CommercialField({ label, value }: { label: string; value: string }) {
  return <div><p className="text-xs text-[#7f8981]">{label}</p><p className="mt-1 break-words text-[#d8dcd5]">{value}</p></div>
}

function toLocalInput(value: Date) {
  const offset = value.getTimezoneOffset() * 60_000
  return new Date(value.getTime() - offset).toISOString().slice(0, 16)
}

function activityLabel(eventType: string) {
  const labels: Record<string, string> = {
    LEGACY_IMPORTED: "Lead importado desde el flujo anterior",
    AI_STAGE_CHANGED: "Lucas actualizó la calificación",
    HUMAN_TAKEOVER: "Un vendedor tomó el lead",
    HUMAN_STAGE_CHANGED: "Etapa comercial actualizada",
    HUMAN_CONTACT_RECORDED: "Contacto humano registrado",
    RETURNED_TO_AI: "Lead devuelto a Lucas",
  }
  return labels[eventType] ?? eventType.replaceAll("_", " ")
}

function nextStepCopy(lead: CrmLeadDTO, openTasks: number) {
  if (lead.authority === "AI" && lead.stage === "AI_CALL_REQUESTED") {
    return "Lucas dejó una solicitud de llamada. Revisa la ficha y toma la conversación desde el tablero de Ventas cuando estés listo."
  }
  if (lead.authority === "AI") return "Lucas sigue calificando este lead. La atención humana se habilita cuando solicite una llamada."
  if (lead.stage === "HUMAN_NEW") {
    return "Aún no hay un contacto humano registrado. Conversa por WhatsApp o llamada y luego usa “Registrar contacto”."
  }
  if (lead.stage === "WON" || lead.stage === "LOST" || lead.stage === "DO_NOT_CONTACT") {
    return "Este lead está cerrado. El historial queda disponible para consulta, sin acciones comerciales pendientes."
  }
  return openTasks > 0
    ? "Revisa y completa la próxima acción pendiente antes de avanzar la etapa comercial."
    : "Registra una próxima acción para que el lead no quede sin seguimiento."
}

function Timeline({ workspace }: { workspace: CrmLeadWorkspaceDTO }) {
  const entries = useMemo(() => [
    ...workspace.activities.map((item) => ({ id: `activity-${item.id}`, at: item.createdAt, icon: "activity", text: activityLabel(item.eventType) })),
    ...workspace.notes.map((item) => ({ id: `note-${item.id}`, at: item.createdAt, icon: "note", text: item.body })),
    ...workspace.tasks.map((item) => ({
      id: `task-${item.id}`, at: item.updatedAt, icon: "task",
      text: `${item.status === "DONE" ? "Tarea completada" : "Próxima acción"}: ${item.title}`,
    })),
  ].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()).slice(0, 30), [workspace])

  if (entries.length === 0) return <p className="py-5 text-sm text-[#7f8981]">Aún no hay historial registrado.</p>
  return <ol className="space-y-3">
    {entries.map((entry) => (
      <li key={entry.id} className="flex gap-3 border-l border-[#3a4138] pl-3">
        {entry.icon === "note" ? <StickyNote className="mt-0.5 h-4 w-4 shrink-0 text-[#d2b474]" /> : entry.icon === "task" ? <ClipboardList className="mt-0.5 h-4 w-4 shrink-0 text-[#8c9fca]" /> : <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#79ab8b]" />}
        <div className="min-w-0"><p className="text-sm leading-5 text-[#d6d9d3]">{entry.text}</p><p className="mt-1 text-[11px] text-[#788178]">{formatDate(entry.at)}</p></div>
      </li>
    ))}
  </ol>
}

function WhatsAppConversation({ workspace }: { workspace: CrmLeadWorkspaceDTO }) {
  if (workspace.conversation.length === 0) {
    return <div className="rounded-xl bg-[#efeae2] px-4 py-8 text-center text-sm text-[#667069]">No encontramos mensajes guardados para este contacto.</div>
  }

  return (
    <div
      className="max-h-[480px] space-y-2 overflow-y-auto rounded-xl border border-[#c9c3b8] px-3 py-4 sm:px-4"
      style={{
        backgroundColor: "#efeae2",
        backgroundImage: "radial-gradient(circle at 20px 20px, rgba(80, 94, 82, 0.06) 1px, transparent 1.5px)",
        backgroundSize: "28px 28px",
      }}
      aria-label="Conversación de WhatsApp en modo solo lectura"
    >
      {workspace.conversation.map((message) => {
        const fromLucas = message.speaker === "LUCAS"
        return (
          <div key={message.id} className={`flex ${fromLucas ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[86%] rounded-lg px-3 py-2 shadow-sm ${fromLucas ? "rounded-tr-sm bg-[#d9fdd3] text-[#172019]" : "rounded-tl-sm bg-white text-[#202522]"}`}>
              <p className={`mb-1 text-[10px] font-semibold ${fromLucas ? "text-[#2f7750]" : "text-[#53605a]"}`}>{fromLucas ? "Lucas" : "Cliente"}</p>
              <p className="whitespace-pre-wrap break-words text-[13px] leading-[1.45]">{message.content}</p>
              <p className="mt-1 text-right text-[9px] text-[#7b837e]">#{message.sequenceNumber}</p>
            </div>
          </div>
        )
      })}
    </div>
  )
}

export function LeadWorkspacePanel(props: Props) {
  if (!props.lead) return null
  return <LeadWorkspaceContent key={props.lead.id} {...props} lead={props.lead} />
}

function LeadWorkspaceContent({ lead, readOnly = false, onClose, onContactRecorded }: Omit<Props, "lead"> & { lead: CrmLeadDTO }) {
  const [workspace, setWorkspace] = useState<CrmLeadWorkspaceDTO | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [note, setNote] = useState("")
  const [contactNote, setContactNote] = useState("")
  const [channel, setChannel] = useState<"WHATSAPP" | "LLAMADA" | "OTRO">("WHATSAPP")
  const [taskTitle, setTaskTitle] = useState("")
  const [taskDueAt, setTaskDueAt] = useState(() => toLocalInput(new Date(Date.now() + 86_400_000)))
  const [conversationOpen, setConversationOpen] = useState(false)
  const { toast } = useToast()

  const reload = useCallback(async () => {
    setLoading(true)
    const result = await getLeadWorkspaceAction({ leadId: lead.id })
    setLoading(false)
    if (!result.ok) {
      toast({ title: result.error, variant: "destructive" })
      return
    }
    setWorkspace(result.workspace)
  }, [lead, toast])

  useEffect(() => {
    const timer = window.setTimeout(() => { void reload() }, 0)
    return () => window.clearTimeout(timer)
  }, [reload])
  const humanControlled = lead.authority === "HUMAN"
  const canEdit = humanControlled && !readOnly
  const openTasks = workspace?.tasks.filter((task) => task.status === "OPEN") ?? []

  const saveNote = async () => {
    if (!note.trim()) return
    setSaving(true)
    const result = await addLeadNoteAction({ leadId: lead.id, body: note })
    setSaving(false)
    if (!result.ok) return toast({ title: result.error, variant: "destructive" })
    setNote("")
    toast({ title: "Nota guardada." })
    await reload()
  }

  const registerContact = async () => {
    setSaving(true)
    const result = await recordHumanContactAction({
      leadId: lead.id, operationId: crypto.randomUUID(), channel,
      note: contactNote.trim() || undefined,
    })
    setSaving(false)
    if (!result.ok) return toast({ title: result.error, variant: "destructive" })
    setContactNote("")
    onContactRecorded(lead.id)
    toast({ title: "Contacto registrado y auditado." })
    await reload()
  }

  const addTask = async () => {
    if (!taskTitle.trim()) return
    setSaving(true)
    const result = await createLeadTaskAction({
      leadId: lead.id, title: taskTitle,
      dueAt: taskDueAt ? new Date(taskDueAt).toISOString() : null,
    })
    setSaving(false)
    if (!result.ok) return toast({ title: result.error, variant: "destructive" })
    setTaskTitle("")
    toast({ title: "Próxima acción creada." })
    await reload()
  }

  const completeTask = async (taskId: string) => {
    setSaving(true)
    const result = await completeLeadTaskAction({ leadId: lead.id, taskId })
    setSaving(false)
    if (!result.ok) return toast({ title: result.error, variant: "destructive" })
    await reload()
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 p-0" role="dialog" aria-modal="true" aria-label={`Ficha de ${lead.contactName}`}>
      <button type="button" aria-label="Cerrar ficha" className="absolute inset-0 cursor-default" onClick={onClose} />
      <aside className="relative h-full w-full max-w-xl overflow-y-auto border-l border-[#3b4239] bg-[#171a16] shadow-2xl">
        <header className="sticky top-0 z-10 flex items-start justify-between border-b border-[#343b34] bg-[#1b1f1b] px-6 py-5">
          <div className="min-w-0"><p className="text-xs uppercase tracking-[0.16em] text-[#7e8b80]">Ficha comercial</p><h2 className="mt-1 truncate text-xl font-semibold text-[#eef0ea]">{lead.contactName}</h2><p className="mt-1 text-sm text-[#909990]">Prioridad {lead.priority} · {lead.authority === "AI" ? "Lucas a cargo" : "Equipo humano a cargo"}</p></div>
          <Button type="button" size="icon" variant="ghost" onClick={onClose} aria-label="Cerrar"><X className="h-5 w-5" /></Button>
        </header>

        <div className="space-y-7 p-6">
          {loading && !workspace ? <div className="flex items-center gap-2 text-sm text-[#9ea69d]"><LoaderCircle className="h-4 w-4 animate-spin" /> Cargando ficha…</div> : <>
            <section className="grid grid-cols-2 gap-3 rounded-xl border border-[#363d35] bg-[#20241f] p-4 text-sm">
              <div><p className="text-xs text-[#7f8981]">Teléfono</p><p className="mt-1 text-[#d8dcd5]">{lead.phoneE164 ?? "Sin dato"}</p></div>
              <div><p className="text-xs text-[#7f8981]">Interés</p><p className="mt-1 text-[#d8dcd5]">{lead.productInterest ?? "Sin dato"}</p></div>
              <div><p className="text-xs text-[#7f8981]">Calificación</p><p className="mt-1 text-[#d8dcd5]">{workspace?.qualificationStatus ?? "Sin dato"}</p></div>
              <div><p className="text-xs text-[#7f8981]">Última actualización</p><p className="mt-1 text-[#d8dcd5]">{formatDate(lead.updatedAt)}</p></div>
            </section>

            <section className="rounded-xl border border-[#3c493d] bg-[#1d251e] p-4">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div><p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#8cb393]">Información comercial de Lucas</p><p className="mt-1 text-xs text-[#778078]">Datos capturados durante la conversación de WhatsApp.</p></div>
                {workspace?.commercialProfile?.sourceUpdatedAt && <p className="text-right text-[10px] text-[#6f786f]">Actualizado<br />{formatDate(workspace.commercialProfile.sourceUpdatedAt)}</p>}
              </div>
              {workspace?.commercialProfile ? <>
                <div className="grid grid-cols-2 gap-x-4 gap-y-4 text-sm">
                  <CommercialField label="Comuna" value={commercialText(workspace.commercialProfile.commune)} />
                  <CommercialField label="Consumo mensual" value={consumption(workspace.commercialProfile)} />
                  <CommercialField label="Es propietario" value={yesNo(workspace.commercialProfile.owner)} />
                  <CommercialField label="Tipo de techo" value={commercialText(workspace.commercialProfile.roofType)} />
                  <CommercialField label="Tipo de vivienda" value={commercialText(workspace.commercialProfile.homeType)} />
                  <CommercialField label="Tipo de proyecto" value={commercialText(workspace.commercialProfile.projectType)} />
                  <CommercialField label="Interés confirmado" value={yesNo(workspace.commercialProfile.interested)} />
                  <CommercialField label="Califica" value={yesNo(workspace.commercialProfile.qualified)} />
                  <CommercialField label="Acepta llamada" value={yesNo(workspace.commercialProfile.acceptsCall)} />
                  <CommercialField label="Urgencia" value={commercialText(workspace.commercialProfile.urgency)} />
                  <CommercialField label="Día preferido" value={commercialText(workspace.commercialProfile.preferredDay)} />
                  <CommercialField label="Horario preferido" value={commercialText(workspace.commercialProfile.preferredTime)} />
                  <CommercialField label="Fase de Lucas" value={commercialText(workspace.commercialProfile.phase)} />
                  <CommercialField label="Dato pendiente" value={commercialText(workspace.commercialProfile.missingField)} />
                  <CommercialField label="Cotiza otras opciones" value={yesNo(workspace.commercialProfile.quotingOthers)} />
                  <CommercialField label="Interés alto" value={yesNo(workspace.commercialProfile.enthusiastic)} />
                  <CommercialField label="Pidió reunión" value={yesNo(workspace.commercialProfile.requestedMeeting)} />
                </div>
                {workspace.commercialProfile.handoffReason && <div className="mt-4 border-t border-[#39423a] pt-3"><CommercialField label="Motivo de derivación" value={workspace.commercialProfile.handoffReason} /></div>}
              </> : <p className="text-sm text-[#858e86]">Este lead todavía no tiene información comercial registrada por Lucas.</p>}
            </section>

            <section className="rounded-xl border border-[#4b594b] bg-[#1e291f] p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#8cb393]">Siguiente paso</p>
              <p className="mt-2 text-sm leading-6 text-[#d6dfd4]">{nextStepCopy(lead, openTasks.length)}</p>
            </section>

            <section className="rounded-xl border border-[#39443d] bg-[#1c221e] p-4">
              <button
                type="button"
                className="flex w-full items-center justify-between gap-3 text-left"
                onClick={() => setConversationOpen((current) => !current)}
                aria-expanded={conversationOpen}
              >
                <span className="flex items-center gap-3">
                  <span className="rounded-full bg-[#245c45] p-2 text-[#d9fdd3]"><MessageCircle className="h-4 w-4" /></span>
                  <span><span className="block font-medium text-[#e4e9e2]">Conversación con Lucas</span><span className="mt-0.5 block text-xs text-[#879189]">{workspace?.conversation.length ?? 0} mensajes · solo lectura</span></span>
                </span>
                {conversationOpen ? <ChevronUp className="h-4 w-4 text-[#8e9990]" /> : <ChevronDown className="h-4 w-4 text-[#8e9990]" />}
              </button>
              {conversationOpen && workspace && <div className="mt-4"><WhatsAppConversation workspace={workspace} /><p className="mt-2 text-center text-[10px] text-[#778078]">Vista histórica. Desde aquí no se pueden enviar ni modificar mensajes.</p></div>}
            </section>

            {!humanControlled && <section className="rounded-xl border border-[#785c30] bg-[#332718] p-4 text-sm text-[#e0c68f]">Lucas sigue a cargo. La ficha se puede revisar, pero las notas, tareas y contacto se habilitan cuando una persona toma el lead.</section>}

            {canEdit && <section className="space-y-3 rounded-xl border border-[#3e4d3d] bg-[#1d261d] p-4"><div className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-[#81ba90]" /><h3 className="font-medium text-[#e3e7df]">Registrar contacto real</h3></div><div className="flex gap-2"><select value={channel} onChange={(event) => setChannel(event.target.value as typeof channel)} className="rounded-md border border-[#475145] bg-[#151915] px-2 text-sm text-[#e0e4dc]"><option value="WHATSAPP">WhatsApp</option><option value="LLAMADA">Llamada</option><option value="OTRO">Otro</option></select><Button type="button" disabled={saving} onClick={registerContact} className="flex-1">{saving ? "Guardando…" : "Registrar contacto"}</Button></div><textarea value={contactNote} onChange={(event) => setContactNote(event.target.value)} maxLength={4000} placeholder="Nota opcional de esta conversación" className="min-h-20 w-full rounded-md border border-[#475145] bg-[#151915] p-2.5 text-sm text-[#e0e4dc] placeholder:text-[#6f786f]" /></section>}

            {canEdit && <section className="space-y-3"><div className="flex items-center gap-2"><CalendarClock className="h-4 w-4 text-[#8b9dca]" /><h3 className="font-medium text-[#e3e7df]">Próxima acción</h3></div>{openTasks.length > 0 && <div className="space-y-2">{openTasks.map((task) => <div key={task.id} className="flex items-center justify-between gap-3 rounded-lg border border-[#353d35] bg-[#1e221d] p-3"><div><p className="text-sm text-[#d9ddd6]">{task.title}</p><p className="mt-1 text-xs text-[#879087]">{formatDate(task.dueAt)}</p></div><Button type="button" size="sm" variant="outline" disabled={saving} onClick={() => completeTask(task.id)}>Hecha</Button></div>)}</div>}<input value={taskTitle} onChange={(event) => setTaskTitle(event.target.value)} maxLength={240} placeholder="Ej.: Llamar para revisar propuesta" className="w-full rounded-md border border-[#3c453c] bg-[#151915] px-3 py-2.5 text-sm text-[#e0e4dc] placeholder:text-[#6f786f]" /><input type="datetime-local" value={taskDueAt} onChange={(event) => setTaskDueAt(event.target.value)} className="w-full rounded-md border border-[#3c453c] bg-[#151915] px-3 py-2.5 text-sm text-[#e0e4dc]" /><Button type="button" variant="outline" disabled={saving || !taskTitle.trim()} onClick={addTask}>Crear próxima acción</Button></section>}

            {canEdit && <section className="space-y-3"><div className="flex items-center gap-2"><StickyNote className="h-4 w-4 text-[#d2b474]" /><h3 className="font-medium text-[#e3e7df]">Nota interna</h3></div><textarea value={note} onChange={(event) => setNote(event.target.value)} maxLength={4000} placeholder="Contexto útil para el equipo; el cliente no ve esta nota." className="min-h-24 w-full rounded-md border border-[#3c453c] bg-[#151915] p-2.5 text-sm text-[#e0e4dc] placeholder:text-[#6f786f]" /><Button type="button" variant="outline" disabled={saving || !note.trim()} onClick={saveNote}><FileText className="h-4 w-4" /> Guardar nota</Button></section>}

            <section><div className="mb-3 flex items-center gap-2"><ClipboardList className="h-4 w-4 text-[#8b9dca]" /><h3 className="font-medium text-[#e3e7df]">Historial</h3></div>{workspace ? <Timeline workspace={workspace} /> : <p className="text-sm text-[#7f8981]">No se pudo cargar el historial.</p>}</section>
          </>}
        </div>
      </aside>
    </div>
  )
}
