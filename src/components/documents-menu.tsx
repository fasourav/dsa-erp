"use client"

import { Files } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"

import { useAccess } from "@/components/access-provider"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { allows } from "@/lib/access"
import { documentKinds } from "@/lib/documents/kinds"

export function DocumentsMenu() {
  const access = useAccess()
  const pathname = usePathname()
  const visible = documentKinds.filter((kind) => allows(access, kind.module, "view"))
  if (visible.length === 0) return null

  const active = pathname === "/documents" || pathname.startsWith("/documents/")

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            variant={active ? "secondary" : "outline"}
            aria-current={active ? "page" : undefined}
          />
        }
      >
        <Files aria-hidden="true" className="size-4" />
        Documents
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem render={<Link href="/documents" />}>All Documents</DropdownMenuItem>
        {visible.map((kind) => (
          <DropdownMenuItem key={kind.href} render={<Link href={kind.href} />}>
            {kind.title}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
