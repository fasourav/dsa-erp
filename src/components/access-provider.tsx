"use client"

import { createContext, useContext, type ReactNode } from "react"

import {
  allows,
  type AccessSnapshot,
  type PermissionAction,
} from "@/lib/access"

const AccessContext = createContext<AccessSnapshot | null>(null)

export function AccessProvider({
  access,
  children,
}: {
  access: AccessSnapshot
  children: ReactNode
}) {
  return <AccessContext.Provider value={access}>{children}</AccessContext.Provider>
}

export function useAccess(): AccessSnapshot {
  const access = useContext(AccessContext)
  if (!access) {
    throw new Error("Access is unavailable.")
  }
  return access
}

export function useCan(module: string, action: PermissionAction): boolean {
  return allows(useAccess(), module, action)
}
