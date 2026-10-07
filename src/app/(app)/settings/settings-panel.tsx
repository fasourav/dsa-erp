"use client"

import { ArrowLeft, Landmark, ListTree, Plus } from "lucide-react"
import { useMemo, useState, useTransition } from "react"

import { setBankAccountActive } from "@/app/(app)/accounts/bank/actions"
import { BankAccountFormDialog } from "@/app/(app)/accounts/bank/bank-account-form-dialog"
import { deleteCatalogItem } from "@/app/(app)/settings/actions"
import { CatalogFormDialog } from "@/app/(app)/settings/catalog-form-dialog"
import { HoldToDeleteButton } from "@/app/(app)/clients/hold-to-delete-button"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import type { BankAccountRow } from "@/lib/bank"
import {
  catalogSingularTitle,
  nextSortOrder,
  type CatalogItem,
  type CatalogList,
} from "@/lib/lookup-catalogs"

type ActiveView =
  | { kind: "home" }
  | { kind: "catalog"; key: CatalogList["key"] }
  | { kind: "bank" }

export function SettingsPanel({
  catalogs,
  bankAccounts,
  error,
}: {
  catalogs: CatalogList[]
  bankAccounts: BankAccountRow[]
  error: string | null
}) {
  const [view, setView] = useState<ActiveView>({ kind: "home" })
  const [formOpen, setFormOpen] = useState(false)
  const [formCatalog, setFormCatalog] = useState<CatalogList>(
    catalogs[0] ?? emptyCatalog(),
  )
  const [formItem, setFormItem] = useState<CatalogItem | null>(null)
  const [formSession, setFormSession] = useState(0)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<{
    catalog: CatalogList
    item: CatalogItem
  } | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [deleting, startDelete] = useTransition()
  const [bankFormOpen, setBankFormOpen] = useState(false)
  const [bankFormAccount, setBankFormAccount] = useState<BankAccountRow | null>(
    null,
  )
  const [bankFormSession, setBankFormSession] = useState(0)
  const [bankError, setBankError] = useState<string | null>(null)
  const [bankPendingId, setBankPendingId] = useState<string | null>(null)
  const [updatingBank, startBankUpdate] = useTransition()

  const catalogByKey = useMemo(() => {
    return new Map(catalogs.map((catalog) => [catalog.key, catalog]))
  }, [catalogs])

  const activeCatalog =
    view.kind === "catalog" ? (catalogByKey.get(view.key) ?? null) : null

  function openCreate(catalog: CatalogList) {
    setFormCatalog(catalog)
    setFormItem(null)
    setFormSession((session) => session + 1)
    setFormOpen(true)
  }

  function openEdit(catalog: CatalogList, item: CatalogItem) {
    setFormCatalog(catalog)
    setFormItem(item)
    setFormSession((session) => session + 1)
    setFormOpen(true)
  }

  function openDelete(catalog: CatalogList, item: CatalogItem) {
    setPendingDelete({ catalog, item })
    setDeleteError(null)
    setDeleteOpen(true)
  }

  function openBankForm(account: BankAccountRow | null) {
    setBankFormAccount(account)
    setBankFormSession((session) => session + 1)
    setBankFormOpen(true)
  }

  function toggleBankAccount(account: BankAccountRow) {
    setBankError(null)
    setBankPendingId(account.id)
    startBankUpdate(async () => {
      try {
        const result = await setBankAccountActive(account.id, !account.isActive)
        if (result.error) {
          setBankError(result.error)
          return
        }
      } catch {
        setBankError("Could not update this bank account.")
      } finally {
        setBankPendingId(null)
      }
    })
  }

  function confirmDelete() {
    if (!pendingDelete) {
      return
    }

    const { catalog, item } = pendingDelete

    startDelete(async () => {
      try {
        const result = await deleteCatalogItem(catalog.key, item.id)

        if (result.error) {
          setDeleteError(result.error)
          return
        }

        setDeleteOpen(false)
        setDeleteError(null)
      } catch {
        setDeleteError("Could not delete this item.")
      }
    })
  }

  return (
    <div className="mx-auto flex w-full min-w-0 max-w-5xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-medium tracking-tight">Settings</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Manage Lookup Lists For Departments, Projects, Expenses, Payments,
          Vendors, Leads, And Bank Accounts.
        </p>
      </div>

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {view.kind === "home" ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {catalogs.map((catalog) => (
            <button
              key={catalog.key}
              type="button"
              onClick={() => setView({ kind: "catalog", key: catalog.key })}
              className="group flex min-h-28 flex-col items-start justify-between rounded-xl border border-border bg-card p-5 text-left shadow-sm transition hover:border-foreground/20 hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <div className="flex w-full items-start justify-between gap-3">
                <span className="rounded-lg border border-border bg-background p-2 text-muted-foreground transition group-hover:text-foreground">
                  <ListTree className="size-5" aria-hidden="true" />
                </span>
                <Badge variant="outline" className="tabular-nums">
                  {itemCountLabel(catalog.items.length)}
                </Badge>
              </div>
              <div className="mt-4">
                <p className="text-base font-medium tracking-tight">
                  {catalog.label}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Add, Edit, Or Remove Entries
                </p>
              </div>
            </button>
          ))}

          <button
            type="button"
            onClick={() => setView({ kind: "bank" })}
            className="group flex min-h-28 flex-col items-start justify-between rounded-xl border border-border bg-card p-5 text-left shadow-sm transition hover:border-foreground/20 hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <div className="flex w-full items-start justify-between gap-3">
              <span className="rounded-lg border border-border bg-background p-2 text-muted-foreground transition group-hover:text-foreground">
                <Landmark className="size-5" aria-hidden="true" />
              </span>
              <Badge variant="outline" className="tabular-nums">
                {itemCountLabel(bankAccounts.length)}
              </Badge>
            </div>
            <div className="mt-4">
              <p className="text-base font-medium tracking-tight">
                Bank Accounts
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Add, Edit, Or Activate Accounts
              </p>
            </div>
          </button>
        </div>
      ) : null}

      {view.kind === "catalog" && activeCatalog ? (
        <CatalogDetail
          catalog={activeCatalog}
          onBack={() => setView({ kind: "home" })}
          onCreate={() => openCreate(activeCatalog)}
          onEdit={(item) => openEdit(activeCatalog, item)}
          onDelete={(item) => openDelete(activeCatalog, item)}
        />
      ) : null}

      {view.kind === "bank" ? (
        <Card>
          <CardHeader className="gap-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <Button
                  type="button"
                  variant="ghost"
                  className="-ml-2 mb-2 h-auto px-2 py-1"
                  onClick={() => setView({ kind: "home" })}
                >
                  <ArrowLeft aria-hidden="true" data-icon="inline-start" />
                  All Categories
                </Button>
                <CardTitle>Bank Accounts</CardTitle>
                <CardDescription>
                  {itemCountLabel(bankAccounts.length)}. Ordered By Sort Order,
                  Then Name.
                </CardDescription>
              </div>
              <Button
                type="button"
                className="h-auto min-h-8 w-full whitespace-normal sm:w-fit"
                onClick={() => openBankForm(null)}
              >
                <Plus aria-hidden="true" data-icon="inline-start" />
                Add Bank Account
              </Button>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {bankError ? (
              <p role="alert" className="text-sm text-destructive">
                {bankError}
              </p>
            ) : null}
            {bankAccounts.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No Bank Accounts Yet.
              </p>
            ) : (
              <ul className="flex flex-col divide-y divide-border">
                {bankAccounts.map((account) => (
                  <li
                    key={account.id}
                    className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium break-words">{account.name}</p>
                        {account.isActive ? null : (
                          <Badge variant="outline">Inactive</Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {[account.bankName, account.currency]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                      <p className="text-sm text-muted-foreground tabular-nums">
                        Sort Order {account.sortOrder}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        disabled={updatingBank}
                        onClick={() => openBankForm(account)}
                      >
                        Edit
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        disabled={updatingBank}
                        onClick={() => toggleBankAccount(account)}
                      >
                        {bankPendingId === account.id && updatingBank
                          ? "Saving…"
                          : account.isActive
                            ? "Deactivate"
                            : "Activate"}
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      ) : null}

      <BankAccountFormDialog
        key={bankFormSession}
        open={bankFormOpen}
        onOpenChange={setBankFormOpen}
        account={bankFormAccount}
        suggestedSortOrder={nextSortOrder(bankAccounts)}
      />

      <CatalogFormDialog
        key={formSession}
        open={formOpen}
        onOpenChange={setFormOpen}
        catalog={formCatalog}
        item={formItem}
      />

      <AlertDialog
        open={deleteOpen}
        onOpenChange={(open) => {
          if (open || deleting) {
            return
          }

          setDeleteOpen(false)
          setDeleteError(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="break-words">
              Delete {pendingDelete?.item.name ?? "item"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure to delete this item? If yes, Press and Hold
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleteError ? (
            <p role="alert" className="text-sm text-destructive">
              {deleteError}
            </p>
          ) : null}
          <AlertDialogFooter>
            <AlertDialogCancel type="button" disabled={deleting}>
              Cancel
            </AlertDialogCancel>
            <HoldToDeleteButton
              key={pendingDelete?.item.id}
              pending={deleting}
              onConfirm={confirmDelete}
            />
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function CatalogDetail({
  catalog,
  onBack,
  onCreate,
  onEdit,
  onDelete,
}: {
  catalog: CatalogList
  onBack: () => void
  onCreate: () => void
  onEdit: (item: CatalogItem) => void
  onDelete: (item: CatalogItem) => void
}) {
  return (
    <Card>
      <CardHeader className="gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <Button
              type="button"
              variant="ghost"
              className="-ml-2 mb-2 h-auto px-2 py-1"
              onClick={onBack}
            >
              <ArrowLeft aria-hidden="true" data-icon="inline-start" />
              All Categories
            </Button>
            <CardTitle>{catalog.label}</CardTitle>
            <CardDescription>
              {itemCountLabel(catalog.items.length)}. Ordered By Sort Order,
              Then Name.
            </CardDescription>
          </div>
          <Button
            type="button"
            className="h-auto min-h-8 w-full whitespace-normal sm:w-fit"
            onClick={onCreate}
          >
            <Plus aria-hidden="true" data-icon="inline-start" />
            Add {catalogSingularTitle(catalog.singular)}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {catalog.items.length === 0 ? (
          <p className="text-sm text-muted-foreground">No Items Yet.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {catalog.items.map((item) => (
              <li
                key={item.id}
                className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium break-words">{item.name}</p>
                    {catalog.hasActive && item.isActive === false ? (
                      <Badge variant="outline">Inactive</Badge>
                    ) : null}
                  </div>
                  <p className="text-sm text-muted-foreground tabular-nums">
                    Sort Order {item.sortOrder}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => onEdit(item)}
                  >
                    Edit
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={() => onDelete(item)}
                  >
                    Delete
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}

function itemCountLabel(count: number) {
  return count === 1 ? "1 Item" : `${count} Items`
}

function emptyCatalog(): CatalogList {
  return {
    key: "departments",
    label: "Departments",
    singular: "department",
    hasActive: true,
    hasCode: false,
    hasIsOpen: false,
    items: [],
  }
}