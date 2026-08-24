"use client"

import { useMemo, useState } from "react"
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  MessageCircle,
  PauseCircle,
  PlayCircle,
  Search,
  UsersRound,
} from "lucide-react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useToast } from "@/hooks/use-toast"
import {
  getAppointmentDate,
  getLastActivity,
  getVisibleLeadStatus,
  visibleStatusLabels,
  type Cliente,
  type LeadFilter,
  type VisibleLeadStatus,
} from "@/lib/dashboard-model"
import { updateClienteStatus } from "@/lib/supabase"

const ITEMS_PER_PAGE = 20

const statusDotStyles: Record<VisibleLeadStatus, string> = {
  en_atencion: "bg-[#6595b0]",
  seguimiento: "bg-[#c7994f]",
  agendado: "bg-[#66a981]",
  atencion_humana: "bg-[#9071aa]",
  cerrado: "bg-[#737b74]",
}

const statusTextStyles: Record<VisibleLeadStatus, string> = {
  en_atencion: "text-[#8eb3c6]",
  seguimiento: "text-[#d6b677]",
  agendado: "text-[#8bc6a1]",
  atencion_humana: "text-[#b69dca]",
  cerrado: "text-[#969d97]",
}

const dateTimeFormatter = new Intl.DateTimeFormat("es-CL", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
})

const appointmentFormatter = new Intl.DateTimeFormat("es-CL", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
})

function formatDate(value?: string | null, formatter = dateTimeFormatter) {
  if (!value) return "—"
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? "—" : formatter.format(date)
}

function normalizeSearch(value?: string | null) {
  return (
    value
      ?.normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/\s/g, "") ?? ""
  )
}

function whatsappNumber(rawPhone?: string | null) {
  const digits = rawPhone?.replace(/\D/g, "") ?? ""
  if (!digits) return null

  const dialCode = process.env.NEXT_PUBLIC_COUNTRY_DIAL_CODE || "56"
  if (digits.startsWith(dialCode)) return digits
  return `${dialCode}${digits.replace(/^0+/, "")}`
}

interface LeadsTableProps {
  clientes: Cliente[]
  loading: boolean
  onClientesChange: (clientes: Cliente[]) => void
  statusFilter: LeadFilter
  onStatusFilterChange: (filter: LeadFilter) => void
}

export function LeadsTable({
  clientes,
  loading,
  onClientesChange,
  statusFilter,
  onStatusFilterChange,
}: LeadsTableProps) {
  const [currentPage, setCurrentPage] = useState(1)
  const [search, setSearch] = useState("")
  const { toast } = useToast()

  const filteredClientes = useMemo(() => {
    const normalizedQuery = normalizeSearch(search)
    return clientes.filter((cliente) => {
      const matchesStatus = statusFilter === "todos" || getVisibleLeadStatus(cliente) === statusFilter
      const matchesSearch =
        !normalizedQuery ||
        normalizeSearch(cliente.nome).includes(normalizedQuery) ||
        normalizeSearch(cliente.telefone).includes(normalizedQuery)
      return matchesStatus && matchesSearch
    })
  }, [clientes, search, statusFilter])

  const totalPages = Math.max(1, Math.ceil(filteredClientes.length / ITEMS_PER_PAGE))
  const safePage = Math.min(currentPage, totalPages)
  const startIndex = (safePage - 1) * ITEMS_PER_PAGE
  const currentClientes = filteredClientes.slice(startIndex, startIndex + ITEMS_PER_PAGE)

  const setFilter = (filter: LeadFilter) => {
    onStatusFilterChange(filter)
    setCurrentPage(1)
  }

  const openWhatsApp = (cliente: Cliente) => {
    const phone = whatsappNumber(cliente.telefone)
    if (!phone) return
    window.open(`https://wa.me/${phone}`, "_blank", "noopener,noreferrer")
  }

  const handleToggleConversation = async (cliente: Cliente, openAfterTaking = false) => {
    const nextHumanState = !cliente.trava
    const success = await updateClienteStatus(cliente.id, nextHumanState)

    if (!success) {
      toast({
        title: "No se pudo actualizar la conversación",
        description: "Inténtalo nuevamente.",
        variant: "destructive",
      })
      return
    }

    onClientesChange(clientes.map((item) => (item.id === cliente.id ? { ...item, trava: nextHumanState } : item)))
    toast({
      title: nextHumanState ? "La conversación ahora está en tus manos" : "Conversación devuelta al agente",
      description: nextHumanState
        ? "La atención automática quedó pausada para este contacto."
        : "El agente puede continuar atendiendo.",
    })

    if (nextHumanState && openAfterTaking) openWhatsApp(cliente)
  }

  const filters: Array<{ value: LeadFilter; label: string }> = [
    { value: "todos", label: "Todos" },
    { value: "agendado", label: "Agendados" },
    { value: "seguimiento", label: "Por retomar" },
    { value: "cerrado", label: "Finalizados" },
  ]

  const conversationActions = (cliente: Cliente, isClosed: boolean) => {
    if (isClosed) {
      return (
        <Button variant="outline" size="sm" onClick={() => openWhatsApp(cliente)} disabled={!cliente.telefone}>
          <MessageCircle className="h-4 w-4" />
          Ver chat
        </Button>
      )
    }

    return (
      <div className="flex flex-wrap items-center justify-end gap-2">
        {cliente.trava && (
          <Button variant="outline" size="sm" onClick={() => openWhatsApp(cliente)} disabled={!cliente.telefone}>
            <MessageCircle className="h-4 w-4" />
            WhatsApp
          </Button>
        )}

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              size="sm"
              variant={cliente.trava ? "secondary" : "default"}
              className={
                cliente.trava
                  ? "text-[#9bbca8]"
                  : "bg-[#507c63] text-[#f0f0ea] shadow-sm hover:bg-[#5b8a6f]"
              }
            >
              {cliente.trava ? <PlayCircle className="h-4 w-4" /> : <PauseCircle className="h-4 w-4" />}
              {cliente.trava ? "Devolver a IA" : "Tomar y abrir"}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {cliente.trava ? "¿Devolver la conversación al agente?" : "¿Tomar esta conversación?"}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {cliente.trava
                  ? "El agente podrá continuar atendiendo a este contacto."
                  : "Pausaremos al agente y abriremos WhatsApp para que tu equipo responda."}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={() => handleToggleConversation(cliente, !cliente.trava)}>
                {cliente.trava ? "Devolver a la IA" : "Tomar y abrir WhatsApp"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    )
  }

  return (
    <Card className="overflow-hidden rounded-xl border-[#343831] bg-[#1d201c] shadow-none">
      <CardHeader className="gap-5 border-b border-[#343831] px-5 py-6 sm:px-7">
        <div className="flex flex-col justify-between gap-5 xl:flex-row xl:items-end">
          <div>
            <CardTitle className="flex items-center gap-2 text-xl tracking-[-0.02em] text-[#e7e8e2]">
              <span className="flex h-8 w-8 items-center justify-center rounded-md border border-[#39443d] text-[#77a98a]">
                <UsersRound className="h-[18px] w-[18px]" />
              </span>
              Conversaciones
            </CardTitle>
            <CardDescription className="mt-2 leading-5">
              Revisa resultados o toma una conversación cuando tu equipo quiera intervenir.
            </CardDescription>
          </div>

          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="relative min-w-60">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value)
                  setCurrentPage(1)
                }}
                placeholder="Buscar por nombre o teléfono"
                className="h-10 rounded-lg border-[#393d36] bg-[#191b18] pl-9 text-[#e7e8e2] placeholder:text-[#697169]"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {filters.map((filter) => (
                <Button
                  key={filter.value}
                  variant={statusFilter === filter.value ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setFilter(filter.value)}
                  className={
                    statusFilter === filter.value
                      ? "bg-[#343c35] text-[#eef0e9] hover:bg-[#3b463d]"
                      : "text-[#8d978f] hover:bg-[#282c27] hover:text-[#d8dcd5]"
                  }
                >
                  {filter.label}
                </Button>
              ))}
              <Badge variant="secondary" className="bg-[#292d28] text-[#8d978f]">
                {filteredClientes.length}
              </Badge>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">Actualizando datos…</div>
        ) : currentClientes.length === 0 ? (
          <div className="py-16 text-center">
            <p className="font-medium text-[#e7e8e2]">No encontramos conversaciones</p>
            <p className="mt-1 text-sm text-muted-foreground">Prueba con otro filtro o una búsqueda diferente.</p>
          </div>
        ) : (
          <>
            <div className="divide-y divide-[#343831] md:hidden">
              {currentClientes.map((cliente) => {
                const status = getVisibleLeadStatus(cliente)
                const appointment = getAppointmentDate(cliente)
                const isClosed = status === "cerrado"

                return (
                  <article key={cliente.id} className="space-y-4 p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-[#e7e8e2]">{cliente.nome || "Sin nombre"}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">{cliente.telefone || "Sin teléfono"}</p>
                      </div>
                      <span className={`flex items-center gap-2 text-xs ${statusTextStyles[status]}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${statusDotStyles[status]}`} />
                        {visibleStatusLabels[status]}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-xs text-muted-foreground">
                      <div>
                        <span className="block font-medium text-[#abb2ac]">Última actividad</span>
                        {formatDate(getLastActivity(cliente))}
                      </div>
                      <div>
                        <span className="block font-medium text-[#abb2ac]">Cita</span>
                        {formatDate(appointment, appointmentFormatter)}
                      </div>
                    </div>
                    <div className="flex justify-end">{conversationActions(cliente, isClosed)}</div>
                  </article>
                )
              })}
            </div>

            <div className="hidden overflow-x-auto md:block">
              <Table>
                <TableHeader>
                  <TableRow className="bg-[#1a1c19] hover:bg-[#1a1c19]">
                    <TableHead className="pl-7">Lead</TableHead>
                    <TableHead>Última actividad</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Cita</TableHead>
                    <TableHead>Atención</TableHead>
                    <TableHead className="pr-7 text-right">Acción</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {currentClientes.map((cliente) => {
                    const status = getVisibleLeadStatus(cliente)
                    const appointment = getAppointmentDate(cliente)
                    const isClosed = status === "cerrado"

                    return (
                      <TableRow key={cliente.id} className="group border-[#30342e] hover:bg-[#22251f]">
                        <TableCell className="py-4 pl-7">
                          <div className="font-semibold text-[#dfe2dc]">{cliente.nome || "Sin nombre"}</div>
                          <div className="mt-0.5 text-xs text-muted-foreground">{cliente.telefone || "Sin teléfono"}</div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatDate(getLastActivity(cliente))}
                        </TableCell>
                        <TableCell>
                          <span className={`flex items-center gap-2 text-sm ${statusTextStyles[status]}`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${statusDotStyles[status]}`} />
                            {visibleStatusLabels[status]}
                          </span>
                        </TableCell>
                        <TableCell>
                          {appointment ? (
                            <div className="flex items-center gap-2 text-sm text-[#b7beb8]">
                              <CalendarDays className="h-4 w-4 text-[#75a58a]" />
                              {formatDate(appointment, appointmentFormatter)}
                            </div>
                          ) : (
                            <span className="text-sm text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2 text-sm text-[#9ca59e]">
                            <span
                              className={`h-2 w-2 rounded-full ${
                                cliente.trava ? "bg-[#9071aa]" : isClosed ? "bg-[#737b74]" : "bg-[#66a981]"
                              }`}
                            />
                            {cliente.trava ? cliente.atendido_por || "Tu equipo" : isClosed ? "Finalizada" : "Agente IA"}
                          </div>
                        </TableCell>
                        <TableCell className="pr-7">
                          <div className="flex justify-end">{conversationActions(cliente, isClosed)}</div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          </>
        )}

        {!loading && filteredClientes.length > 0 && (
          <div className="flex items-center justify-between border-t border-[#343831] bg-[#1a1c19] px-5 py-4 sm:px-7">
            <p className="text-sm text-muted-foreground">
              Mostrando {startIndex + 1}–{Math.min(startIndex + ITEMS_PER_PAGE, filteredClientes.length)} de{" "}
              {filteredClientes.length}
            </p>
            {totalPages > 1 && (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(Math.max(1, safePage - 1))}
                  disabled={safePage === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Anterior
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(Math.min(totalPages, safePage + 1))}
                  disabled={safePage === totalPages}
                >
                  Siguiente
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
