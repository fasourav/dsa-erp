"use client"

import * as React from "react"
import { cn } from "cn"

function Label({ className, ...props }: React.ComponentProps<"label">) {
  return (
    <label
      data-slot="label"
      className={cn(
        "flex items-center gap-2 text-label leading-none font-semibold select-none in-data-[field-layout=inset]:text-xs in-data-[field-layout=inset]:text-muted-foreground md:in-data-[field-layout=inset]:text-label md:in-data-[field-layout=inset]:text-foreground group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50",
        className
      )}
      {...props}
    />
  )
}

export { Label }
