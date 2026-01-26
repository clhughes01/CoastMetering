"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { 
  LayoutDashboard, 
  FileText, 
  CreditCard, 
  BarChart3,
  Settings,
  ChevronLeft,
  Menu
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { useState, useEffect } from "react"
import { Logo, LogoIcon } from "@/components/logo"
import { getCurrentUser } from "@/lib/auth"
import type { User } from "@/lib/types"

const navigation = [
  { name: "Dashboard", href: "/tenant/dashboard", icon: LayoutDashboard },
  { name: "My Statements", href: "/tenant/statements", icon: FileText },
  { name: "Payment History", href: "/tenant/payments", icon: CreditCard },
  { name: "Usage History", href: "/tenant/usage", icon: BarChart3 },
  { name: "Account Settings", href: "/tenant/settings", icon: Settings },
]

interface SidebarProps {
  className?: string
}

export function TenantSidebar({ className }: SidebarProps) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)
  const [user, setUser] = useState<User | null>(null)

  useEffect(() => {
    async function loadUser() {
      const currentUser = await getCurrentUser()
      setUser(currentUser)
    }
    loadUser()
  }, [])

  const getUserName = () => {
    if (user?.name && user.name.trim()) return user.name
    if (user?.email) {
      const emailName = user.email.split("@")[0]
      return emailName.charAt(0).toUpperCase() + emailName.slice(1)
    }
    return "User"
  }

  const getAccountNumber = () => {
    return user?.accountNumber || "N/A"
  }

  return (
    <>
      {/* Mobile overlay */}
      <div className={cn(
        "fixed inset-0 bg-black/50 z-40 lg:hidden",
        collapsed ? "hidden" : "block lg:hidden"
      )} onClick={() => setCollapsed(true)} />
      
      {/* Mobile toggle button */}
      <Button
        variant="ghost"
        size="icon"
        className="fixed top-4 left-4 z-50 lg:hidden"
        onClick={() => setCollapsed(!collapsed)}
      >
        <Menu className="h-5 w-5" />
      </Button>

      <aside className={cn(
        "fixed left-0 top-0 z-40 h-screen bg-sidebar text-sidebar-foreground transition-all duration-300",
        collapsed ? "-translate-x-full lg:translate-x-0 lg:w-16" : "translate-x-0 w-64",
        className
      )}>
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center justify-between h-16 px-4 border-b border-sidebar-border">
            <Link href="/tenant/dashboard" className="flex items-center gap-2">
              {collapsed ? (
                <LogoIcon className="w-8 h-8" />
              ) : (
                <Logo variant="light" />
              )}
            </Link>
            <Button
              variant="ghost"
              size="icon"
              className="hidden lg:flex text-sidebar-foreground hover:bg-sidebar-accent"
              onClick={() => setCollapsed(!collapsed)}
            >
              <ChevronLeft className={cn("h-4 w-4 transition-transform", collapsed && "rotate-180")} />
            </Button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto py-4 px-3">
            <ul className="space-y-1">
              {navigation.map((item) => {
                const isActive = pathname === item.href
                return (
                  <li key={item.name}>
                    <Link
                      href={item.href}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-colors",
                        isActive 
                          ? "bg-sidebar-accent text-sidebar-accent-foreground" 
                          : "text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                      )}
                      title={collapsed ? item.name : undefined}
                    >
                      <item.icon className="w-5 h-5 shrink-0" />
                      {!collapsed && <span>{item.name}</span>}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </nav>

          {/* User Info */}
          {!collapsed && (
            <div className="p-4 border-t border-sidebar-border">
              <div className="bg-sidebar-accent/30 rounded-lg p-3">
                <p className="text-sm font-medium text-sidebar-foreground">{getUserName()}</p>
                <p className="text-xs text-sidebar-foreground/60">Account #{getAccountNumber()}</p>
              </div>
            </div>
          )}
        </div>
      </aside>
    </>
  )
}
