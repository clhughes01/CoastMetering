"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Logo } from "@/components/logo"
import { createSupabaseClient } from "@/lib/supabase/client"
import { Loader2 } from "lucide-react"

/**
 * Dedicated "accept invite" page. The invite email should link HERE instead of
 * Supabase's default verify URL. The token is only consumed when the user clicks
 * "Accept invite", which avoids email prefetching invalidating the link.
 *
 * Supabase template link: {{ .SiteURL }}/auth/accept-invite?token_hash={{ .TokenHash }}&type=invite
 */
export default function AcceptInvitePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)
  const [tokenHash, setTokenHash] = useState("")

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    setTokenHash(params.get("token_hash") || params.get("token") || "")
    setMounted(true)
  }, [])

  const handleAccept = async () => {
    if (!tokenHash) {
      setError("Invalid invite link. Missing token.")
      return
    }
    setError(null)
    setLoading(true)
    try {
      const supabase = createSupabaseClient()
      const { error: verifyError } = await supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type: "invite",
      })
      if (verifyError) throw verifyError
      router.replace("/auth/set-password")
    } catch (e) {
      console.error("Accept invite error:", e)
      setError(
        e instanceof Error
          ? e.message
          : "This link has expired or was already used. Please request a new invite."
      )
      setLoading(false)
    }
  }

  if (!mounted) {
    return (
      <div className="min-h-screen flex flex-col bg-muted/30 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!tokenHash) {
    return (
      <div className="min-h-screen flex flex-col bg-muted/30">
        <header className="border-b border-border bg-card">
          <div className="container mx-auto px-4 py-3">
            <Logo variant="dark" context="header" />
          </div>
        </header>
        <main className="flex-1 flex items-center justify-center p-4">
          <Card className="w-full max-w-md border-border">
            <CardHeader>
              <CardTitle>Invalid invite link</CardTitle>
              <CardDescription>
                This link is missing information or was not opened from the invite email.
                Please use the link from your invite email, or ask for a new invite.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild className="w-full">
                <Link href="/">Return to sign in</Link>
              </Button>
            </CardContent>
          </Card>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col bg-muted/30">
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-3">
          <Logo variant="dark" context="header" />
        </div>
      </header>
      <main className="flex-1 flex items-center justify-center p-4">
        <Card className="w-full max-w-md border-border shadow-lg">
          <CardHeader>
            <CardTitle>You&apos;re invited</CardTitle>
            <CardDescription>
              You&apos;ve been invited to join Coast Metering. Click the button below to accept
              the invite and set up your account. You&apos;ll then choose a password.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {error && (
              <div className="p-3 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md">
                {error}
              </div>
            )}
            <Button
              className="w-full h-11"
              onClick={handleAccept}
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Accepting...
                </>
              ) : (
                "Accept invite"
              )}
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              <Link href="/" className="text-primary hover:underline">
                Return to sign in
              </Link>
            </p>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
