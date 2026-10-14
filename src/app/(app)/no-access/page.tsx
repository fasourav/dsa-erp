import Link from "next/link"
import { ShieldX } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"

export const metadata = { title: "No Access" }

export default function NoAccessPage() {
  return (
    <div className="flex min-h-[70dvh] items-center justify-center">
      <Empty className="max-w-md">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <ShieldX aria-hidden="true" />
          </EmptyMedia>
          <EmptyTitle>No Access</EmptyTitle>
          <EmptyDescription>
            Your account does not have permission to view a module. Ask an owner to update your access.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button variant="outline" nativeButton={false} render={<Link href="/dashboard" />}>
            Home
          </Button>
        </EmptyContent>
      </Empty>
    </div>
  )
}
