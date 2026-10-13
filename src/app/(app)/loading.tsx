import { Skeleton } from "@/components/ui/skeleton"

export default function Loading() {
  return (
    <div role="status" aria-live="polite" className="flex flex-col gap-4 md:gap-5">
      <span className="sr-only">Loading</span>
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-9 w-44 rounded-xl md:h-10 md:w-56" />
          <Skeleton className="h-4 w-36" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-10 w-28 rounded-full" />
          <Skeleton className="h-10 w-32 rounded-full" />
        </div>
      </div>
      <Skeleton className="h-11 w-full rounded-control md:max-w-sm" />
      <div className="overflow-hidden rounded-card glass-panel">
        {Array.from({ length: 7 }, (_, index) => (
          <div
            key={index}
            className="flex items-center justify-between gap-4 border-t border-border px-4 py-3.5 first:border-t-0 md:px-6"
          >
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <Skeleton className="h-4 w-2/5 md:w-1/4" />
              <Skeleton className="h-3 w-1/4 md:hidden" />
            </div>
            <Skeleton className="h-4 w-20 md:w-28" />
          </div>
        ))}
      </div>
    </div>
  )
}
