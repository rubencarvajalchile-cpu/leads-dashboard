"use client"

import type React from "react"

import { useState } from "react"
import Link from "next/link"
import { ArrowLeft, Mail } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { requestPasswordReset } from "@/lib/supabase"

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setIsLoading(true)
    setErrorMessage(null)

    try {
      const callbackUrl = new URL("/auth/callback", window.location.origin)
      callbackUrl.searchParams.set("next", "/reset-password")
      const { error } = await requestPasswordReset(email.trim(), callbackUrl.toString())

      if (error) {
        setErrorMessage("No pudimos enviar el correo. Inténtalo nuevamente.")
        return
      }

      setSent(true)
    } catch {
      setErrorMessage("No pudimos enviar el correo. Inténtalo nuevamente.")
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
              <Mail className="h-7 w-7" />
            </span>
          </div>
          <CardTitle className="text-2xl">Recuperar acceso</CardTitle>
          <p className="text-sm text-muted-foreground">Te enviaremos un enlace seguro para crear una contraseña nueva.</p>
        </CardHeader>
        <CardContent>
          {sent ? (
            <div className="space-y-5 text-center">
              <div className="rounded-lg border border-[#3d5447] bg-[#223028] p-4 text-sm text-[#c7d8ce]">
                Si el correo corresponde a un usuario autorizado, recibirás el enlace en unos minutos.
              </div>
              <Button asChild variant="outline" className="w-full border-[#3d5447] bg-transparent">
                <Link href="/">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Volver al ingreso
                </Link>
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="tu@empresa.cl"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                />
              </div>
              {errorMessage && <p className="text-sm text-red-300">{errorMessage}</p>}
              <Button
                type="submit"
                className="w-full bg-[#507c63] text-[#f0f0ea] hover:bg-[#5b8a6f]"
                disabled={isLoading}
              >
                {isLoading ? "Enviando..." : "Enviar enlace"}
              </Button>
              <Button asChild variant="ghost" className="w-full text-muted-foreground hover:text-foreground">
                <Link href="/">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Volver al ingreso
                </Link>
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </main>
  )
}
