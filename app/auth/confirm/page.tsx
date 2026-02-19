"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { createSupabaseClient } from "@/lib/supabase/client"
import { Loader2 } from "lucide-react"

/**
 * Handles the redirect from the invite email link.
 * Supabase can send either:
 * - token_hash + type (query): we call verifyOtp() to establish the session
 * - code (query, PKCE): we redirect to server callback
 * - access_token + refresh_token (hash): we call setSession()
 */
export default function AuthConfirmPage() {
  const router = useRouter()
  const [status, setStatus] = useState<"loading" | "error">("loading")

  useEffect(() => {
    const run = async () => {
      if (typeof window === "undefined") return

      const hash = window.location.hash?.slice(1) || ""
      const query = window.location.search?.slice(1) || ""
      const hashParams = new URLSearchParams(hash)
      const queryParams = new URLSearchParams(query)

      const code = queryParams.get("code") || hashParams.get("code")
      if (code) {
        window.location.href = `/auth/callback?code=${encodeURIComponent(code)}&next=/auth/set-password`
        return
      }

      const tokenHash =
        queryParams.get("token_hash") ||
        hashParams.get("token_hash") ||
        queryParams.get("token") ||
        hashParams.get("token")
      const type = queryParams.get("type") || hashParams.get("type")
      if (tokenHash && type) {
        try {
          const supabase = createSupabaseClient()
          const validTypes = ["invite", "signup", "magiclink", "recovery", "email_change", "email"] as const
          const otpType = validTypes.includes(type as (typeof validTypes)[number]) ? (type as (typeof validTypes)[number]) : "invite"
          const { error } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: otpType,
          })
          if (error) throw error
          router.replace("/auth/set-password")
          return
        } catch (e) {
          console.error("Verify OTP error:", e)
          setStatus("error")
          return
        }
      }

      const accessToken = hashParams.get("access_token") || queryParams.get("access_token")
      const refreshToken = hashParams.get("refresh_token") || queryParams.get("refresh_token")
      if (accessToken && refreshToken) {
        try {
          const supabase = createSupabaseClient()
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          })
          if (error) throw error
          router.replace("/auth/set-password")
          return
        } catch (e) {
          console.error("Confirm session error:", e)
          setStatus("error")
          return
        }
      }

      setStatus("error")
    }
    run()
  }, [router])

  if (status === "error") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-muted/30">
        <p className="text-destructive mb-4">Invalid or expired link. Please request a new invite.</p>
        <a href="/" className="text-primary hover:underline">Return to sign in</a>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-muted/30">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mb-4" />
      <p className="text-muted-foreground">Setting up your account...</p>
    </div>
  )
}
