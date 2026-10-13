import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"
import { cn } from "cn"

// 16px text on phones so iOS Safari never zooms on focus.
function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        "h-11 w-full min-w-0 rounded-control border-0 bg-field px-3.5 py-1 text-base text-foreground transition-[box-shadow,background-color] outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-subtle-foreground focus-visible:shadow-field-focus disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-fill disabled:text-muted-foreground disabled:shadow-none aria-invalid:shadow-[inset_0_0_0_1px_var(--destructive),0_0_0_4px_var(--destructive-tint)] md:h-10.5 md:bg-control md:text-sm md:shadow-field md:focus-visible:shadow-field-focus md:aria-invalid:shadow-[inset_0_0_0_1px_var(--destructive),0_0_0_4px_var(--destructive-tint)] in-data-[field-layout=inset]:h-auto in-data-[field-layout=inset]:min-h-7 in-data-[field-layout=inset]:rounded-none in-data-[field-layout=inset]:bg-transparent in-data-[field-layout=inset]:px-0 in-data-[field-layout=inset]:py-0.5 in-data-[field-layout=inset]:shadow-none in-data-[field-layout=inset]:focus-visible:shadow-none md:in-data-[field-layout=inset]:h-10.5 md:in-data-[field-layout=inset]:rounded-control md:in-data-[field-layout=inset]:bg-control md:in-data-[field-layout=inset]:px-3.5 md:in-data-[field-layout=inset]:py-1 md:in-data-[field-layout=inset]:shadow-field md:in-data-[field-layout=inset]:focus-visible:shadow-field-focus",
        className
      )}
      {...props}
    />
  )
}

export { Input }
