"use client"

import type React from "react"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { CheckCircle2, KeyRound } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createClient } from "@/lib/supabase"

type RecoveryState = "checking" | "ready" | "invalid" | "updated"

export default function ResetPasswordPage() {
  const supabase = useMemo(() => createClient(), [])
  const [recoveryState, setRecoveryState] = useState<RecoveryState>("checking")
  const [password, setPassword] = useState("")
  const [confirmation, setConfirmation] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    let active = true

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return
      if (event === "PASSWORD_RECOVERY" || session) {
        setRecoveryState("ready")
      }
    })

    supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return
      if (error || !data.session) {
        setRecoveryState("invalid")
      } else {
        setRecoveryState("ready")
      }
    })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [supabase])

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setErrorMessage(null)

    if (password.length < 8) {
      setErrorMessage("La contraseña debe tener al menos 8 caracteres.")
      return
    }

    if (password !== confirmation) {
      setErrorMessage("Las contraseñas no coinciden.")
      return
    }

    setIsLoading(true)

    try {
      const { error } = await supabase.auth.updateUser({ password })

      if (error) {
        setErrorMessage("No pudimos guardar la contraseña. Solicita un enlace nuevo e inténtalo nuevamente.")
        return
      }

      await supabase.auth.signOut()
      setPassword("")
      setConfirmation("")
      setRecoveryState("updated")
    } catch {
      setErrorMessage("No pudimos guardar la contraseña. Solicita un enlace nuevo e inténtalo nuevamente.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-5">
      <Card className="w-full max-w-md rounded-xl border-[#343831] bg-[#1d201c] shadow-none">
        <CardHeader className="text-center">
          <div className="mb-4 flex justify-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-lg border border-[#3d5447] text-[#84a995]">
              {recoveryState === "updated" ? <CheckCircle2 className="h-7 w-7" /> : <KeyRound className="h-7 w-7" />}
            </span>
          </div>
          <CardTitle className="text-2xl">
            {recoveryState === "updated" ? "Contraseña actualizada" : "Crear contraseña nueva"}
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            {recoveryState === "updated"
              ? "Ya puedes ingresar al panel con tu nueva contraseña."
              : "Elige una contraseña segura de al menos 8 caracteres."}
          </p>
        </CardHeader>
        <CardContent>
          {recoveryState === "checking" && <p className="text-center text-sm text-muted-foreground">Validando enlace...</p>}

          {recoveryState === "invalid" && (
            <div className="space-y-5 text-center">
              <p className="rounded-lg border border-[#5a3e3e] bg-[#322525] p-4 text-sm text-red-200">
                Este enlace venció o ya fue utilizado. Solicita uno nuevo para continuar.
              </p>
              <Button asChild className="w-full bg-[#507c63] text-[#f0f0ea] hover:bg-[#5b8a6f]">
                <Link href="/forgot-password">Solicitar enlace nuevo</Link>
              </Button>
            </div>
          )}

          {recoveryState === "ready" && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password">Contraseña nueva</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  minLength={8}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmation">Repetir contraseña</Label>
                <Input
                  id="confirmation"
                  type="password"
                  autoComplete="new-password"
                  value={confirmation}
                  onChange={(event) => setConfirmation(event.target.value)}
                  minLength={8}
                  required
                />
              </div>
              {errorMessage && <p className="text-sm text-red-300">{errorMessage}</p>}
              <Button
                type="submit"
                className="w-full bg-[#507c63] text-[#f0f0ea] hover:bg-[#5b8a6f]"
                disabled={isLoading}
              >
                {isLoading ? "Guardando..." : "Guardar contraseña"}
              </Button>
            </form>
          )}

          {recoveryState === "updated" && (
            <Button asChild className="w-full bg-[#507c63] text-[#f0f0ea] hover:bg-[#5b8a6f]">
              <Link href="/">Ingresar al panel</Link>
            </Button>
          )}
        </CardContent>
      </Card>
    </main>
  )
}
