import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase-server"

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get("code")
  const requestedPath = requestUrl.searchParams.get("next") ?? "/reset-password"
  const nextPath = requestedPath.startsWith("/") ? requestedPath : "/reset-password"

  if (!code) {
    return NextResponse.redirect(new URL("/forgot-password", requestUrl.origin))
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    return NextResponse.redirect(new URL("/forgot-password", requestUrl.origin))
  }

  return NextResponse.redirect(new URL(nextPath, requestUrl.origin))
}
