import type React from "react"
import type { Metadata } from "next"
import { Toaster } from "@/components/ui/toaster"
import "./globals.css"

export const metadata: Metadata = {
  title: "Panel de atención",
  description: "Resultados comerciales y conversaciones del canal",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es-CL" className="antialiased">
      <body>
        {children}
        <Toaster />
      </body>
    </html>
  )
}
