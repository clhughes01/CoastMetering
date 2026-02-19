"use client"

import React from "react"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Eye, EyeOff, Loader2 } from "lucide-react"
import { Logo } from "@/components/logo"
import { signIn, getCurrentUser } from "@/lib/auth"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

export default function LoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [inviteCode, setInviteCode] = useState("")
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [activeTab, setActiveTab] = useState("login")

  useEffect(() => {
    getCurrentUser().then((user) => {
      if (user) {
        if (user.role === "admin") router.replace("/admin/dashboard")
        else if (user.role === "manager") router.replace("/manager/dashboard")
        else router.replace("/tenant/tenant.new/dashboard")
      } else if (searchParams.get("confirmed") === "1") {
        setSuccess("Email confirmed! You can sign in below.")
      } else if (searchParams.get("error") === "auth_callback_failed") {
        setError("Confirmation link failed. Please try signing up again or sign in.")
      }
    })
  }, [router, searchParams])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError("")
    setSuccess("")

    try {
      const { user, error: authError } = await signIn(email, password)
      
      if (authError) {
        setError(authError)
        setIsLoading(false)
        return
      }

      if (user) {
        // Route based on user role
        if (user.role === "admin") {
          router.push("/admin/dashboard")
        } else if (user.role === "manager") {
          router.push("/manager/dashboard")
        } else {
          router.push("/tenant/tenant.new/dashboard")
        }
      } else {
        setError("Invalid email or password. Please try again.")
        setIsLoading(false)
      }
    } catch (err: any) {
      setError(err.message || "An error occurred. Please try again.")
      setIsLoading(false)
    }
  }

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError("")
    setSuccess("")

    if (!email || !inviteCode.trim()) {
      setError("Email and invite code are required.")
      setIsLoading(false)
      return
    }
    if (!firstName.trim() || !lastName.trim()) {
      setError("First name and last name are required.")
      setIsLoading(false)
      return
    }

    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          code: inviteCode.trim().toUpperCase(),
        }),
      })
      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        setError(data.error || "Failed to send invite. Please try again.")
        setIsLoading(false)
        return
      }

      setSuccess(
        data.message || "Check your email for an invite link. Click it to create your account and set your password."
      )
      setActiveTab("login")
      setEmail("")
      setFirstName("")
      setLastName("")
      setInviteCode("")
    } catch (err: any) {
      setError(err.message || "An error occurred during signup.")
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-muted/30">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <Logo variant="dark" context="header" />
          <nav className="hidden md:flex items-center gap-6 text-sm text-muted-foreground">
            <a href="https://coastmetering.com" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">About</a>
            <a href="https://coastmetering.com/#contact" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">Contact</a>
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center p-4 md:p-8">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-foreground mb-2 text-balance">
              Welcome Back
            </h1>
            <p className="text-muted-foreground">
              Sign in to access your utility portal
            </p>
          </div>

          <Card className="border-border shadow-lg shadow-black/5">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg">Sign in or create an account</CardTitle>
              <CardDescription className="text-muted-foreground">
                Access your Coast Metering portal
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="login">Sign In</TabsTrigger>
                  <TabsTrigger value="signup">Sign Up</TabsTrigger>
                </TabsList>

                {/* Sign In Tab */}
                <TabsContent value="login" className="space-y-4 mt-4">
                  {error && (
                    <div className="p-3 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md">
                      {error}
                    </div>
                  )}
                  {success && (
                    <div className="p-3 text-sm text-green-700 bg-green-50 border border-green-200 dark:bg-green-950/30 dark:border-green-800 dark:text-green-300 rounded-md">
                      {success}
                    </div>
                  )}
                  
                  <form onSubmit={handleLogin} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="login-email">Email Address</Label>
                      <Input 
                        id="login-email" 
                        type="email" 
                        placeholder="you@example.com" 
                        required
                        className="h-11"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        disabled={isLoading}
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="login-password">Password</Label>
                      <div className="relative">
                        <Input 
                          id="login-password" 
                          type={showPassword ? "text" : "password"} 
                          placeholder="Enter your password"
                          required
                          className="h-11 pr-10"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          disabled={isLoading}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                          disabled={isLoading}
                        >
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between text-sm">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" className="rounded border-border" />
                        <span className="text-muted-foreground">Remember me</span>
                      </label>
                      <a href="#" className="text-primary hover:underline">Forgot password?</a>
                    </div>
                    
                    <Button type="submit" className="w-full h-11" disabled={isLoading}>
                      {isLoading ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Signing in...
                        </>
                      ) : (
                        "Sign In"
                      )}
                    </Button>
                  </form>
                </TabsContent>

                {/* Sign Up Tab */}
                <TabsContent value="signup" className="space-y-4 mt-4">
                  {error && (
                    <div className="p-3 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md">
                      {error}
                    </div>
                  )}
                  {success && (
                    <div className="p-3 text-sm text-green-700 bg-green-50 border border-green-200 dark:bg-green-950/30 dark:border-green-800 dark:text-green-300 rounded-md">
                      {success}
                    </div>
                  )}
                  
                  <form onSubmit={handleSignUp} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="signup-code">Invite code</Label>
                      <Input 
                        id="signup-code" 
                        type="text" 
                        placeholder="e.g. AB12CD34" 
                        required
                        className="h-11 font-mono uppercase"
                        value={inviteCode}
                        onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                        disabled={isLoading}
                      />
                      <p className="text-xs text-muted-foreground">
                        Get an invite code from your property manager or admin to create an account.
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="signup-first-name">First name</Label>
                        <Input 
                          id="signup-first-name" 
                          type="text" 
                          placeholder="John" 
                          required
                          className="h-11"
                          value={firstName}
                          onChange={(e) => setFirstName(e.target.value)}
                          disabled={isLoading}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="signup-last-name">Last name</Label>
                        <Input 
                          id="signup-last-name" 
                          type="text" 
                          placeholder="Doe" 
                          required
                          className="h-11"
                          value={lastName}
                          onChange={(e) => setLastName(e.target.value)}
                          disabled={isLoading}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="signup-email">Email address</Label>
                      <Input 
                        id="signup-email" 
                        type="email" 
                        placeholder="you@example.com" 
                        required
                        className="h-11"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        disabled={isLoading}
                      />
                    </div>
                    
                    <Button type="submit" className="w-full h-11" disabled={isLoading}>
                      {isLoading ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Sending invite...
                        </>
                      ) : (
                        "Send invite email"
                      )}
                    </Button>
                  </form>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border bg-card py-4">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>© 2026 Coast Metering. All rights reserved.</p>
          <p className="mt-1">365 West 2nd Avenue Ste 100, Escondido, CA</p>
        </div>
      </footer>
    </div>
  )
}
