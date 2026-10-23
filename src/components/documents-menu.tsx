"use client"

import { ChevronDown, FileText, Files } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"

import { useAccess } from "@/components/access-provider"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { canViewDocumentKind, documentKinds } from "@/lib/documents/kinds"

export function DocumentsMenu() {
  const access = useAccess()
  const pathname = usePathname()
  const visible = documentKinds.filter((kind) => canViewDocumentKind(access, kind))
  if (visible.length === 0) return null

  const active = pathname === "/documents" || pathname.startsWith("/documents/")

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            variant="outline"
            size="sm"
            aria-current={active ? "page" : undefined}
            className="aria-[current=page]:bg-primary-tint aria-[current=page]:text-primary-text"
          />
        }
      >
        <Files aria-hidden="true" />
        Documents
        <ChevronDown aria-hidden="true" className="size-3.5 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8} className="w-60">
        <DropdownMenuItem render={<Link href="/documents" />}>
          <Files aria-hidden="true" />
          All Documents
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {visible.map((kind) => (
          <DropdownMenuItem key={kind.href} render={<Link href={kind.href} />}>
            <FileText aria-hidden="true" />
            {kind.title}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
