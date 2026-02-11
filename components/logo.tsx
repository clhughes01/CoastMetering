import { cn } from "@/lib/utils"
import Image from "next/image"

interface LogoProps {
  className?: string
  iconOnly?: boolean
  /** "light" = for dark backgrounds (sidebar), "dark" = for light backgrounds (login/header) */
  variant?: "light" | "dark"
  /** "sidebar" = inside app sidebar (seamless), "header" = login or top bar */
  context?: "sidebar" | "header"
}

export function Logo({ className, iconOnly = false, variant = "dark", context = "header" }: LogoProps) {
  const isSidebar = context === "sidebar"
  return (
    <div
      className={cn(
        "flex items-center min-w-0",
        isSidebar && "py-0.5 -my-0.5",
        !iconOnly && isSidebar && "justify-start",
        className
      )}
    >
      <span className="inline-flex items-center overflow-hidden rounded-md">
        <Image
          src="/images/coast-metering-logo.png"
          alt="Coast Metering - Submetering & Utility Services"
          width={iconOnly ? 36 : 240}
          height={iconOnly ? 36 : 56}
          className={cn(
            "shrink-0 select-none object-contain block",
            iconOnly ? "w-9 h-9" : "h-11 w-auto max-w-[180px]",
            isSidebar && !iconOnly && "h-[58px] w-auto max-w-[260px]"
          )}
          priority
          draggable={false}
        />
      </span>
    </div>
  )
}

export function LogoIcon({ className, context = "sidebar" }: { className?: string; context?: "sidebar" | "header" }) {
  const isSidebar = context === "sidebar"
  return (
    <span className={cn("inline-flex items-center justify-center shrink-0 overflow-hidden rounded-md", className)}>
      <Image
        src="/images/coast-metering-logo.png"
        alt="Coast Metering"
        width={isSidebar ? 48 : 36}
        height={isSidebar ? 48 : 36}
        className={cn(
          "object-contain select-none block",
          isSidebar ? "w-12 h-12" : "w-9 h-9"
        )}
        priority
        draggable={false}
      />
    </span>
  )
}
