"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { ChevronDown, Ellipsis, LogOut, UserRound } from "lucide-react"

import { signOut } from "@/app/auth/actions"
import {
  applyTheme,
  currentThemePreference,
  nextThemePreference,
  ThemeIcon,
  themeLabel,
} from "@/components/theme-toggle"
import { APP_VERSION_LABEL } from "@/lib/app-version"
import type { ThemePreference } from "@/lib/theme"
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
import { accountSubtitle, type AccountIdentity } from "@/lib/account-identity"
import { UserAvatar } from "@/components/user-avatar"

function AccountHeader({ account }: { account: AccountIdentity }) {
  return (
    <DropdownMenuGroup>
    <DropdownMenuLabel className="flex items-center gap-3 px-2.5 py-2">
      <UserAvatar
        name={account.name}
        email={account.email}
        avatarUrl={account.avatarUrl}
        className="size-9.5 text-label"
      />
      <span className="min-w-0">
        <span className="block truncate text-callout font-semibold text-foreground md:text-ui">
          {account.name}
        </span>
        <span className="block truncate text-caption font-normal text-muted-foreground">
          {account.email || accountSubtitle(account)}
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
            className="pr-2.5 pl-1.5"
            aria-label={`${account.name}, ${account.email || accountSubtitle(account)}`}
          />
        }
      >
        <UserAvatar
          name={account.name}
          email={account.email}
          avatarUrl={account.avatarUrl}
          className="size-6 text-micro"
        />
        <span className="max-w-32 truncate">{firstName}</span>
        <ChevronDown aria-hidden="true" className="size-3.5 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8} className="w-64">
        <AccountHeader account={account} />
        <DropdownMenuSeparator />
        <DropdownMenuItem render={<Link href="/profile" prefetch={false} />}>
          <UserRound aria-hidden="true" />
          My Profile
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" disabled={pending} onClick={handleSignOut}>
          <LogOut aria-hidden="true" />
          Sign Out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

// Phone nav bar "more" menu: everything the desktop top bar holds.
export function MobileMoreMenu({ account }: { account: AccountIdentity }) {
  const { pending, signOut: handleSignOut } = useSignOut()
  const [theme, setTheme] = useState<ThemePreference | null>(null)

  return (
    <DropdownMenu
      onOpenChange={(open) => {
        if (open) setTheme(currentThemePreference())
      }}
    >
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="More"
            className="bg-fill shadow-none backdrop-blur-none hover:bg-fill-strong aria-expanded:bg-fill-strong"
          />
        }
      >
        <Ellipsis aria-hidden="true" className="size-5" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8} className="w-72">
        <AccountHeader account={account} />
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem render={<Link href="/profile" prefetch={false} />}>
            <UserRound aria-hidden="true" />
            My Profile
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => {
              const next = nextThemePreference(currentThemePreference())
              applyTheme(next)
              setTheme(next)
            }}
          >
            <ThemeIcon preference={theme ?? "light"} />
            {`Appearance: ${themeLabel(theme ?? "light")}`}
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" disabled={pending} onClick={handleSignOut}>
          <LogOut aria-hidden="true" />
          Sign Out
        </DropdownMenuItem>
        <p className="px-2.5 pt-2 pb-1 text-center text-micro text-muted-foreground">
          {APP_VERSION_LABEL}
        </p>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
