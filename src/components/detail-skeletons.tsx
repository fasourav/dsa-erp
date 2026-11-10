import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

function ListPanelSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div aria-hidden="true" className="overflow-hidden rounded-card glass-panel">
      {Array.from({ length: rows }, (_, index) => (
        <div
          key={index}
          className="flex items-center justify-between gap-4 border-t border-border px-4 py-3.5 first:border-t-0 md:px-6"
        >
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <Skeleton className="h-4 w-2/5 md:w-1/4" />
            <Skeleton className="h-3 w-1/3 md:hidden" />
          </div>
          <Skeleton className="h-4 w-20 md:w-28" />
        </div>
      ))}
    </div>
  )
}

export function ProjectDetailSkeleton() {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className="flex min-w-0 flex-col gap-3.5"
    >
      <span className="sr-only">Loading</span>
      <div aria-hidden="true" className="flex flex-col gap-3">
        <div className="hidden items-center gap-2 md:flex">
          <Skeleton className="size-8 rounded-full" />
          <Skeleton className="h-4 w-44" />
        </div>
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2.5">
            <Skeleton className="h-8 w-52 rounded-xl md:h-9 md:w-64" />
            <Skeleton className="h-6 w-20 rounded-full" />
          </div>
          <div className="hidden items-center gap-2 md:flex">
            <Skeleton className="h-9 w-24 rounded-full" />
            <Skeleton className="h-9 w-28 rounded-full" />
            <Skeleton className="h-9 w-28 rounded-full" />
          </div>
        </div>
      </div>

      <div
        aria-hidden="true"
        className="grid grid-cols-2 gap-2.5 md:grid-cols-3 md:gap-4 xl:grid-cols-6"
      >
        {Array.from({ length: 6 }, (_, index) => (
          <Card key={index} size="sm">
            <CardContent className="flex flex-col gap-2">
              <Skeleton className="h-3.5 w-24" />
              <Skeleton className="h-6 w-28" />
            </CardContent>
          </Card>
        ))}
      </div>

      <div
        aria-hidden="true"
        className="grid grid-cols-2 gap-2.5 md:grid-cols-4 md:gap-4"
      >
        {Array.from({ length: 4 }, (_, index) => (
          <Card key={index} size="sm">
            <CardContent className="flex flex-col gap-2">
              <Skeleton className="h-3.5 w-20" />
              <Skeleton className="h-5 w-28" />
            </CardContent>
          </Card>
        ))}
      </div>

      <div aria-hidden="true" className="flex items-center gap-2">
        <Skeleton className="h-9 w-24 rounded-full" />
        <Skeleton className="h-9 w-24 rounded-full" />
        <Skeleton className="h-9 w-24 rounded-full" />
      </div>

      <ListPanelSkeleton rows={5} />
    </div>
  )
}

export function PurchaseOrderDetailSkeleton() {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className="flex min-w-0 flex-col gap-3.5"
    >
      <span className="sr-only">Loading</span>
      <div
        aria-hidden="true"
        className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between"
      >
        <div className="flex flex-col gap-2">
          <Skeleton className="hidden h-4 w-44 md:block" />
          <Skeleton className="h-3.5 w-28" />
          <Skeleton className="h-8 w-56 rounded-xl md:h-9 md:w-72" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-28 rounded-full" />
          <Skeleton className="h-9 w-32 rounded-full" />
        </div>
      </div>

      <div
        aria-hidden="true"
        className="grid grid-cols-1 gap-2.5 md:grid-cols-3 md:gap-4"
      >
        {Array.from({ length: 3 }, (_, index) => (
          <Card key={index} size="sm">
            <CardContent className="flex flex-col gap-2">
              <Skeleton className="h-3.5 w-24" />
              <Skeleton className="h-6 w-32" />
            </CardContent>
          </Card>
        ))}
      </div>

      <Card aria-hidden="true" size="sm">
        <CardContent className="flex flex-col gap-2.5">
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-4 w-3/4" />
        </CardContent>
      </Card>

      <ListPanelSkeleton rows={5} />
    </div>
  )
}

export function PayrollDetailSkeleton() {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className="flex min-w-0 flex-col gap-3.5"
    >
      <span className="sr-only">Loading</span>
      <div
        aria-hidden="true"
        className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between"
      >
        <div className="flex flex-col gap-2">
          <Skeleton className="hidden h-4 w-40 md:block" />
          <Skeleton className="h-8 w-48 rounded-xl md:h-9 md:w-60" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-28 rounded-full" />
        </div>
      </div>

      <div
        aria-hidden="true"
        className="grid grid-cols-2 gap-2.5 md:grid-cols-4 md:gap-4"
      >
        {Array.from({ length: 4 }, (_, index) => (
          <Card key={index} size="sm">
            <CardContent className="flex flex-col gap-2">
              <Skeleton className="h-3.5 w-24" />
              <Skeleton className="h-6 w-28" />
            </CardContent>
          </Card>
        ))}
      </div>

      <div aria-hidden="true" className="flex items-center gap-2">
        <Skeleton className="h-9 w-28 rounded-full" />
        <Skeleton className="h-9 w-28 rounded-full" />
      </div>

      <ListPanelSkeleton rows={5} />
    </div>
  )
}

export function StatementSkeleton() {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className="flex min-w-0 flex-col gap-3.5"
    >
      <span className="sr-only">Loading</span>
      <div
        aria-hidden="true"
        className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between"
      >
        <div className="flex flex-col gap-2">
          <Skeleton className="hidden h-4 w-40 md:block" />
          <Skeleton className="h-8 w-52 rounded-xl md:h-9 md:w-64" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-36 rounded-full" />
          <Skeleton className="h-9 w-28 rounded-full" />
        </div>
      </div>

      <Card aria-hidden="true">
        <CardContent className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
          {Array.from({ length: 4 }, (_, index) => (
            <div key={index} className="flex flex-col gap-2">
              <Skeleton className="h-3.5 w-20" />
              <Skeleton className="h-6 w-28" />
            </div>
          ))}
        </CardContent>
      </Card>

      <ListPanelSkeleton rows={5} />
    </div>
  )
}

export function ReportSkeleton() {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className="flex min-w-0 flex-col gap-3.5"
    >
      <span className="sr-only">Loading</span>
      <div
        aria-hidden="true"
        className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between"
      >
        <div className="flex flex-col gap-2">
          <Skeleton className="hidden h-4 w-36 md:block" />
          <Skeleton className="h-8 w-52 rounded-xl md:h-9 md:w-64" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-24 rounded-full md:hidden" />
          <Skeleton className="h-9 w-28 rounded-full" />
        </div>
      </div>

      <div aria-hidden="true" className="hidden items-center gap-2.5 md:flex">
        <Skeleton className="h-10 w-40 rounded-control" />
        <Skeleton className="h-10 w-40 rounded-control" />
        <Skeleton className="h-10 w-44 rounded-control" />
      </div>

      <ListPanelSkeleton rows={6} />
    </div>
  )
}

export function DocumentStudioSkeleton() {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className="flex w-full min-w-0 flex-col gap-3.5"
    >
      <span className="sr-only">Loading</span>
      <div
        aria-hidden="true"
        className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between"
      >
        <div className="flex flex-col gap-2">
          <Skeleton className="h-8 w-44 rounded-xl md:h-9 md:w-56" />
          <Skeleton className="h-4 w-64 max-w-full" />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Skeleton className="h-9 w-20 rounded-full" />
          <Skeleton className="h-9 w-20 rounded-full" />
          <Skeleton className="h-9 w-32 rounded-full" />
          <Skeleton className="h-9 w-20 rounded-full" />
        </div>
      </div>

      <Skeleton aria-hidden="true" className="h-10 w-full rounded-full md:hidden" />

      <div
        aria-hidden="true"
        className="grid min-w-0 grid-cols-1 items-start gap-4 md:grid-cols-2 md:gap-6"
      >
        <Card className="min-w-0">
          <CardContent className="flex flex-col gap-4">
            <Skeleton className="h-11 w-full rounded-control" />
            <Skeleton className="h-11 w-full rounded-control" />
            <Skeleton className="h-11 w-full rounded-control" />
            <Skeleton className="h-24 w-full rounded-control" />
            <Skeleton className="h-32 w-full rounded-control" />
          </CardContent>
        </Card>
        <div className="hidden min-w-0 rounded-card bg-fill p-4 md:block md:p-8">
          <Skeleton className="mx-auto aspect-[210/297] w-full max-w-md rounded-md" />
        </div>
      </div>
    </div>
  )
}
