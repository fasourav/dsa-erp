"use client"

import { ChevronDown, FileBarChart, FileText } from "lucide-react"
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
import { canSeeReport } from "@/lib/access"
import { reportDefinitions } from "@/lib/reports/catalog"

export function ReportsMenu() {
  const access = useAccess()
  const pathname = usePathname()
  const visible = reportDefinitions.filter((report) => canSeeReport(access, report.slug))
  if (visible.length === 0) return null

  const active = pathname === "/reports" || pathname.startsWith("/reports/")

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            variant="outline"
            size="sm"
            aria-label="Reports"
            aria-current={active ? "page" : undefined}
            className="aria-[current=page]:bg-primary-tint aria-[current=page]:text-primary-text"
          />
        }
      >
        <FileBarChart aria-hidden="true" />
        <span className="hidden xl:inline">Reports</span>
        <ChevronDown aria-hidden="true" className="size-3.5 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8} className="w-64">
        <DropdownMenuItem render={<Link href="/reports" prefetch={false} />}>
          <FileBarChart aria-hidden="true" />
          All Reports
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {visible.map((report) => (
          <DropdownMenuItem key={report.slug} render={<Link href={`/reports/${report.slug}`} prefetch={false} />}>
            <FileText aria-hidden="true" />
            {report.title}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
