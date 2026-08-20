export type VisibleLeadStatus =
  | "en_atencion"
  | "seguimiento"
  | "agendado"
  | "atencion_humana"
  | "cerrado"

export type LeadFilter = "todos" | VisibleLeadStatus

export interface Cliente {
  id: number
  created_at: string
  nome: string | null
  telefone: string | null
  trava: boolean
  follow_up: number
  interessado: boolean
  last_followup: string | null
  produto_interesse: string | null
  followup_status: string | null
  estado?: string | null
  fase?: string | null
  agendado?: boolean | null
  cita_at?: string | null
  fecha_cita?: string | null
  closed_at?: string | null
  updated_at?: string | null
  atendido_por?: string | null
}

const normalize = (value?: string | null) =>
  value
    ?.normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase() ?? ""

export function isLeadClosed(cliente: Cliente) {
  const state = normalize(cliente.estado)
  const followUpStatus = normalize(cliente.followup_status)

  return Boolean(
    cliente.closed_at ||
      ["cerrado", "closed", "finalizado", "no_contactar", "no califica", "inactivo"].some(
        (token) => state.includes(token) || followUpStatus.includes(token),
      ),
  )
}

export function isLeadScheduled(cliente: Cliente) {
  const state = normalize(cliente.estado)

  return Boolean(
    cliente.agendado ||
      cliente.cita_at ||
      cliente.fecha_cita ||
      ["agendado", "cita confirmada", "scheduled"].some((token) => state.includes(token)),
  )
}

export function isLeadInFollowUp(cliente: Cliente) {
  if (isLeadClosed(cliente) || isLeadScheduled(cliente)) return false

  const followUpStatus = normalize(cliente.followup_status)
  return cliente.follow_up > 0 || ["seguimiento", "pendiente", "follow"].some((token) => followUpStatus.includes(token))
}

export function getVisibleLeadStatus(cliente: Cliente): VisibleLeadStatus {
  if (isLeadClosed(cliente)) return "cerrado"
  if (cliente.trava) return "atencion_humana"
  if (isLeadScheduled(cliente)) return "agendado"
  if (isLeadInFollowUp(cliente)) return "seguimiento"
  return "en_atencion"
}

export const visibleStatusLabels: Record<VisibleLeadStatus, string> = {
  en_atencion: "En atención",
  seguimiento: "Por retomar",
  agendado: "Agendado",
  atencion_humana: "Atiende tu equipo",
  cerrado: "Atención finalizada",
}

export function getAppointmentDate(cliente: Cliente) {
  return cliente.cita_at ?? cliente.fecha_cita ?? null
}

export function getLastActivity(cliente: Cliente) {
  return cliente.updated_at ?? cliente.last_followup ?? cliente.created_at
}

export const demoClientes: Cliente[] = [
  {
    id: 1,
    created_at: "2026-08-19T12:10:00-04:00",
    updated_at: "2026-08-19T17:42:00-04:00",
    nome: "María González",
    telefone: "+56 9 8123 4578",
    trava: false,
    follow_up: 0,
    interessado: true,
    last_followup: null,
    produto_interesse: "Energía solar residencial",
    followup_status: "",
    estado: "agendado",
    agendado: true,
    cita_at: "2026-08-21T11:30:00-04:00",
  },
  {
    id: 2,
    created_at: "2026-08-19T13:22:00-04:00",
    updated_at: "2026-08-19T17:35:00-04:00",
    nome: "Carlos Muñoz",
    telefone: "+56 9 7644 3091",
    trava: false,
    follow_up: 1,
    interessado: true,
    last_followup: "2026-08-19T16:20:00-04:00",
    produto_interesse: "Paneles solares",
    followup_status: "seguimiento pendiente",
    estado: "en conversación",
  },
  {
    id: 3,
    created_at: "2026-08-18T10:05:00-04:00",
    updated_at: "2026-08-19T16:54:00-04:00",
    nome: "Fernanda Rojas",
    telefone: "+56 9 6338 2140",
    trava: true,
    follow_up: 0,
    interessado: true,
    last_followup: null,
    produto_interesse: "Energía solar residencial",
    followup_status: "",
    estado: "atención humana",
    atendido_por: "Equipo comercial",
  },
  {
    id: 4,
    created_at: "2026-08-18T15:40:00-04:00",
    updated_at: "2026-08-19T15:12:00-04:00",
    nome: "Sebastián Araya",
    telefone: "+56 9 9012 7865",
    trava: false,
    follow_up: 0,
    interessado: true,
    last_followup: null,
    produto_interesse: "Sistema fotovoltaico",
    followup_status: "",
    estado: "agendado",
    agendado: true,
    cita_at: "2026-08-22T09:00:00-04:00",
  },
  {
    id: 5,
    created_at: "2026-08-17T09:15:00-04:00",
    updated_at: "2026-08-19T14:30:00-04:00",
    nome: "Alejandra Pérez",
    telefone: "+56 9 5221 4077",
    trava: false,
    follow_up: 2,
    interessado: true,
    last_followup: "2026-08-19T14:30:00-04:00",
    produto_interesse: "Paneles solares",
    followup_status: "seguimiento pendiente",
    estado: "en conversación",
  },
  {
    id: 6,
    created_at: "2026-08-16T11:30:00-04:00",
    updated_at: "2026-08-18T18:22:00-04:00",
    nome: "Rodrigo Salinas",
    telefone: "+56 9 4880 1192",
    trava: false,
    follow_up: 2,
    interessado: false,
    last_followup: "2026-08-18T18:22:00-04:00",
    produto_interesse: "Energía solar residencial",
    followup_status: "cerrado",
    estado: "cerrado",
    closed_at: "2026-08-18T18:22:00-04:00",
  },
  {
    id: 7,
    created_at: "2026-08-19T15:18:00-04:00",
    updated_at: "2026-08-19T17:28:00-04:00",
    nome: "Paula Contreras",
    telefone: "+56 9 7770 6521",
    trava: false,
    follow_up: 0,
    interessado: true,
    last_followup: null,
    produto_interesse: "Energía solar residencial",
    followup_status: "",
    estado: "en conversación",
  },
  {
    id: 8,
    created_at: "2026-08-15T12:45:00-04:00",
    updated_at: "2026-08-19T13:08:00-04:00",
    nome: "Jorge Fuentes",
    telefone: "+56 9 8554 9034",
    trava: false,
    follow_up: 0,
    interessado: true,
    last_followup: null,
    produto_interesse: "Sistema fotovoltaico",
    followup_status: "",
    estado: "agendado",
    agendado: true,
    cita_at: "2026-08-23T16:00:00-04:00",
  },
]
