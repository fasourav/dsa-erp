"use client"

import * as React from "react"
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"
import { cn } from "cn"

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
        "fixed inset-0 isolate z-50 min-h-dvh bg-black/10 duration-100 supports-[-webkit-touch-callout:none]:absolute supports-backdrop-filter:backdrop-blur-xs data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0",
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
  ...props
}: DialogPrimitive.Popup.Props & {
  showCloseButton?: boolean
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
        className="fixed inset-x-0 top-0 z-50 flex h-dvh w-full flex-col items-center justify-center overflow-hidden overscroll-none pt-[max(1rem,env(safe-area-inset-top,0px))] pr-[max(1rem,env(safe-area-inset-right,0px))] pb-[max(1rem,env(safe-area-inset-bottom,0px))] pl-[max(1rem,env(safe-area-inset-left,0px))]"
      >
        <DialogPrimitive.Popup
          data-slot="dialog-content"
          className={cn(
            "relative flex max-h-full min-h-0 w-full min-w-0 flex-col gap-4 overflow-y-auto overscroll-contain rounded-xl bg-popover p-4 text-sm text-popover-foreground ring-1 ring-foreground/10 duration-100 outline-none sm:max-w-sm data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
            className
          )}
          {...props}
        >
          {children}
          {showCloseButton && (
            <DialogPrimitive.Close
              data-slot="dialog-close"
              render={
                <Button
                  variant="ghost"
                  className="absolute top-2 right-2"
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
        "min-h-0 overflow-x-hidden overflow-y-auto overscroll-contain scroll-py-2",
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
      className={cn("flex shrink-0 flex-col gap-2", className)}
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
        "-mx-4 -mb-4 flex shrink-0 flex-col-reverse gap-2 rounded-b-xl border-t bg-muted/50 p-4 sm:flex-row sm:justify-end",
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
        "font-heading text-base leading-none font-medium",
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
        "text-sm text-muted-foreground *:[a]:underline *:[a]:underline-offset-3 *:[a]:hover:text-foreground",
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
