"use client"

import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

function InputGroup({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="input-group"
      role="group"
      className={cn(
        "group/input-group relative flex h-11 w-full min-w-0 items-center rounded-control bg-field transition-[box-shadow,background-color] outline-none has-disabled:bg-fill has-disabled:opacity-60 has-[[data-slot=input-group-control]:focus-visible]:shadow-field-focus has-[[data-slot][aria-invalid=true]]:shadow-[inset_0_0_0_1px_var(--destructive),0_0_0_4px_var(--destructive-tint)] in-data-[slot=combobox-content]:bg-fill in-data-[slot=combobox-content]:shadow-none has-[>[data-align=block-end]]:h-auto has-[>[data-align=block-end]]:flex-col has-[>[data-align=block-start]]:h-auto has-[>[data-align=block-start]]:flex-col has-[>textarea]:h-auto md:h-10.5 md:bg-control md:shadow-field md:has-[[data-slot=input-group-control]:focus-visible]:shadow-field-focus in-data-[field-layout=inset]:h-auto in-data-[field-layout=inset]:rounded-none in-data-[field-layout=inset]:bg-transparent in-data-[field-layout=inset]:shadow-none in-data-[field-layout=inset]:has-[[data-slot=input-group-control]:focus-visible]:shadow-none md:in-data-[field-layout=inset]:h-10.5 md:in-data-[field-layout=inset]:rounded-control md:in-data-[field-layout=inset]:bg-control md:in-data-[field-layout=inset]:shadow-field md:in-data-[field-layout=inset]:has-[[data-slot=input-group-control]:focus-visible]:shadow-field-focus has-[>[data-align=block-end]]:[&>input]:pt-3 has-[>[data-align=block-start]]:[&>input]:pb-3 has-[>[data-align=inline-end]]:[&>input]:pr-1.5 has-[>[data-align=inline-start]]:[&>input]:pl-1.5",
        className
      )}
      {...props}
    />
  )
}

const inputGroupAddonVariants = cva(
  "flex h-auto cursor-text items-center justify-center gap-2 py-1.5 text-sm font-medium text-subtle-foreground select-none group-data-[disabled=true]/input-group:opacity-50 [&>kbd]:rounded-[calc(var(--radius)-5px)] [&>svg:not([class*='size-'])]:size-4",
  {
    variants: {
      align: {
        "inline-start":
          "order-first pl-3.5 in-data-[field-layout=inset]:pl-0 md:in-data-[field-layout=inset]:pl-3.5 has-[>button]:ml-[-0.3rem] has-[>kbd]:ml-[-0.15rem]",
        "inline-end":
          "order-last pr-2.5 has-[>button]:mr-[-0.3rem] has-[>kbd]:mr-[-0.15rem]",
        "block-start":
          "order-first w-full justify-start px-2.5 pt-2 group-has-[>input]/input-group:pt-2 [.border-b]:pb-2",
        "block-end":
          "order-last w-full justify-start px-2.5 pb-2 group-has-[>input]/input-group:pb-2 [.border-t]:pt-2",
      },
    },
    defaultVariants: {
      align: "inline-start",
    },
  }
)

function InputGroupAddon({
  className,
  align = "inline-start",
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof inputGroupAddonVariants>) {
  return (
    <div
      role="group"
      data-slot="input-group-addon"
      data-align={align}
      className={cn(inputGroupAddonVariants({ align }), className)}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest("button")) {
          return
        }
        e.currentTarget.parentElement?.querySelector("input")?.focus()
      }}
      {...props}
    />
  )
}

const inputGroupButtonVariants = cva(
  "flex items-center gap-2 text-sm shadow-none",
  {
    variants: {
      size: {
        xs: "h-8 gap-1 rounded-full px-2.5 md:h-7 [&>svg:not([class*='size-'])]:size-3.5",
        sm: "",
        "icon-xs":
          "size-8 rounded-full p-0 has-[>svg]:p-0 md:size-7",
        "icon-sm": "size-9 rounded-full p-0 has-[>svg]:p-0 md:size-8",
      },
    },
    defaultVariants: {
      size: "xs",
    },
  }
)

function InputGroupButton({
  className,
  type = "button",
  variant = "ghost",
  size = "xs",
  ...props
}: Omit<React.ComponentProps<typeof Button>, "size" | "type"> &
  VariantProps<typeof inputGroupButtonVariants> & {
    type?: "button" | "submit" | "reset"
  }) {
  return (
    <Button
      type={type}
      data-size={size}
      variant={variant}
      className={cn(inputGroupButtonVariants({ size }), className)}
      {...props}
    />
  )
}

function InputGroupText({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      className={cn(
        "flex items-center gap-2 text-sm text-muted-foreground [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      {...props}
    />
  )
}

function InputGroupInput({
  className,
  ...props
}: React.ComponentProps<"input">) {
  return (
    <Input
      data-slot="input-group-control"
      className={cn(
        "h-full flex-1 rounded-none border-0 bg-transparent px-1.5 shadow-none focus-visible:shadow-none disabled:bg-transparent aria-invalid:shadow-none in-data-[field-layout=inset]:h-full in-data-[field-layout=inset]:min-h-0 in-data-[field-layout=inset]:rounded-none in-data-[field-layout=inset]:bg-transparent in-data-[field-layout=inset]:px-1.5 in-data-[field-layout=inset]:py-1 in-data-[field-layout=inset]:shadow-none in-data-[field-layout=inset]:focus-visible:shadow-none md:h-full md:rounded-none md:bg-transparent md:px-1.5 md:shadow-none md:focus-visible:shadow-none md:aria-invalid:shadow-none md:in-data-[field-layout=inset]:h-full md:in-data-[field-layout=inset]:min-h-0 md:in-data-[field-layout=inset]:rounded-none md:in-data-[field-layout=inset]:bg-transparent md:in-data-[field-layout=inset]:px-1.5 md:in-data-[field-layout=inset]:py-1 md:in-data-[field-layout=inset]:shadow-none md:in-data-[field-layout=inset]:focus-visible:shadow-none",
        className
      )}
      {...props}
    />
  )
}

function InputGroupTextarea({
  className,
  ...props
}: React.ComponentProps<"textarea">) {
  return (
    <Textarea
      data-slot="input-group-control"
      className={cn(
        "flex-1 resize-none rounded-none border-0 bg-transparent py-2 shadow-none focus-visible:shadow-none disabled:bg-transparent aria-invalid:shadow-none md:bg-transparent md:shadow-none md:focus-visible:shadow-none",
        className
      )}
      {...props}
    />
  )
}

export {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupText,
  InputGroupInput,
  InputGroupTextarea,
}
