import { mergeProps } from "@base-ui/react/merge-props"
import { useRender } from "@base-ui/react/use-render"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

// Atrium tinted capsules. Status badges carry a 6px currentColor dot
// (see StatusBadge); role and type labels do not.
const badgeVariants = cva(
  "group/badge inline-flex h-5.5 w-fit shrink-0 items-center justify-center gap-1.5 overflow-hidden rounded-full border border-transparent px-2.25 text-xs font-strong tracking-[-0.005em] whitespace-nowrap transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 md:h-6 md:px-2.5 md:text-caption md:font-semibold aria-invalid:border-destructive [&>svg]:pointer-events-none [&>svg]:size-3!",
  {
    variants: {
      variant: {
        default: "bg-primary-tint text-primary-text [a]:hover:bg-primary-tint/80",
        secondary:
          "h-5.25 bg-fill px-2 text-micro font-semibold text-muted-foreground md:h-5.5 md:px-2.25 md:text-xs md:font-label",
        outline:
          "h-5.25 px-2 text-micro font-semibold text-muted-foreground shadow-[inset_0_0_0_1px_var(--border)] md:h-5.5 md:px-2.25 md:text-xs md:font-label [a]:hover:bg-fill",
        success: "bg-success-tint text-success",
        pending: "bg-warning-tint text-warning",
        warning: "bg-warning-tint text-warning",
        destructive: "bg-destructive-tint text-destructive",
        info: "bg-info-tint text-info",
        neutral: "bg-neutral-tint text-neutral",
        violet: "bg-violet-tint text-violet",
        ghost: "text-muted-foreground hover:bg-fill",
        link: "text-primary-text underline-offset-4 hover:underline",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant = "default",
  render,
  ...props
}: useRender.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return useRender({
    defaultTagName: "span",
    props: mergeProps<"span">(
      {
        className: cn(badgeVariants({ variant }), className),
      },
      props
    ),
    render,
    state: {
      slot: "badge",
      variant,
    },
  })
}

export { Badge, badgeVariants }
