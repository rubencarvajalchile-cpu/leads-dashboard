"use client"

import type React from "react"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"
import { MessageCircle } from "lucide-react"
import { createClient, signInWithEmail } from "@/lib/supabase"

export function LoginForm() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const supabase = useMemo(() => createClient(), [])
  const router = useRouter()
  const { toast } = useToast()

  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get("code")

    if (code) {
      supabase.auth.exchangeCodeForSession(code).then(async ({ error }) => {
        if (!error) {
          router.replace("/reset-password")
          return
        }

        // createBrowserClient may have already exchanged the one-time code
        // while initializing. In that race, a second exchange fails even
        // though the recovery session is valid, so trust the resulting
        // session before rejecting the link.
        const {
          data: { session },
        } = await supabase.auth.getSession()

        router.replace(session ? "/reset-password" : "/forgot-password")
      })
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        router.replace("/reset-password")
      }
    })

    return () => subscription.unsubscribe()
  }, [router, supabase])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      const { data, error } = await signInWithEmail(email, password)

      if (error) {
        toast({
          title: "No pudimos iniciar la sesión",
          description: error.message || "Revisa tus credenciales.",
          variant: "destructive",
        })
      } else if (data.user) {
        toast({
          title: "Sesión iniciada",
          description: "Bienvenido al panel de atención.",
        })
        router.push("/dashboard")
      }
    } catch {
      toast({
        title: "No pudimos iniciar la sesión",
        description: "Ocurrió un error inesperado. Inténtalo nuevamente.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card className="w-full max-w-md rounded-xl border-[#343831] bg-[#1d201c] shadow-none">
      <CardHeader className="text-center">
        <div className="mb-4 flex justify-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-lg border border-[#3d5447] text-[#84a995]">
            <MessageCircle className="h-7 w-7" />
          </span>
        </div>
        <CardTitle className="text-2xl">Acceso al panel</CardTitle>
        <p className="text-sm text-muted-foreground">Disponible únicamente para usuarios autorizados</p>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="tu@empresa.cl"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="password">Contraseña</Label>
              <Link href="/forgot-password" className="text-xs text-[#84a995] hover:text-[#a1c1af] hover:underline">
                ¿Olvidaste tu contraseña?
              </Link>
            </div>
            <Input
              id="password"
              type="password"
              placeholder="Tu contraseña"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <Button type="submit" className="w-full bg-[#507c63] text-[#f0f0ea] hover:bg-[#5b8a6f]" disabled={isLoading}>
            {isLoading ? "Ingresando..." : "Ingresar"}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
