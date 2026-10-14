"use client"

import * as React from "react"
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"
import { cn } from "@/lib/utils"

import { Button } from "@/components/ui/button"
import { XIcon } from "lucide-react"

function Dialog({ ...props }: DialogPrimitive.Root.Props) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />
}

function DialogTrigger({ ...props }: DialogPrimitive.Trigger.Props) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />
}

function DialogPortal({ ...props }: DialogPrimitive.Portal.Props) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />
}

function DialogClose({ ...props }: DialogPrimitive.Close.Props) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />
}

function DialogOverlay({
  className,
  ...props
}: DialogPrimitive.Backdrop.Props) {
  return (
    <DialogPrimitive.Backdrop
      data-slot="dialog-overlay"
      className={cn(
        "fixed inset-0 isolate z-50 min-h-dvh bg-scrim duration-300 supports-[-webkit-touch-callout:none]:absolute supports-backdrop-filter:backdrop-blur-[2px] data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0 md:duration-200",
        className
      )}
      {...props}
    />
  )
}

function DialogContent({
  className,
  children,
  showCloseButton = true,
  variant = "default",
  mobileLayout = "stack",
  ...props
}: DialogPrimitive.Popup.Props & {
  showCloseButton?: boolean
  variant?: "default" | "drawer"
  /**
   * Phone layout of a bottom sheet. "nav" puts the footer's first action
   * (Cancel) and last action (Save) beside the title, like an iOS sheet.
   * Use it only when the footer holds exactly those two buttons.
   */
  mobileLayout?: "stack" | "nav"
}) {
  const releaseLockRef = React.useRef<(() => void) | null>(null)
  const viewportNodeRef = React.useRef<HTMLDivElement | null>(null)
  const setViewportNode = React.useCallback((node: HTMLDivElement | null) => {
    if (viewportNodeRef.current === node) return
    viewportNodeRef.current = node
    releaseLockRef.current?.()
    releaseLockRef.current = node ? lockDialogScroll(node) : null
  }, [])

  React.useEffect(() => {
    return () => releaseLockRef.current?.()
  }, [])

  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Viewport
        ref={setViewportNode}
        data-slot="dialog-viewport"
        className={cn(
          "fixed inset-x-0 top-0 z-50 flex h-dvh w-full overflow-hidden overscroll-none",
          variant === "drawer"
            ? "flex-col items-stretch justify-end px-1.5 pt-[max(3.5rem,calc(env(safe-area-inset-top,0px)+0.75rem))] pb-1.5 md:flex-row md:justify-end md:p-3.5"
            : "flex-col items-center justify-end px-1.5 pt-[max(3.5rem,calc(env(safe-area-inset-top,0px)+0.75rem))] pb-1.5 md:justify-center md:pt-[max(1rem,env(safe-area-inset-top,0px))] md:pr-[max(1rem,env(safe-area-inset-right,0px))] md:pb-[max(1rem,env(safe-area-inset-bottom,0px))] md:pl-[max(1rem,env(safe-area-inset-left,0px))]",
        )}
      >
        <DialogPrimitive.Popup
          data-slot="dialog-content"
          data-variant={variant}
          data-layout={variant === "drawer" ? undefined : mobileLayout}
          className={cn(
            "group/dialog outline-none",
            variant === "drawer"
              ? "relative flex h-full max-h-full min-h-0 w-full min-w-0 flex-col overflow-hidden rounded-sheet glass-sheet px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom,0px))] text-callout text-popover-foreground duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] data-open:animate-in data-open:slide-in-from-bottom data-closed:animate-out data-closed:slide-out-to-bottom sm:max-w-xl md:ml-auto md:rounded-dialog md:bg-surface-strong md:p-6 md:text-sm md:glass-float md:data-open:slide-in-from-right md:data-open:slide-in-from-bottom-0 md:data-closed:slide-out-to-right md:data-closed:slide-out-to-bottom-0"
              : "relative flex max-h-full min-h-0 w-full min-w-0 flex-col gap-3 overflow-y-auto overscroll-contain rounded-sheet glass-sheet px-4 pt-2 pb-[max(1.25rem,env(safe-area-inset-bottom,0px))] text-callout text-popover-foreground duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] data-open:animate-in data-open:slide-in-from-bottom data-closed:animate-out data-closed:slide-out-to-bottom data-[layout=nav]:grid data-[layout=nav]:grid-cols-[auto_minmax(0,1fr)_auto] data-[layout=nav]:grid-rows-[auto_auto_minmax(0,1fr)] data-[layout=nav]:items-center data-[layout=nav]:gap-x-2 sm:max-w-sm md:gap-4 md:rounded-dialog md:bg-dialog md:p-6 md:text-sm md:duration-200 md:ease-out md:glass-float md:data-open:fade-in-0 md:data-open:zoom-in-95 md:data-open:slide-in-from-bottom-2 md:data-closed:fade-out-0 md:data-closed:zoom-out-95 md:data-closed:slide-out-to-bottom-2 md:data-[layout=nav]:flex md:data-[layout=nav]:items-stretch",
            className
          )}
          {...props}
        >
          {variant === "default" ? (
            <div
              aria-hidden="true"
              data-slot="dialog-grab"
              className="col-span-3 mx-auto h-1.25 w-9.5 shrink-0 rounded-full bg-subtle-foreground/50 md:hidden"
            />
          ) : null}
          {children}
          {showCloseButton && (
            <DialogPrimitive.Close
              data-slot="dialog-close"
              render={
                <Button
                  variant="secondary"
                  className={cn(
                    "absolute group-data-[layout=nav]/dialog:hidden md:group-data-[layout=nav]/dialog:inline-flex",
                    variant === "drawer"
                      ? "top-4 right-4 md:top-6 md:right-6"
                      : "top-5 right-3.5 md:top-5 md:right-6",
                  )}
                  size="icon-sm"
                />
              }
            >
              <XIcon
              />
              <span className="sr-only">Close</span>
            </DialogPrimitive.Close>
          )}
        </DialogPrimitive.Popup>
      </DialogPrimitive.Viewport>
    </DialogPortal>
  )
}

function DialogBody({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-body"
      className={cn(
        "no-scrollbar -mx-1 min-h-0 overflow-x-hidden overflow-y-auto overscroll-contain scroll-py-2 px-1 py-1 group-data-[layout=nav]/dialog:col-span-3 group-data-[layout=nav]/dialog:row-start-3 group-data-[layout=nav]/dialog:self-stretch group-data-[variant=drawer]/dialog:flex-1 group-data-[variant=drawer]/dialog:py-4",
        className
      )}
      {...props}
    />
  )
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      className={cn(
        "flex shrink-0 flex-col gap-1.5 pt-2.5 pr-12 group-data-[variant=drawer]/dialog:flex-row group-data-[variant=drawer]/dialog:items-start group-data-[variant=drawer]/dialog:justify-between group-data-[variant=drawer]/dialog:gap-3 group-data-[variant=drawer]/dialog:pt-0 group-data-[variant=drawer]/dialog:pr-14 group-data-[layout=nav]/dialog:col-start-2 group-data-[layout=nav]/dialog:row-start-2 group-data-[layout=nav]/dialog:pt-0 group-data-[layout=nav]/dialog:pr-0 group-data-[layout=nav]/dialog:text-center md:pt-0 md:pr-12 md:group-data-[variant=drawer]/dialog:pr-14 md:group-data-[layout=nav]/dialog:pr-12 md:group-data-[layout=nav]/dialog:text-left",
        className
      )}
      {...props}
    />
  )
}

function DialogFooter({
  className,
  showCloseButton = false,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  showCloseButton?: boolean
}) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        "flex shrink-0 flex-wrap gap-2.5 pt-1 *:min-w-0 *:flex-1 group-data-[variant=drawer]/dialog:-mx-4 group-data-[variant=drawer]/dialog:mt-auto group-data-[variant=drawer]/dialog:border-t group-data-[variant=drawer]/dialog:border-border group-data-[variant=drawer]/dialog:px-4 group-data-[variant=drawer]/dialog:pt-4 group-data-[layout=nav]/dialog:contents group-data-[layout=nav]/dialog:*:row-start-2 group-data-[layout=nav]/dialog:*:flex-none group-data-[layout=nav]/dialog:*:first:col-start-1 group-data-[layout=nav]/dialog:*:first:glass-control group-data-[layout=nav]/dialog:*:last:col-start-3 md:-mx-6 md:-mb-6 md:justify-end md:border-t md:border-border md:px-6 md:py-4 md:*:flex-none md:group-data-[variant=drawer]/dialog:-mx-6 md:group-data-[variant=drawer]/dialog:px-6 md:group-data-[layout=nav]/dialog:flex",
        className
      )}
      {...props}
    >
      {children}
      {showCloseButton && (
        <DialogPrimitive.Close render={<Button variant="outline" />}>
          Close
        </DialogPrimitive.Close>
      )}
    </div>
  )
}

function DialogTitle({ className, ...props }: DialogPrimitive.Title.Props) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn(
        "min-w-0 font-heading text-panel-title leading-tight font-bold tracking-[-0.02em] group-data-[layout=nav]/dialog:truncate md:text-dialog-title",
        className
      )}
      {...props}
    />
  )
}

function DialogDescription({
  className,
  ...props
}: DialogPrimitive.Description.Props) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn(
        "text-sm leading-normal text-muted-foreground *:[a]:underline *:[a]:underline-offset-3 *:[a]:hover:text-foreground",
        className
      )}
      {...props}
    />
  )
}

// The list page scrolls inside <main>, so the dialog's document lock does not
// hold it. Pin that scroller while the popup is open, and size the popup to the
// visual viewport so the keyboard and browser chrome cannot push it off screen.
function lockDialogScroll(node: HTMLDivElement) {
  const main = document.querySelector("main")
  const lockedMain = main?.scrollTop ?? 0
  const lockedX = window.scrollX
  const lockedY = window.scrollY
  const previousOverflow = main?.style.overflow ?? ""
  const previousOverscroll = main?.style.overscrollBehavior ?? ""

  if (main) {
    main.style.overflow = "hidden"
    main.style.overscrollBehavior = "none"
    if (main.scrollTop !== lockedMain) {
      main.scrollTop = lockedMain
    }
  }

  let pinning = false
  let active = true
  const pinBackground = () => {
    if (pinning) return
    pinning = true
    if (main && main.scrollTop !== lockedMain) {
      main.scrollTop = lockedMain
    }
    if (window.scrollX !== lockedX || window.scrollY !== lockedY) {
      window.scrollTo(lockedX, lockedY)
    }
    pinning = false
  }

  const applyViewportBox = () => {
    const visualViewport = window.visualViewport
    if (!visualViewport) return
    node.style.top = `${visualViewport.offsetTop}px`
    node.style.height = `${visualViewport.height}px`
  }

  const onViewportResize = () => {
    pinBackground()
    applyViewportBox()
    revealDialogField(document.activeElement)
  }

  const onViewportScroll = () => {
    pinBackground()
    applyViewportBox()
  }

  const onFocusIn = (event: FocusEvent) => {
    pinBackground()
    if (node.contains(event.target as Node)) {
      revealDialogField(event.target)
    }
    requestAnimationFrame(() => {
      if (!active) return
      pinBackground()
      if (node.contains(event.target as Node)) {
        revealDialogField(event.target)
      }
    })
  }

  applyViewportBox()
  const visualViewport = window.visualViewport
  visualViewport?.addEventListener("resize", onViewportResize)
  visualViewport?.addEventListener("scroll", onViewportScroll)
  main?.addEventListener("scroll", pinBackground)
  window.addEventListener("scroll", pinBackground)
  document.addEventListener("focusin", onFocusIn)

  return () => {
    active = false
    visualViewport?.removeEventListener("resize", onViewportResize)
    visualViewport?.removeEventListener("scroll", onViewportScroll)
    main?.removeEventListener("scroll", pinBackground)
    window.removeEventListener("scroll", pinBackground)
    document.removeEventListener("focusin", onFocusIn)
    if (main) {
      main.style.overflow = previousOverflow
      main.style.overscrollBehavior = previousOverscroll
      if (main.scrollTop !== lockedMain) {
        main.scrollTop = lockedMain
      }
    }
    node.style.top = ""
    node.style.height = ""
  }
}

function revealDialogField(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return

  const body = target.closest("[data-slot='dialog-body']")
  if (body instanceof HTMLElement) {
    scrollFieldInto(body, target)
    return
  }

  const popup = target.closest("[data-slot='dialog-content']")
  if (!(popup instanceof HTMLElement)) return
  if (popup.querySelector("[data-slot='dialog-body']")) return
  scrollFieldInto(popup, target)
}

function scrollFieldInto(scroller: HTMLElement, field: HTMLElement) {
  const fieldRect = field.getBoundingClientRect()
  const scrollerRect = scroller.getBoundingClientRect()
  const padding = 12

  if (fieldRect.bottom > scrollerRect.bottom - padding) {
    scroller.scrollTop += fieldRect.bottom - (scrollerRect.bottom - padding)
  } else if (fieldRect.top < scrollerRect.top + padding) {
    scroller.scrollTop -= scrollerRect.top + padding - fieldRect.top
  }
}

export {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
}
