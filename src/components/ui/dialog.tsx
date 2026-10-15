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

function isDialogPart(child: React.ReactNode, part: unknown) {
  return React.isValidElement(child) && child.type === part
}

// Phone nav sheets keep Cancel / title / Save on one row. That row used to be
// a grid track on the popup itself (`minmax(0, 1fr)`), which WebKit sizes to
// the form instead of the viewport. The body then never becomes a scrollport,
// the viewport clips it, and the scroll pin makes the gesture feel frozen.
function DialogNavFrame({ children }: { children: React.ReactNode }) {
  const header: React.ReactNode[] = []
  const footer: React.ReactNode[] = []
  const rest: React.ReactNode[] = []
  React.Children.forEach(children, (child) => {
    if (isDialogPart(child, DialogHeader)) header.push(child)
    else if (isDialogPart(child, DialogFooter)) footer.push(child)
    else rest.push(child)
  })
  if (header.length === 0 || footer.length === 0) return children
  return (
    <>
      <div
        data-slot="dialog-nav"
        className="grid shrink-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-2 md:contents"
      >
        {header}
        {footer}
      </div>
      {rest}
    </>
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
              : "relative flex max-h-full min-h-0 w-full min-w-0 flex-col gap-3 overflow-y-auto overscroll-contain rounded-sheet glass-sheet px-4 pt-2 pb-[max(1.25rem,env(safe-area-inset-bottom,0px))] text-callout text-popover-foreground duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] data-open:animate-in data-open:slide-in-from-bottom data-closed:animate-out data-closed:slide-out-to-bottom has-[[data-slot=dialog-body]]:overflow-hidden sm:max-w-sm md:gap-4 md:rounded-dialog md:bg-dialog md:p-6 md:text-sm md:duration-200 md:ease-out md:glass-float md:data-open:fade-in-0 md:data-open:zoom-in-95 md:data-open:slide-in-from-bottom-2 md:data-closed:fade-out-0 md:data-closed:zoom-out-95 md:data-closed:slide-out-to-bottom-2",
            className
          )}
          {...props}
        >
          {variant === "default" ? (
            <div
              aria-hidden="true"
              data-slot="dialog-grab"
              className="mx-auto h-1.25 w-9.5 shrink-0 rounded-full bg-subtle-foreground/50 md:hidden"
            />
          ) : null}
          {variant !== "drawer" && mobileLayout === "nav" ? (
            <DialogNavFrame>{children}</DialogNavFrame>
          ) : (
            children
          )}
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
        "no-scrollbar relative -mx-1 min-h-0 touch-pan-y overflow-x-hidden overflow-y-auto overscroll-contain scroll-py-2 px-1 py-1 [-webkit-overflow-scrolling:touch] *:shrink-0 md:group-data-[layout=nav]/dialog:order-2 group-data-[variant=drawer]/dialog:flex-1 group-data-[variant=drawer]/dialog:py-4",
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
        "flex shrink-0 flex-col gap-1.5 pt-2.5 pr-12 group-data-[variant=drawer]/dialog:flex-row group-data-[variant=drawer]/dialog:items-start group-data-[variant=drawer]/dialog:justify-between group-data-[variant=drawer]/dialog:gap-3 group-data-[variant=drawer]/dialog:pt-0 group-data-[variant=drawer]/dialog:pr-14 group-data-[layout=nav]/dialog:col-start-2 group-data-[layout=nav]/dialog:row-start-1 group-data-[layout=nav]/dialog:min-w-0 group-data-[layout=nav]/dialog:pt-0 group-data-[layout=nav]/dialog:pr-0 group-data-[layout=nav]/dialog:text-center md:pt-0 md:pr-12 md:group-data-[variant=drawer]/dialog:pr-14 md:group-data-[layout=nav]/dialog:order-1 md:group-data-[layout=nav]/dialog:pr-12 md:group-data-[layout=nav]/dialog:text-left",
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
        "flex shrink-0 flex-wrap gap-2.5 pt-1 *:min-w-0 *:flex-1 group-data-[variant=drawer]/dialog:-mx-4 group-data-[variant=drawer]/dialog:mt-auto group-data-[variant=drawer]/dialog:border-t group-data-[variant=drawer]/dialog:border-border group-data-[variant=drawer]/dialog:px-4 group-data-[variant=drawer]/dialog:pt-4 group-data-[layout=nav]/dialog:contents group-data-[layout=nav]/dialog:*:row-start-1 group-data-[layout=nav]/dialog:*:flex-none group-data-[layout=nav]/dialog:*:first:col-start-1 group-data-[layout=nav]/dialog:*:first:glass-control group-data-[layout=nav]/dialog:*:last:col-start-3 md:-mx-6 md:-mb-6 md:justify-end md:border-t md:border-border md:px-6 md:py-4 md:*:flex-none md:group-data-[variant=drawer]/dialog:-mx-6 md:group-data-[variant=drawer]/dialog:px-6 md:group-data-[layout=nav]/dialog:order-3 md:group-data-[layout=nav]/dialog:flex",
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
        "min-w-0 font-heading text-panel-title leading-tight font-bold tracking-[-0.02em] group-data-[layout=nav]/dialog:text-balance group-data-[layout=nav]/dialog:wrap-break-word md:text-dialog-title md:group-data-[layout=nav]/dialog:text-wrap",
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
//
// iOS Safari will not scroll a sheet whose height is only `max-height: 100%`.
// Give the popup a definite pixel height when the form is taller than the
// visual viewport, and cap DialogBody so it — not the page — takes the pan.
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
  let touchX = 0
  let touchY = 0
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
    fitDialogSheet(node)
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

  const onTouchStart = (event: TouchEvent) => {
    const touch = event.touches[0]
    if (!touch) return
    touchX = touch.clientX
    touchY = touch.clientY
  }

  // Keep a pan inside the sheet. Once it would chain into the pinned page,
  // cancel it — otherwise iOS resets the gesture and the form feels frozen.
  const onTouchMove = (event: TouchEvent) => {
    if (event.touches.length !== 1) return
    const touch = event.touches[0]
    if (!touch) return
    const dx = touch.clientX - touchX
    const dy = touch.clientY - touchY
    if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return
    const target = event.target
    if (!(target instanceof Element)) {
      event.preventDefault()
      return
    }
    const scroller = closestSheetScroller(target, node)
    if (!scroller || Math.abs(dy) < Math.abs(dx)) {
      if (!scroller) event.preventDefault()
      return
    }
    const atTop = scroller.scrollTop <= 0
    const atBottom =
      scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 1
    if ((dy > 0 && atTop) || (dy < 0 && atBottom)) {
      event.preventDefault()
    }
  }

  applyViewportBox()
  const fitFrame = requestAnimationFrame(() => {
    if (!active) return
    applyViewportBox()
  })
  const visualViewport = window.visualViewport
  visualViewport?.addEventListener("resize", onViewportResize)
  visualViewport?.addEventListener("scroll", onViewportScroll)
  main?.addEventListener("scroll", pinBackground)
  window.addEventListener("scroll", pinBackground)
  document.addEventListener("focusin", onFocusIn)
  node.addEventListener("touchstart", onTouchStart, { passive: true })
  node.addEventListener("touchmove", onTouchMove, { passive: false })
  const popup = node.querySelector("[data-slot='dialog-content']")
  let fitQueued = false
  let fitAgain = false
  const queueFit = () => {
    if (!active) return
    if (fitQueued) {
      fitAgain = true
      return
    }
    fitQueued = true
    requestAnimationFrame(() => {
      fitQueued = false
      if (!active) return
      fitDialogSheet(node)
      if (!fitAgain) return
      fitAgain = false
      queueFit()
    })
  }
  const sheetObserver =
    popup instanceof HTMLElement ? new ResizeObserver(queueFit) : null
  if (popup instanceof HTMLElement) {
    sheetObserver?.observe(popup)
    const body = popup.querySelector("[data-slot='dialog-body']")
    if (body instanceof HTMLElement) sheetObserver?.observe(body)
  }

  return () => {
    active = false
    cancelAnimationFrame(fitFrame)
    sheetObserver?.disconnect()
    visualViewport?.removeEventListener("resize", onViewportResize)
    visualViewport?.removeEventListener("scroll", onViewportScroll)
    main?.removeEventListener("scroll", pinBackground)
    window.removeEventListener("scroll", pinBackground)
    document.removeEventListener("focusin", onFocusIn)
    node.removeEventListener("touchstart", onTouchStart)
    node.removeEventListener("touchmove", onTouchMove)
    if (main) {
      main.style.overflow = previousOverflow
      main.style.overscrollBehavior = previousOverscroll
      if (main.scrollTop !== lockedMain) {
        main.scrollTop = lockedMain
      }
    }
    node.style.top = ""
    node.style.height = ""
    clearDialogSheetFit(node)
  }
}

function closestSheetScroller(target: Element, root: HTMLElement) {
  let current: Element | null = target
  while (current && current !== root) {
    if (current instanceof HTMLElement) {
      const overflowY = getComputedStyle(current).overflowY
      if (
        (overflowY === "auto" || overflowY === "scroll") &&
        current.scrollHeight > current.clientHeight + 1
      ) {
        return current
      }
    }
    current = current.parentElement
  }
  return null
}

function fitDialogSheet(viewport: HTMLElement) {
  const popup = viewport.querySelector("[data-slot='dialog-content']")
  if (!(popup instanceof HTMLElement) || viewport.clientHeight < 1) return

  const viewportStyles = getComputedStyle(viewport)
  const available = Math.max(
    0,
    Math.floor(
      viewport.clientHeight -
        (Number.parseFloat(viewportStyles.paddingTop) || 0) -
        (Number.parseFloat(viewportStyles.paddingBottom) || 0),
    ),
  )
  popup.style.maxHeight = `${available}px`

  const body = popup.querySelector("[data-slot='dialog-body']")
  const bodyScrolls =
    body instanceof HTMLElement && body.scrollHeight > body.clientHeight + 1
  const contentBottom = sheetContentBottom(popup)
  // A locked height stays put after the form gets shorter (a field was
  // removed). Release it when the fields no longer fill the sheet.
  if (
    popup.style.height &&
    !bodyScrolls &&
    contentBottom + 1 < popup.clientHeight
  ) {
    popup.style.height = ""
    if (body instanceof HTMLElement) body.style.maxHeight = ""
    return
  }

  if (bodyScrolls || contentBottom <= available + 1) {
    if (!bodyScrolls) {
      popup.style.height = ""
      if (body instanceof HTMLElement) body.style.maxHeight = ""
    }
    return
  }

  popup.style.height = `${available}px`
  if (!(body instanceof HTMLElement)) return
  const room = dialogBodyRoom(popup, body)
  if (body.scrollHeight > room + 1 || body.clientHeight > room + 1) {
    body.style.maxHeight = `${room}px`
  }
}

// Space under the header and above a footer that sits below the fields.
// Phone nav keeps the actions in the header row, so they are not in this gap.
function dialogBodyRoom(popup: HTMLElement, body: HTMLElement) {
  const popupStyles = getComputedStyle(popup)
  const padBottom = Number.parseFloat(popupStyles.paddingBottom) || 0
  const gap = Number.parseFloat(popupStyles.rowGap) || 0
  let room = popup.clientHeight - body.offsetTop - padBottom
  const footer = popup.querySelector("[data-slot='dialog-footer']")
  if (
    footer instanceof HTMLElement &&
    getComputedStyle(footer).display !== "contents" &&
    footer.offsetTop >= body.offsetTop
  ) {
    room = Math.min(room, footer.offsetTop - body.offsetTop - gap)
  }
  return Math.max(0, Math.floor(room))
}

function sheetContentBottom(popup: HTMLElement) {
  const padBottom = Number.parseFloat(getComputedStyle(popup).paddingBottom) || 0
  let bottom = 0
  for (const child of popup.children) {
    if (!(child instanceof HTMLElement)) continue
    const style = getComputedStyle(child)
    if (style.display === "none" || style.position === "absolute") continue
    bottom = Math.max(bottom, child.offsetTop + child.offsetHeight)
  }
  return bottom + padBottom
}

function clearDialogSheetFit(viewport: HTMLElement) {
  const popup = viewport.querySelector("[data-slot='dialog-content']")
  if (!(popup instanceof HTMLElement)) return
  popup.style.maxHeight = ""
  popup.style.height = ""
  const body = popup.querySelector("[data-slot='dialog-body']")
  if (body instanceof HTMLElement) body.style.maxHeight = ""
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
