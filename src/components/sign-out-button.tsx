import { signOut } from "@/app/auth/actions"
import { Button } from "@/components/ui/button"

export function SignOutButton() {
  return (
    <form action={signOut} className="shrink-0">
      <Button type="submit" variant="outline">
        Sign out
      </Button>
    </form>
  )
}
