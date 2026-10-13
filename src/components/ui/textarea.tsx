import * as React from "react"
import { cn } from "@/lib/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex field-sizing-content min-h-21.5 w-full rounded-control border-0 bg-field px-3.5 py-2.75 text-base leading-normal text-foreground transition-[box-shadow,background-color] outline-none placeholder:text-subtle-foreground focus-visible:shadow-field-focus disabled:cursor-not-allowed disabled:bg-fill disabled:text-muted-foreground disabled:shadow-none aria-invalid:shadow-[inset_0_0_0_1px_var(--destructive),0_0_0_4px_var(--destructive-tint)] md:bg-control md:text-sm md:shadow-field md:focus-visible:shadow-field-focus in-data-[field-layout=inset]:h-auto in-data-[field-layout=inset]:min-h-7 in-data-[field-layout=inset]:rounded-none in-data-[field-layout=inset]:bg-transparent in-data-[field-layout=inset]:px-0 in-data-[field-layout=inset]:py-0.5 in-data-[field-layout=inset]:shadow-none in-data-[field-layout=inset]:focus-visible:shadow-none md:in-data-[field-layout=inset]:min-h-21.5 md:in-data-[field-layout=inset]:rounded-control md:in-data-[field-layout=inset]:bg-control md:in-data-[field-layout=inset]:px-3.5 md:in-data-[field-layout=inset]:py-2.75 md:in-data-[field-layout=inset]:shadow-field md:in-data-[field-layout=inset]:focus-visible:shadow-field-focus",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
