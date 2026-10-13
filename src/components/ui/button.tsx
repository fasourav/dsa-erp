import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"

// Atrium capsule buttons. Phone sizes are the base; md: switches to the
// desktop metrics from the mockups (38px pill, 13.5px semibold label).
const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-full border border-transparent bg-clip-padding font-semibold tracking-[-0.005em] whitespace-nowrap transition-[background-color,box-shadow,transform,opacity] duration-150 outline-none select-none focus-visible:ring-3 focus-visible:ring-ring/50 active:not-aria-[haspopup]:scale-[0.97] disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow-primary hover:bg-primary/90",
        outline:
          "glass-control text-foreground hover:bg-surface-strong aria-expanded:bg-surface-strong",
        secondary:
          "bg-fill text-foreground hover:bg-fill-strong aria-expanded:bg-fill-strong",
        ghost:
          "text-foreground hover:bg-fill aria-expanded:bg-fill",
        destructive:
          "bg-destructive-tint text-destructive hover:bg-destructive/20 focus-visible:ring-destructive/30",
        "destructive-solid":
          "bg-destructive-solid text-on-color shadow-destructive hover:bg-destructive-solid/90 focus-visible:ring-destructive/30",
        link: "h-auto px-0 text-primary-text underline-offset-4 hover:underline",
      },
      size: {
        default:
          "h-9.5 gap-2 px-3.75 text-sm md:px-4.25 md:text-ui has-data-[icon=inline-end]:pr-3 has-data-[icon=inline-start]:pl-3",
        xs: "h-9.5 gap-1.5 px-3.25 text-sm md:h-8 md:text-label",
        sm: "h-9.5 gap-1.5 px-3.25 text-sm md:h-8 md:text-label",
        lg: "h-12 gap-2 px-5 text-callout",
        icon: "size-11 md:size-9",
        "icon-xs": "size-9.5 md:size-7.5",
        "icon-sm": "size-9.5 md:size-7.5",
        "icon-lg": "size-11",
      },
    },
    compoundVariants: [
      { variant: "link", size: ["default", "sm", "xs", "lg"], className: "h-auto px-0" },
    ],
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
