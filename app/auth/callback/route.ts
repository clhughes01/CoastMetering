import { createSupabaseClientFromCookies } from "@/lib/supabase/client"
import { NextRequest, NextResponse } from "next/server"

/**
 * Handles the redirect from Supabase email confirmation (and other auth redirects).
 * Exchanges the code for a session and redirects to the app root so the user can sign in.
 * Configure Supabase Dashboard > Auth > URL Configuration with:
 * - Site URL: https://coast-metering.vercel.app
 * - Redirect URLs: https://coast-metering.vercel.app/auth/callback
 */
export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get("code")
  const next = requestUrl.searchParams.get("next") ?? "/"

  if (code) {
    const supabase = await createSupabaseClientFromCookies()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (error) {
      console.error("Auth callback exchange error:", error)
      return NextResponse.redirect(`${requestUrl.origin}/?error=auth_callback_failed`)
    }
  }

  return NextResponse.redirect(requestUrl.origin + next)
}
