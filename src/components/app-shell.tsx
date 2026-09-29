import { AppSidebar } from "@/components/app-sidebar"
import { SignOutButton } from "@/components/sign-out-button"

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-svh flex-col bg-background md:flex-row">
      <AppSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-end border-b px-4 py-3 md:px-8">
          <SignOutButton />
        </header>
        <main className="flex-1 px-4 py-6 md:px-10 md:py-8">{children}</main>
      </div>
    </div>
  )
}
