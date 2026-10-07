"use client"

import { Plus } from "lucide-react"
import { useState, useTransition } from "react"

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

export function SettingsPanel({
  catalogs,
  bankAccounts,
  error,
}: {
  catalogs: CatalogList[]
  bankAccounts: BankAccountRow[]
  error: string | null
}) {
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
    <div className="mx-auto flex w-full min-w-0 max-w-3xl flex-col gap-6">
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

      <div className="flex flex-col gap-6">
        {catalogs.map((catalog) => (
          <Card key={catalog.key}>
            <CardHeader>
              <CardTitle>{catalog.label}</CardTitle>
              <CardDescription>
                {itemCountLabel(catalog.items.length)}. Ordered By Sort Order,
                Then Name.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <Button
                type="button"
                className="h-auto min-h-8 w-full whitespace-normal sm:w-fit"
                onClick={() => openCreate(catalog)}
              >
                <Plus aria-hidden="true" data-icon="inline-start" />
                Add {catalogSingularTitle(catalog.singular)}
              </Button>

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
                          {catalog.hasCode && item.code ? (
                            <Badge variant="outline">{item.code}</Badge>
                          ) : null}
                          {catalog.hasIsOpen ? (
                            <Badge
                              variant="outline"
                              className={
                                item.isOpen
                                  ? "border-emerald-500/40 text-emerald-700 dark:text-emerald-400"
                                  : undefined
                              }
                            >
                              {item.isOpen ? "Open" : "Closed"}
                            </Badge>
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
                          onClick={() => openEdit(catalog, item)}
                        >
                          Edit
                        </Button>
                        <Button
                          type="button"
                          variant="destructive"
                          onClick={() => openDelete(catalog, item)}
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
        ))}
        <Card>
          <CardHeader>
            <CardTitle>Bank Accounts</CardTitle>
            <CardDescription>
              {itemCountLabel(bankAccounts.length)}. Ordered By Sort Order, Then
              Name.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <Button
              type="button"
              className="h-auto min-h-8 w-full whitespace-normal sm:w-fit"
              onClick={() => openBankForm(null)}
            >
              <Plus aria-hidden="true" data-icon="inline-start" />
              Add Bank Account
            </Button>
            {bankError ? (
              <p role="alert" className="text-sm text-destructive">
                {bankError}
              </p>
            ) : null}
            {bankAccounts.length === 0 ? (
              <p className="text-sm text-muted-foreground">No Bank Accounts Yet.</p>
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
      </div>

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
