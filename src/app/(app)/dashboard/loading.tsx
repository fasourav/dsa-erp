import { PageHeader } from "@/components/page-header"
import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

export function DashboardSkeleton() {
  return (
    <div className="flex w-full min-w-0 flex-col gap-2.5 md:gap-4" aria-busy="true">
      <PageHeader
        title="Dashboard"
        actions={
          <>
            <Skeleton className="h-9 w-24 rounded-full" />
            <Skeleton className="h-9 w-24 rounded-control" />
          </>
        }
      />

      <section aria-hidden="true" className="flex flex-col gap-2.5 md:gap-4">
        <div className="grid min-w-0 grid-cols-1 gap-2.5 md:grid-cols-2 md:gap-4 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Card key={index} className="min-w-0 gap-0 px-4 pt-4 pb-2.5 md:px-5.5 md:pt-5 md:pb-1.5">
              <div className="flex items-center justify-between gap-3">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-6 w-14 rounded-full" />
              </div>
              <Skeleton className="mt-2 h-8 w-36 md:mt-2.5" />
              <Skeleton className="mt-1 hidden h-4 w-20 md:block" />
              <Skeleton className="mt-1.5 h-11.5 w-full md:mt-2 md:h-16" />
            </Card>
          ))}
        </div>

        <div className="grid min-w-0 grid-cols-2 gap-2.5 md:grid-cols-3 md:gap-0 md:overflow-hidden md:rounded-card md:glass-panel xl:grid-cols-5">
          {Array.from({ length: 5 }).map((_, index) => (
            <div
              key={index}
              className="min-w-0 rounded-2xl bg-surface px-3.5 py-3.25 shadow-glass backdrop-blur-glass backdrop-saturate-180 last:col-span-2 md:rounded-none md:border-l md:border-border md:bg-transparent md:px-5 md:py-4.5 md:shadow-none md:backdrop-blur-none md:backdrop-saturate-100 md:first:border-l-0 md:last:col-span-1"
            >
              <Skeleton className="h-3.5 w-24" />
              <Skeleton className="mt-2 h-5 w-28" />
              <Skeleton className="mt-1 hidden h-3.5 w-16 md:block" />
            </div>
          ))}
        </div>
      </section>

      <div className="grid grid-cols-1 gap-2.5 md:gap-4 xl:grid-cols-2" aria-hidden="true">
        <Card className="p-4 md:p-6">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="mt-4 h-48 w-full md:h-72" />
        </Card>
        <Card className="p-4 md:p-6">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="mx-auto mt-6 size-50 rounded-full md:size-49" />
        </Card>
      </div>
    </div>
  )
}

export default function DashboardLoading() {
  return <DashboardSkeleton />
}
