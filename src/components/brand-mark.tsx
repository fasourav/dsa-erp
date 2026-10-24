import Image from "next/image"

import { cn } from "@/lib/utils"

const mark = { width: 829, height: 1002 }
const lockup = { width: 837, height: 293 }

export function BrandMark({
  className,
  priority = false,
}: {
  className?: string
  priority?: boolean
}) {
  return (
    <span className={cn("inline-flex items-center justify-center", className)}>
      <Image
        src="/brand/mark-olive.png"
        alt="DynamicSpace Architects & Engineers"
        width={mark.width}
        height={mark.height}
        priority={priority}
        className="h-full w-auto max-w-full dark:hidden"
      />
      <Image
        src="/brand/mark-white.png"
        alt=""
        width={mark.width}
        height={mark.height}
        className="hidden h-full w-auto max-w-full dark:block"
      />
    </span>
  )
}

export function BrandLockup({
  priority = false,
  className,
}: {
  priority?: boolean
  className?: string
}) {
  return (
    <span className={cn("inline-flex h-12.5 min-w-0 shrink-0 items-center", className)}>
      <Image
        src="/brand/lockup-olive.png"
        alt="DynamicSpace Architects & Engineers"
        width={lockup.width}
        height={lockup.height}
        priority={priority}
        loading="eager"
        className="h-full w-auto max-w-full dark:hidden"
      />
      <Image
        src="/brand/lockup-white.png"
        alt=""
        width={lockup.width}
        height={lockup.height}
        priority={priority}
        loading="eager"
        className="hidden h-full w-auto max-w-full dark:block"
      />
    </span>
  )
}
