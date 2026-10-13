"use client"

import { useTransition } from "react"
import Link from "next/link"
import { LogOut, UserRound } from "lucide-react"

import { signOut } from "@/app/auth/actions"
import {
  accountInitials,
  accountSubtitle,
  type AccountIdentity,
} from "@/lib/account-identity"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export function AccountMenu({
  account,
  collapsed = false,
}: {
  account: AccountIdentity
  collapsed?: boolean
}) {
  const [pending, startTransition] = useTransition()
  const subtitle = accountSubtitle(account)
  const initials = accountInitials(account.name, account.email)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            className={cn(
              "h-auto min-h-9 max-w-full justify-start px-2 py-1",
              collapsed && "md:size-9 md:justify-center md:px-0",
            )}
            aria-label={`${account.name}, ${subtitle}`}
          />
        }
      >
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-medium text-foreground">
          {initials}
        </span>
        <span className={cn("min-w-0 text-left", collapsed && "md:sr-only")}>
          <span className="block truncate text-sm font-medium">{account.name}</span>
          <span className="block truncate text-sm text-muted-foreground">{subtitle}</span>
        </span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem render={<Link href="/profile" />}>
          <UserRound aria-hidden="true" className="size-4" />
          My Profile
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          disabled={pending}
          onClick={() => {
            startTransition(() => {
              void signOut()
            })
          }}
        >
          <LogOut aria-hidden="true" className="size-4" />
          Sign Out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
