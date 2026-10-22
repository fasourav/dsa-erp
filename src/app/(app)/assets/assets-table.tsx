"use client"

import { ListExport } from "@/components/list-export"
import { filterRows, ListSearch, rowText } from "@/components/list-search"
import { useCan } from "@/components/access-provider"

import { MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react"
import { useMemo, useState, useTransition } from "react"

import { deleteAsset } from "@/app/(app)/assets/actions"
import { AssetFormDialog } from "@/app/(app)/assets/asset-form-dialog"
import { DataList } from "@/components/data-list"
import { DeleteConfirmDialog } from "@/components/delete-confirm-dialog"
import { Money } from "@/components/money"
import { PageHeader } from "@/components/page-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  paginateRows,
  rangeLabel,
  toggleSort,
  type ListColumn,
  type SortState,
} from "@/lib/list-paging"
import { formatDayMonYear, formatIsoDate } from "@/lib/format"
import { sumAssetCurrentValue } from "@/lib/asset-value"
import type { AssetCategoryOption, AssetRow } from "@/lib/assets"
import { cn } from "@/lib/utils"

type ColId = "name" | "category" | "purchaseDate" | "quantity" | "totalCost" | "currentValue"

const columns: readonly ListColumn<ColId>[] = [
  { id: "name", label: "Name", align: "left", locked: true },
  { id: "category", label: "Category", align: "left", locked: false },
  { id: "purchaseDate", label: "Purchase Date", align: "left", locked: false },
  { id: "quantity", label: "Qty", align: "right", locked: false },
  { id: "totalCost", label: "Total Cost", align: "right", locked: false },
  { id: "currentValue", label: "Current Value", align: "right", locked: false },
]

function sortAssets(rows: AssetRow[], sort: SortState<ColId>): AssetRow[] {
  const sorted = [...rows]
  sorted.sort((a, b) => {
    let cmp = 0
    switch (sort.key) {
      case "name":
        cmp = a.name.localeCompare(b.name, "en", { sensitivity: "base" })
        break
      case "category":
        cmp = a.category.localeCompare(b.category, "en", { sensitivity: "base" })
        break
      case "purchaseDate":
        cmp = a.purchaseDate.localeCompare(b.purchaseDate)
        break
      case "quantity":
        cmp = a.quantity - b.quantity
        break
      case "totalCost":
        cmp = a.totalCost - b.totalCost
        break
      case "currentValue":
        cmp = a.currentValue - b.currentValue
        break
    }
    return sort.direction === "asc" ? cmp : -cmp
  })
  return sorted
}

export function AssetsTable({
  assets,
  categories,
  error,
  initialQuery = "",
}: {
  assets: AssetRow[]
  categories: AssetCategoryOption[]
  error: string | null
  initialQuery?: string
}) {
  const canAdd = useCan("assets", "add")
  const canEdit = useCan("assets", "edit")
  const canDelete = useCan("assets", "delete")

  const [sort, setSort] = useState<SortState<ColId>>({
    key: "name",
    direction: "asc",
  })
  const [page, setPage] = useState(1)
  const [query, setQuery] = useState(initialQuery)
  const [listFilter, setListFilter] = useState("all")
  const [formOpen, setFormOpen] = useState(false)
  const [formAsset, setFormAsset] = useState<AssetRow | null>(null)
  const [formSession, setFormSession] = useState(0)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<AssetRow | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [deleting, startDelete] = useTransition()

  const sorted = useMemo(() => sortAssets(assets, sort), [assets, sort])
  const totalAssetValue = useMemo(
    () => sumAssetCurrentValue(assets.map((asset) => asset.currentValue)),
    [assets],
  )
  const filterOptions = [
    { value: "all", label: "All Categories" },
    ...categories.map((category) => ({ value: category.id, label: category.name })),
  ]
  const filtered = useMemo(
    () => filterRows(sorted, query, rowText, listFilter, (asset) => asset.categoryId || "none"),
    [listFilter, query, sorted],
  )
  const pageResult = useMemo(() => paginateRows(filtered, page), [filtered, page])

  function openForm(asset: AssetRow | null) {
    setFormAsset(asset)
    setFormSession((session) => session + 1)
    setFormOpen(true)
  }

  function askDelete(asset: AssetRow) {
    setDeleteError(null)
    setPendingDelete(asset)
    setDeleteOpen(true)
  }

  function confirmDelete() {
    if (!pendingDelete) return
    const id = pendingDelete.id
    startDelete(async () => {
      try {
        const result = await deleteAsset(id)
        if (result.error) {
          setDeleteError(result.error)
          return
        }
        setDeleteOpen(false)
        setDeleteError(null)
      } catch {
        setDeleteError("Could not delete this asset.")
      }
    })
  }

  return (
    <div className="flex flex-col gap-3.5">
      <PageHeader
        title="Assets"
        className="mb-0 md:mb-2"
        actions={
          <>
            <ListExport
              grid={{
                filename: "assets",
                title: "Assets",
                columns: [
                  { header: "Name", kind: "text" },
                  { header: "Category", kind: "text" },
                  { header: "Purchase Date", kind: "text" },
                  { header: "Qty", kind: "integer" },
                  { header: "Total Cost", kind: "money" },
                  { header: "Current Value", kind: "money" },
                ],
                rows: filtered.map((asset) => [
                  asset.name,
                  asset.category,
                  asset.purchaseDate ? formatDayMonYear(asset.purchaseDate) : "—",
                  asset.quantity,
                  asset.totalCost,
                  asset.currentValue,
                ]),
              }}
            />
            {canAdd ? (
              <Button type="button" onClick={() => openForm(null)}>
                <Plus aria-hidden="true" data-icon="inline-start" />
                Add New Asset
              </Button>
            ) : null}
          </>
        }
      />

      {error ? null : (
        <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4 md:gap-4">
          <Card size="sm" className="col-span-2 md:col-span-1">
            <CardContent className="flex flex-col gap-1">
              <p className="text-label font-semibold text-muted-foreground">Total Asset Value</p>
              <p className="text-metric">
                <Money value={totalAssetValue} />
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      <ListSearch
        query={query}
        onQueryChange={(value) => {
          setQuery(value)
          setPage(1)
        }}
        placeholder="Search assets"
        filterLabel="Category"
        filter={listFilter}
        onFilterChange={(value) => {
          setListFilter(value)
          setPage(1)
        }}
        options={filterOptions}
      />
      <DataList
        columns={columns}
        rows={error ? [] : pageResult.rows}
        rowKey={(asset) => asset.id}
        sort={sort}
        onSort={(key) => {
          setSort(toggleSort(sort, key))
          setPage(1)
        }}
        visibility={{}}
        error={error}
        emptyMessage="No Assets Yet."
        rangeText={rangeLabel(
          pageResult.rangeStart,
          pageResult.rangeEnd,
          error ? 0 : pageResult.total,
          "asset",
          "assets",
        )}
        currentPage={pageResult.currentPage}
        pageCount={pageResult.pageCount}
        onPageChange={setPage}
        pagingLabel="Assets pagination"
        mobileItem={(asset) => ({
          title: asset.name || "—",
          subtitle: [asset.category, `Qty ${asset.quantity}`].filter(Boolean).join(" · "),
          meta: <Money value={asset.currentValue} />,
        })}
        renderCell={(asset, columnId) => <Cell asset={asset} columnId={columnId} />}
        renderActions={(asset) => (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Actions for ${asset.name}`}
                />
              }
            >
              <MoreHorizontal aria-hidden="true" className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              {canEdit ? (
                <DropdownMenuItem onClick={() => openForm(asset)}>
                  <Pencil aria-hidden="true" />
                  Edit
                </DropdownMenuItem>
              ) : null}
              <DropdownMenuSeparator />
              {canDelete ? (
                <DropdownMenuItem variant="destructive" onClick={() => askDelete(asset)}>
                  <Trash2 aria-hidden="true" />
                  Delete
                </DropdownMenuItem>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      />

      <AssetFormDialog
        key={formSession}
        open={formOpen}
        onOpenChange={setFormOpen}
        asset={formAsset}
        categories={categories}
      />

      <DeleteConfirmDialog
        open={deleteOpen}
        onOpenChange={(nextOpen) => {
          if (nextOpen || deleting) return
          setDeleteOpen(false)
          setDeleteError(null)
        }}
        title="Delete Asset"
        itemName={pendingDelete?.name}
        error={deleteError}
        pending={deleting}
        confirmKey={pendingDelete?.id}
        onConfirm={confirmDelete}
      />
    </div>
  )
}

function Cell({ asset, columnId }: { asset: AssetRow; columnId: ColId }) {
  switch (columnId) {
    case "name":
      return (
        <span className={cn("text-ui font-semibold", !asset.name && "text-muted-foreground")}>
          {asset.name || "—"}
        </span>
      )
    case "category":
      return asset.category ? (
        <Badge variant="outline">{asset.category}</Badge>
      ) : (
        <span className="text-muted-foreground">—</span>
      )
    case "purchaseDate":
      return asset.purchaseDate ? (
        <span>{formatIsoDate(asset.purchaseDate)}</span>
      ) : (
        <span className="text-muted-foreground">—</span>
      )
    case "quantity":
      return <span className="tabular-nums">{asset.quantity}</span>
    case "totalCost":
      return <Money value={asset.totalCost} />
    case "currentValue":
      return <Money value={asset.currentValue} />
  }
}
