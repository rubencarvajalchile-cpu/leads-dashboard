"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { DashboardHeader } from "@/components/dashboard-header"
import { DashboardMetrics } from "@/components/dashboard-metrics"
import { LeadsTable } from "@/components/leads-table"
import { getClientes, getCurrentUser, onAuthStateChange } from "@/lib/supabase"
import { demoClientes, type Cliente, type LeadFilter } from "@/lib/dashboard-model"

const demoMode = process.env.NEXT_PUBLIC_DEMO_MODE === "true"

export default function DashboardPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(demoMode)
  const [loading, setLoading] = useState(!demoMode)
  const [user, setUser] = useState<{ email?: string | null } | null>(
    demoMode ? { email: "cliente@empresa.cl" } : null,
  )
  const [clientes, setClientes] = useState<Cliente[]>(
    demoMode ? demoClientes.map((cliente) => ({ ...cliente })) : [],
  )
  const [statusFilter, setStatusFilter] = useState<LeadFilter>("todos")
  const router = useRouter()

  const loadClientes = useCallback(async () => {
    setLoading(true)
    try {
      setClientes(await getClientes())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (demoMode) {
      return
    }

    let subscription: { unsubscribe: () => void } | null = null

    const initialize = async () => {
      const { user, error } = await getCurrentUser()
      if (!user || error) {
        router.push("/")
        setLoading(false)
        return
      }

      setIsAuthenticated(true)
      setUser(user)
      await loadClientes()

      const { data } = await onAuthStateChange((nextUser) => {
        if (!nextUser) router.push("/")
      })
      subscription = data.subscription
    }

    void initialize()
    return () => subscription?.unsubscribe()
  }, [loadClientes, router])

  if (loading && !isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted border-b-emerald-400" />
      </div>
    )
  }

  if (!isAuthenticated) return null

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader user={user} />
      <main className="mx-auto max-w-7xl space-y-8 px-5 py-10 sm:px-8 sm:py-12">
        <DashboardMetrics
          clientes={clientes}
          loading={loading}
          activeFilter={statusFilter}
          onFilterChange={setStatusFilter}
        />
        <LeadsTable
          clientes={clientes}
          loading={loading}
          onClientesChange={setClientes}
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
        />
      </main>
    </div>
  )
}
