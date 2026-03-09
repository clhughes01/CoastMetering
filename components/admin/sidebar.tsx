"use client"

import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"
import { cn } from "@/lib/utils"
import { adminPathWithFilter } from "@/lib/admin-filter"
import {
  Users,
  FileText,
  BarChart3,
  Receipt,
  CreditCard,
  Settings,
  ChevronLeft,
  Menu,
  LayoutDashboard,
  Scan,
  Building2,
  UserCog,
  Home,
  Droplets,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { useState } from "react"
import { Logo, LogoIcon } from "@/components/logo"

const navigation = [
  {
    title: "OVERVIEW",
    items: [
      { name: "Dashboard", href: "/admin/dashboard", icon: LayoutDashboard },
    ],
  },
  {
    title: "MANAGE",
    items: [
      { name: "Properties", href: "/admin/properties", icon: Building2 },
      { name: "Tenants", href: "/admin/customers", icon: Users },
      { name: "Property Managers", href: "/admin/property-managers", icon: UserCog },
      { name: "Landlords", href: "/admin/landlords", icon: Home },
    ],
  },
  {
    title: "STATEMENTS & USAGE",
    items: [
      { name: "Statements", href: "/admin/statements", icon: FileText },
      { name: "Consumption", href: "/admin/consumption", icon: BarChart3 },
    ],
  },
  {
    title: "UTILITY BILLS",
    items: [
      { name: "Utility Bills", href: "/admin/utility-bills", icon: Receipt },
      { name: "Escondido Bills", href: "/admin/provider-bills", icon: Droplets },
      { name: "Extract Bill (Textract)", href: "/admin/textract-test", icon: Scan },
    ],
  },
  {
    title: "PAYMENTS",
    items: [
      { name: "Payments", href: "/admin/payments", icon: CreditCard },
    ],
  },
  {
    title: "SETTINGS",
    items: [
      { name: "Settings", href: "/admin/settings", icon: Settings },
    ],
  },
]

interface SidebarProps {
  className?: string
}

export function Sidebar({ className }: SidebarProps) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [collapsed, setCollapsed] = useState(false)
  const manager = searchParams.get("manager") || undefined
  const property = searchParams.get("property") || undefined
  const linkParams = { manager: manager ?? null, property: property ?? null }

  return (
    <>
      {/* Mobile overlay */}
      <div
        className={cn(
          "fixed inset-0 bg-black/50 z-40 lg:hidden",
          collapsed ? "hidden" : "block lg:hidden"
        )}
        onClick={() => setCollapsed(true)}
      />

      {/* Mobile toggle button */}
      <Button
        variant="ghost"
        size="icon"
        className="fixed top-4 left-4 z-50 lg:hidden"
        onClick={() => setCollapsed(!collapsed)}
      >
        <Menu className="h-5 w-5" />
      </Button>

      <aside
        className={cn(
          "fixed left-0 top-0 z-40 h-screen bg-sidebar text-sidebar-foreground transition-all duration-300",
          collapsed ? "-translate-x-full lg:translate-x-0 lg:w-16" : "translate-x-0 w-64",
          className
        )}
      >
        <div className="flex flex-col h-full">
          <div className="flex items-center justify-between h-16 px-3 bg-card border-b border-border">
            <Link
              href={adminPathWithFilter("/admin/dashboard", linkParams)}
              className={cn(
                "flex items-center min-w-0 rounded-lg transition-opacity hover:opacity-90",
                collapsed ? "justify-center w-10 h-10" : "gap-2 flex-1 py-1"
              )}
            >
              {collapsed ? (
                <LogoIcon context="sidebar" className="w-8 h-8" />
              ) : (
                <Logo variant="dark" context="sidebar" />
              )}
            </Link>
            <Button
              variant="ghost"
              size="icon"
              className="hidden lg:flex text-muted-foreground hover:bg-muted"
              onClick={() => setCollapsed(!collapsed)}
            >
              <ChevronLeft
                className={cn("h-4 w-4 transition-transform", collapsed && "rotate-180")}
              />
            </Button>
          </div>

          <nav className="flex-1 overflow-y-auto py-4 px-3">
            {navigation.map((section) => (
              <div key={section.title} className="mb-6">
                {!collapsed && (
                  <h3 className="px-3 mb-2 text-xs font-medium text-sidebar-foreground/60 uppercase tracking-wider">
                    {section.title}
                  </h3>
                )}
                <ul className="space-y-1">
                  {section.items.map((item) => {
                    const href = adminPathWithFilter(item.href, linkParams)
                    const isActive = pathname === item.href
                    return (
                      <li key={item.name}>
                        <Link
                          href={href}
                          className={cn(
                            "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
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
              </div>
            ))}
          </nav>
        </div>
      </aside>
    </>
  )
}
