import { accountInitials } from "@/lib/account-identity"
import { cn } from "@/lib/utils"

export function UserAvatar({
  name,
  email,
  avatarUrl,
  className,
}: {
  name: string
  email: string
  avatarUrl: string | null
  className?: string
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-avatar font-bold text-on-color",
        className,
      )}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- private signed URL */}
      {avatarUrl ? <img src={avatarUrl} alt="" className="size-full object-cover" /> : accountInitials(name, email)}
    </span>
  )
}
