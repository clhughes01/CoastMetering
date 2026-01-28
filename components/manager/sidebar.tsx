"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
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
  Building2
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { useState } from "react"
import { Logo, LogoIcon } from "@/components/logo"

const navigation = [
  {
    title: "OVERVIEW",
    items: [
      { name: "Dashboard", href: "/manager/dashboard", icon: LayoutDashboard },
    ]
  },
  {
    title: "MANAGE CUSTOMERS",
    items: [
      { name: "Properties", href: "/manager/properties", icon: Building2 },
      { name: "Manage Customers", href: "/manager/customers", icon: Users },
    ]
  },
  {
    title: "CUSTOMER STATEMENTS",
    items: [
      { name: "Customer Statements", href: "/manager/statements", icon: FileText },
      { name: "Consumption Chart", href: "/manager/consumption", icon: BarChart3 },
    ]
  },
  {
    title: "MONTHLY UTILITY BILLS",
    items: [
      { name: "Utility Statements", href: "/manager/utility-bills", icon: Receipt },
      { name: "Textract Test", href: "/manager/textract-test", icon: Scan },
    ]
  },
  {
    title: "PAYMENTS",
    items: [
      { name: "Payments and Payouts", href: "/manager/payments", icon: CreditCard },
    ]
  },
  {
    title: "SETTINGS",
    items: [
      { name: "Edit Profile", href: "/manager/settings", icon: Settings },
    ]
  },
]

interface SidebarProps {
  className?: string
}

export function Sidebar({ className }: SidebarProps) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)

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
            <Link href="/manager/dashboard" className="flex items-center gap-2">
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
            {navigation.map((section) => (
              <div key={section.title} className="mb-6">
                {!collapsed && (
                  <h3 className="px-3 mb-2 text-xs font-medium text-sidebar-foreground/60 uppercase tracking-wider">
                    {section.title}
                  </h3>
                )}
                <ul className="space-y-1">
                  {section.items.map((item) => {
                    const isActive = pathname === item.href
                    return (
                      <li key={item.name}>
                        <Link
                          href={item.href}
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
