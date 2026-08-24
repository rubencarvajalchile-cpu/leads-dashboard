import { redirect } from "next/navigation"
import { DashboardHeader } from "@/components/dashboard-header"
import { HumanCrmBoard } from "@/components/crm/human-crm-board"
import { isCrmEnabled, listHumanCrmLeads, listTakeoverQueue } from "@/lib/crm/server"
import { createClient } from "@/lib/supabase-server"

export default async function CrmPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect("/")

  const enabled = isCrmEnabled()
  const [leads, takeoverQueue] = enabled ? await Promise.all([listHumanCrmLeads(), listTakeoverQueue()]) : [[], []]

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader user={user} />
      <main className="mx-auto max-w-[1800px] space-y-8 px-5 py-10 sm:px-8 sm:py-12">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#6fa485]">Atención humana</p>
            <h1 className="mt-2 text-[30px] font-semibold tracking-[-0.035em] text-[#e7e8e2]">CRM comercial</h1>
          </div>
          <p className="max-w-xl text-sm leading-6 text-[#8d978f]">
            Los vendedores manipulan únicamente los leads tomados por una persona. El funnel de IA permanece protegido.
          </p>
        </div>

        {enabled ? (
          <HumanCrmBoard initialLeads={leads} initialTakeoverQueue={takeoverQueue} />
        ) : (
          <div className="rounded-xl border border-[#3b423a] bg-[#1d201c] px-6 py-12">
            <h2 className="text-lg font-semibold text-[#e7e8e2]">CRM preparado, todavía no activado</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#8d978f]">
              La estructura está aislada del sistema actual. Se activará después de aplicar y verificar la migración de Supabase.
            </p>
          </div>
        )}
      </main>
    </div>
  )
}
