import { cn } from "@/lib/utils"
import Image from "next/image"

interface LogoProps {
  className?: string
  iconOnly?: boolean
  variant?: "light" | "dark"
}

export function Logo({ className, iconOnly = false, variant = "dark" }: LogoProps) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      {/* Coast Metering Company Logo */}
      <Image
        src="/images/coast-metering-logo.png"
        alt="Coast Metering - Submetering & Utility Services"
        width={iconOnly ? 40 : 200}
        height={iconOnly ? 40 : 60}
        className={cn("shrink-0", iconOnly ? "w-10 h-10" : "h-12 w-auto")}
        priority
        style={{ objectFit: "contain" }}
      />
    </div>
  )
}

export function LogoIcon({ className }: { className?: string }) {
  return (
    <Image
      src="/images/coast-metering-logo.png"
      alt="Coast Metering"
      width={40}
      height={40}
      className={cn("w-10 h-10 shrink-0", className)}
      priority
      style={{ objectFit: "contain" }}
    />
  )
}
