"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { ChevronDown, Ellipsis, Files, LogOut, Moon, Sun, UserRound } from "lucide-react"

import { signOut } from "@/app/auth/actions"
import { useAccess } from "@/components/access-provider"
import { applyTheme, currentTheme } from "@/components/theme-toggle"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { canOpenDocuments } from "@/lib/access"
import {
  accountInitials,
  accountSubtitle,
  type AccountIdentity,
} from "@/lib/account-identity"

function Avatar({ account, className }: { account: AccountIdentity; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={
        className ??
        "flex size-6 shrink-0 items-center justify-center rounded-full bg-avatar text-micro font-bold text-on-color"
      }
    >
      {accountInitials(account.name, account.email)}
    </span>
  )
}

function AccountHeader({ account }: { account: AccountIdentity }) {
  return (
    <DropdownMenuGroup>
    <DropdownMenuLabel className="flex items-center gap-3 px-2.5 py-2">
      <Avatar
        account={account}
        className="flex size-9.5 shrink-0 items-center justify-center rounded-full bg-avatar text-label font-bold text-on-color"
      />
      <span className="min-w-0">
        <span className="block truncate text-callout font-semibold text-foreground md:text-ui">
          {account.name}
        </span>
        <span className="block truncate text-caption font-normal text-muted-foreground">
          {accountSubtitle(account)}
        </span>
      </span>
    </DropdownMenuLabel>
    </DropdownMenuGroup>
  )
}

function useSignOut() {
  const [pending, startTransition] = useTransition()
  return {
    pending,
    signOut: () =>
      startTransition(() => {
        void signOut()
      }),
  }
}

// Desktop top bar profile menu.
export function AccountMenu({ account }: { account: AccountIdentity }) {
  const { pending, signOut: handleSignOut } = useSignOut()
  const firstName = account.name.split(/\s+/)[0] || account.name

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="pr-2.5 pl-1.5"
            aria-label={`${account.name}, ${accountSubtitle(account)}`}
          />
        }
      >
        <Avatar account={account} />
        <span className="max-w-32 truncate">{firstName}</span>
        <ChevronDown aria-hidden="true" className="size-3.5 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8} className="w-64">
        <AccountHeader account={account} />
        <DropdownMenuSeparator />
        <DropdownMenuItem render={<Link href="/profile" />}>
          <UserRound aria-hidden="true" />
          My Profile
        </DropdownMenuItem>
        <DropdownMenuItem disabled={pending} onClick={handleSignOut}>
          <LogOut aria-hidden="true" />
          Sign Out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

// Phone nav bar "more" menu: everything the desktop top bar holds.
export function MobileMoreMenu({ account }: { account: AccountIdentity }) {
  const access = useAccess()
  const { pending, signOut: handleSignOut } = useSignOut()
  const [dark, setDark] = useState<boolean | null>(null)

  return (
    <DropdownMenu
      onOpenChange={(open) => {
        if (open) setDark(currentTheme() === "dark")
      }}
    >
      <DropdownMenuTrigger
        render={<Button type="button" variant="outline" size="icon" aria-label="More" />}
      >
        <Ellipsis aria-hidden="true" className="size-5" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8} className="w-72">
        <AccountHeader account={account} />
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          {canOpenDocuments(access) ? (
            <DropdownMenuItem render={<Link href="/documents" />}>
              <Files aria-hidden="true" />
              Documents
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuItem render={<Link href="/profile" />}>
            <UserRound aria-hidden="true" />
            My Profile
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => {
              const next = currentTheme() === "dark" ? "light" : "dark"
              applyTheme(next)
              setDark(next === "dark")
            }}
          >
            {dark ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}
            {dark ? "Light Appearance" : "Dark Appearance"}
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" disabled={pending} onClick={handleSignOut}>
          <LogOut aria-hidden="true" />
          Sign Out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
