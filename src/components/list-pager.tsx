import { ChevronLeft, ChevronRight } from "lucide-react"
import Link from "next/link"

import { Button } from "@/components/ui/button"
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
} from "@/components/ui/pagination"
import { paginationItems } from "@/lib/list-paging"
import { buildPageHref } from "@/lib/page-query"

export function ListPager({
  basePath,
  page,
  pageCount,
  params,
  label = "List pagination",
}: {
  basePath: string
  page: number
  pageCount: number
  params?: Record<string, string | null | undefined>
  label?: string
}) {
  if (pageCount <= 1) return null

  const currentPage = Math.min(Math.max(1, page), pageCount)
  const items = paginationItems(currentPage, pageCount)

  return (
    <div className="flex items-center justify-between gap-3 px-1">
      <p className="text-label text-muted-foreground">
        Page {currentPage} of {pageCount}
      </p>
      <Pagination aria-label={label} className="mx-0 w-auto justify-end">
        <PaginationContent className="flex-wrap gap-1">
          <PaginationItem>
            {currentPage <= 1 ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled
                aria-label="Go to previous page"
              >
                <ChevronLeft aria-hidden="true" data-icon="inline-start" />
                <span className="hidden sm:inline">Previous</span>
              </Button>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                aria-label="Go to previous page"
                nativeButton={false}
                render={
                  <Link
                    href={buildPageHref(basePath, currentPage - 1, params)}
                    prefetch={false}
                  />
                }
              >
                <ChevronLeft aria-hidden="true" data-icon="inline-start" />
                <span className="hidden sm:inline">Previous</span>
              </Button>
            )}
          </PaginationItem>
          {items.map((item, index) =>
            item === "ellipsis" ? (
              <PaginationItem key={`ellipsis-${index}`}>
                <PaginationEllipsis />
              </PaginationItem>
            ) : (
              <PaginationItem key={item}>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Page ${item}`}
                  aria-current={item === currentPage ? "page" : undefined}
                  className="font-label text-muted-foreground aria-[current=page]:bg-solid aria-[current=page]:text-foreground aria-[current=page]:shadow-segment md:size-8"
                  nativeButton={false}
                  render={
                    <Link
                      href={buildPageHref(basePath, item, params)}
                      prefetch={false}
                    />
                  }
                >
                  {item}
                </Button>
              </PaginationItem>
            ),
          )}
          <PaginationItem>
            {currentPage >= pageCount ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled
                aria-label="Go to next page"
              >
                <span className="hidden sm:inline">Next</span>
                <ChevronRight aria-hidden="true" data-icon="inline-end" />
              </Button>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                aria-label="Go to next page"
                nativeButton={false}
                render={
                  <Link
                    href={buildPageHref(basePath, currentPage + 1, params)}
                    prefetch={false}
                  />
                }
              >
                <span className="hidden sm:inline">Next</span>
                <ChevronRight aria-hidden="true" data-icon="inline-end" />
              </Button>
            )}
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    </div>
  )
}
