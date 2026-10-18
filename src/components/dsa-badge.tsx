import Image from "next/image"

import { cn } from "@/lib/utils"

const dimensions = {
  full: { width: 3150, height: 1280 },
  icon: { width: 1160, height: 1310 },
} as const

export function DsaBadge({
  variant = "full",
  priority = false,
  className,
}: {
  variant?: "full" | "icon"
  priority?: boolean
  className?: string
}) {
  const size = dimensions[variant]
  const lightSrc = variant === "icon" ? "/brand/badge-icon-light.svg" : "/brand/badge-light.svg"
  const darkSrc = variant === "icon" ? "/brand/badge-icon-dark.svg" : "/brand/badge-dark.svg"

  return (
    <span className={cn("inline-flex shrink-0 items-center justify-center", className)}>
      <Image
        src={lightSrc}
        alt="DynamicSpace Architects & Engineers"
        width={size.width}
        height={size.height}
        priority={priority}
        loading="eager"
        unoptimized
        className="h-full w-auto max-w-full dark:hidden"
      />
      <Image
        src={darkSrc}
        alt=""
        width={size.width}
        height={size.height}
        priority={priority}
        loading="eager"
        unoptimized
        className="hidden h-full w-auto max-w-full dark:block"
      />
    </span>
  )
}
