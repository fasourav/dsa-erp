import { cn } from "@/lib/utils"

export function MailtoLink({
  email,
  className,
}: {
  email: string
  className?: string
}) {
  const value = email.trim()
  if (!value) return null

  return (
    <a
      href={`mailto:${value}`}
      className={cn(
        "break-all text-primary underline-offset-2 hover:underline",
        className,
      )}
      onClick={(event) => event.stopPropagation()}
    >
      {value}
    </a>
  )
}

export function TelLink({
  phone,
  className,
}: {
  phone: string
  className?: string
}) {
  const value = phone.trim()
  if (!value) return null

  const href = `tel:${value.replace(/[^\d+]/g, "")}`

  return (
    <a
      href={href}
      className={cn(
        "tabular-nums text-primary underline-offset-2 hover:underline",
        className,
      )}
      onClick={(event) => event.stopPropagation()}
    >
      {value}
    </a>
  )
}
