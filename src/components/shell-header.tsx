"use client"

import { createContext, useContext, type ReactNode } from "react"
import { createPortal } from "react-dom"

const ShellHeaderContext = createContext<HTMLElement | null>(null)

export function ShellHeaderProvider({
  slot,
  children,
}: {
  slot: HTMLElement | null
  children: ReactNode
}) {
  return <ShellHeaderContext.Provider value={slot}>{children}</ShellHeaderContext.Provider>
}

export function ShellHeader({ children }: { children: ReactNode }) {
  const slot = useContext(ShellHeaderContext)
  if (!slot) return null
  return createPortal(children, slot)
}
