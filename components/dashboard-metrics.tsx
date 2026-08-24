"use client"

import { isLeadClosed, isLeadInFollowUp, isLeadScheduled, type Cliente, type LeadFilter } from "@/lib/dashboard-model"

interface DashboardMetricsProps {
  clientes: Cliente[]
  loading: boolean
  activeFilter: LeadFilter
  onFilterChange: (filter: LeadFilter) => void
}

export function DashboardMetrics({ clientes, loading, activeFilter, onFilterChange }: DashboardMetricsProps) {
  const metrics = [
    {
      label: "Leads atendidos",
      value: clientes.length,
      description: "Total recibido",
      filter: "todos" as const,
    },
    {
      label: "Citas agendadas",
      value: clientes.filter(isLeadScheduled).length,
      description: "Con cita confirmada",
      filter: "agendado" as const,
    },
    {
      label: "Por retomar",
      value: clientes.filter(isLeadInFollowUp).length,
      description: "Requieren seguimiento",
      filter: "seguimiento" as const,
    },
    {
      label: "Atención finalizada",
      value: clientes.filter(isLeadClosed).length,
      description: "Fuera de atención activa",
      filter: "cerrado" as const,
    },
  ]

  return (
    <section className="space-y-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#6fa485]">Resumen</p>
          <h2 className="mt-2 text-[30px] font-semibold tracking-[-0.035em] text-[#e7e8e2]">Atención comercial</h2>
        </div>
        <p className="max-w-md text-sm leading-6 text-[#8d978f]">
          Resultados del canal y conversaciones disponibles para tu equipo.
        </p>
      </div>

      <div className="grid overflow-hidden rounded-xl border border-[#343831] bg-[#1d201c] sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map(({ label, value, description, filter }, index) => (
          <button
            type="button"
            key={label}
            onClick={() => onFilterChange(filter)}
            className={`relative min-h-36 border-[#343831] p-5 text-left transition hover:bg-[#232720] sm:[&:nth-child(odd)]:border-r xl:border-r xl:last:border-r-0 ${
              index < 2 ? "border-b xl:border-b-0" : ""
            } ${activeFilter === filter ? "bg-[#252b25]" : ""}`}
          >
            {activeFilter === filter && <span className="absolute inset-x-0 top-0 h-0.5 bg-[#6da685]" />}
            <p className="text-sm text-[#abb2ac]">{label}</p>
            <p className="mt-4 text-[34px] font-medium leading-none tracking-[-0.04em] text-[#f0f0eb]">
              {loading ? "—" : value.toLocaleString("es-CL")}
            </p>
            <p className="mt-4 text-xs text-[#6f7871]">{description}</p>
          </button>
        ))}
      </div>
    </section>
  )
}
