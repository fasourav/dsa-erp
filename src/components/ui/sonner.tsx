"use client"

import { useSyncExternalStore } from "react"
import { Toaster as Sonner, type ToasterProps } from "sonner"
import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
} from "lucide-react"

function subscribe(onStoreChange: () => void) {
  const observer = new MutationObserver(onStoreChange)
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class"],
  })
  return () => observer.disconnect()
}

function themeSnapshot(): "light" | "dark" {
  return document.documentElement.classList.contains("dark") ? "dark" : "light"
}

const Toaster = ({ ...props }: ToasterProps) => {
  const theme = useSyncExternalStore(subscribe, themeSnapshot, () => "light" as const)

  return (
    <Sonner
      theme={theme}
      className="toaster group"
      icons={{
        success: <CircleCheckIcon className="size-4" />,
        info: <InfoIcon className="size-4" />,
        warning: <TriangleAlertIcon className="size-4" />,
        error: <OctagonXIcon className="size-4" />,
        loading: <Loader2Icon className="size-4 animate-spin" />,
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--rim)",
          "--success-bg": "var(--popover)",
          "--success-text": "var(--success)",
          "--success-border": "var(--rim)",
          "--error-bg": "var(--popover)",
          "--error-text": "var(--destructive)",
          "--error-border": "var(--rim)",
          "--border-radius": "var(--radius-2xl)",
          "--width": "min(356px, calc(100vw - 32px))",
        } as React.CSSProperties
      }
      position="top-center"
      offset={{ top: "calc(env(safe-area-inset-top, 0px) + 16px)" }}
      mobileOffset={{ top: "calc(env(safe-area-inset-top, 0px) + 10px)", left: "16px", right: "16px" }}
      toastOptions={{
        classNames: {
          toast:
            "cn-toast glass-float shadow-float! font-sans text-callout! md:text-ui! [&_[data-title]]:font-semibold [&_[data-description]]:text-muted-foreground!",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
