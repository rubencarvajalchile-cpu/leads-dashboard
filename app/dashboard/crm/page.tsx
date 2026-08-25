import { redirect } from "next/navigation"
import { DashboardHeader } from "@/components/dashboard-header"
import { DualCrmBoard } from "@/components/crm/dual-crm-board"
import { getCrmWorkspaceAccess, isCrmEnabled, listAiCrmLeads, listCrmBoardColumns, listHumanCrmLeads } from "@/lib/crm/server"
import { createClient } from "@/lib/supabase-server"

export default async function CrmPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect("/")

  const enabled = isCrmEnabled()
  const access = enabled ? await getCrmWorkspaceAccess() : null
  const [aiLeads, humanLeads, columns] = enabled && access
    ? await Promise.all([listAiCrmLeads(), listHumanCrmLeads(), listCrmBoardColumns(access.organizationId)])
    : [[], [], []]

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader user={user} />
      <main className="mx-auto max-w-[1800px] space-y-8 px-5 py-10 sm:px-8 sm:py-12">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#6fa485]">Marketing + ventas</p>
            <h1 className="mt-2 text-[30px] font-semibold tracking-[-0.035em] text-[#e7e8e2]">Dos equipos, una sola ficha</h1>
          </div>
          <p className="max-w-xl text-sm leading-6 text-[#8d978f]">
            Lucas califica automáticamente. Cuando el lead queda listo para llamada, entra a Ventas sin duplicarse y la IA deja de intervenir al tomarlo.
          </p>
        </div>

        {enabled ? (
          <DualCrmBoard
            initialAiLeads={aiLeads}
            initialHumanLeads={humanLeads}
            initialColumns={columns}
            organizationId={access?.organizationId ?? ""}
            canManageColumns={access?.canManageColumns ?? false}
            currentUserId={user.id}
          />
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
