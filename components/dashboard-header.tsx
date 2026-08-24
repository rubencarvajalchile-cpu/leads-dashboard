"use client"

import { Building2, LogOut } from "lucide-react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { signOut } from "@/lib/supabase"
import { useToast } from "@/hooks/use-toast"

interface DashboardHeaderProps {
  user?: { email?: string | null } | null
}

export function DashboardHeader({ user }: DashboardHeaderProps) {
  const router = useRouter()
  const { toast } = useToast()
  const demoMode = process.env.NEXT_PUBLIC_DEMO_MODE === "true"

  const handleLogout = async () => {
    if (demoMode) {
      router.push("/")
      return
    }

    try {
      const { error } = await signOut()
      if (error) throw error
      router.push("/")
    } catch {
      toast({
        title: "No se pudo cerrar la sesión",
        description: "Inténtalo nuevamente.",
        variant: "destructive",
      })
    }
  }

  return (
    <header className="border-b border-[#30342e] bg-[#171916]">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 sm:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[#4d6658] bg-[#202a24] text-[#79b994]">
            <Building2 className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="truncate text-[17px] font-semibold tracking-[-0.01em] text-[#ebece6]">
                {process.env.NEXT_PUBLIC_DASHBOARD_NAME || "Panel de atención"}
              </h1>
              <Badge variant="outline" className="hidden border-[#3d5447] bg-transparent text-[#84a995] sm:inline-flex">
                Acceso cliente
              </Badge>
            </div>
            <p className="truncate text-xs text-muted-foreground">Resultados y conversaciones de WhatsApp</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden items-center gap-2 text-xs text-muted-foreground lg:flex">
            <span className="h-1.5 w-1.5 rounded-full bg-[#65a780]" />
            Actualizado ahora
          </div>
          <span className="hidden max-w-56 truncate text-sm text-muted-foreground md:inline">{user?.email}</span>
          <Button variant="ghost" size="sm" onClick={handleLogout} className="text-muted-foreground hover:text-foreground">
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">Salir</span>
          </Button>
        </div>
      </div>
    </header>
  )
}
