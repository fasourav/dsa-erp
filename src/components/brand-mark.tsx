import Image from "next/image"

import { cn } from "@/lib/utils"

const mark = { width: 512, height: 617 }
const name = { width: 1200, height: 116 }
const tagline = { width: 1200, height: 80 }

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
        style={{ height: "100%", width: "auto" }}
      />
      <Image
        src="/brand/mark-white.png"
        alt="DynamicSpace Architects & Engineers"
        width={mark.width}
        height={mark.height}
        className="hidden h-full w-auto max-w-full dark:block"
        style={{ height: "100%", width: "auto" }}
      />
    </span>
  )
}

function Wordmark({
  olive,
  white,
  width,
  height,
  priority,
}: {
  olive: string
  white: string
  width: number
  height: number
  priority: boolean
}) {
  return (
    <span className="block w-full">
      <Image
        src={olive}
        alt=""
        width={width}
        height={height}
        priority={priority}
        className="h-auto w-full dark:hidden"
        style={{ width: "100%", height: "auto" }}
      />
      <Image
        src={white}
        alt=""
        width={width}
        height={height}
        className="hidden h-auto w-full dark:block"
        style={{ width: "100%", height: "auto" }}
      />
    </span>
  )
}

export function BrandLockup({
  layout = "sidebar",
  priority = false,
  className,
}: {
  layout?: "sidebar" | "stacked"
  priority?: boolean
  className?: string
}) {
  const stacked = layout === "stacked"

  return (
    <div
      className={cn(
        "flex min-w-0 gap-2",
        stacked
          ? "flex-col items-stretch gap-2"
          : "items-center md:flex-col md:items-stretch md:gap-1.5",
        className,
      )}
    >
      <BrandMark
        priority={priority}
        className={cn(
          "shrink-0",
          stacked ? "h-16 w-auto self-start" : "h-9 w-auto md:h-12 md:self-start",
        )}
      />
      <span
        className={cn(
          "flex min-w-0 flex-col gap-0.5",
          stacked ? "w-full" : "flex-1 md:w-full md:flex-none",
        )}
      >
        <Wordmark
          olive="/brand/name-olive.png"
          white="/brand/name-white.png"
          width={name.width}
          height={name.height}
          priority={priority}
        />
        <Wordmark
          olive="/brand/tagline-olive.png"
          white="/brand/tagline-white.png"
          width={tagline.width}
          height={tagline.height}
          priority={priority}
        />
      </span>
    </div>
  )
}
