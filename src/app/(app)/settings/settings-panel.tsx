"use client"

import {
  ArrowLeft,
  Box,
  Contact,
  FileText,
  FolderKanban,
  Inbox,
  Landmark,
  ListTree,
  Plus,
  Receipt,
  Settings,
  Shield,
  Truck,
  UserPlus,
  Wallet,
  type LucideIcon,
} from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useMemo, useState, useTransition, type ReactNode } from "react"

import {
  deleteBankAccount,
  setBankAccountActive,
  updateFiscalYearStartMonth,
  updateLaunchDate,
  updatePrintMargins,
} from "@/app/(app)/accounts/bank/actions"
import { BankAccountFormDialog } from "@/app/(app)/accounts/bank/bank-account-form-dialog"
import { deleteCatalogItem } from "@/app/(app)/settings/actions"
import { CatalogFormDialog } from "@/app/(app)/settings/catalog-form-dialog"
import { DocumentTemplatePanel } from "@/app/(app)/settings/document-template-panel"
import { DeleteConfirmDialog } from "@/components/delete-confirm-dialog"
import { Money } from "@/components/money"
import { PageHeader, SectionHeader } from "@/components/page-header"
import { StatusBadge } from "@/components/status-badge"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Empty, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import type { BankAccountRow } from "@/lib/bank"
import type { PrintMargins } from "@/lib/documents/drafts"
import { formatDayMonYear } from "@/lib/format"
import { fiscalMonthOptions } from "@/lib/fiscal-year"
import {
  catalogSingularTitle,
  isCatalogKey,
  nextSortOrder,
  type CatalogItem,
  type CatalogKey,
  type CatalogList,
} from "@/lib/lookup-catalogs"
import type { DocumentTemplate } from "@/lib/document-templates"
import { savedToast } from "@/lib/saved"
import { cn } from "@/lib/utils"

type LastBackupStatus = {
  ranAtLabel: string
  sizeLabel: string
  status: string
} | null

type SettingsSection = "home" | "company" | "bank" | "documents" | CatalogKey

export function SettingsPanel({
  section = "home",
  catalogs,
  documentTemplates,
  bankAccounts,
  fiscalYearStartMonth,
  launchDate: initialLaunchDate,
  printMargins,
  lastBackup,
  error,
}: {
  section?: SettingsSection
  catalogs: CatalogList[]
  documentTemplates: DocumentTemplate[]
  bankAccounts: BankAccountRow[]
  fiscalYearStartMonth: number
  launchDate: string
  printMargins: PrintMargins
  lastBackup: LastBackupStatus
  error: string | null
}) {
  const router = useRouter()
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
  const [bankDeleteOpen, setBankDeleteOpen] = useState(false)
  const [pendingBankDelete, setPendingBankDelete] =
    useState<BankAccountRow | null>(null)
  const [bankDeleteError, setBankDeleteError] = useState<string | null>(null)
  const [deletingBank, startBankDelete] = useTransition()
  const [fiscalMonth, setFiscalMonth] = useState(String(fiscalYearStartMonth))
  const [fiscalError, setFiscalError] = useState<string | null>(null)
  const [savingFiscal, startFiscalSave] = useTransition()
  const [launchDate, setLaunchDate] = useState(initialLaunchDate)
  const [launchError, setLaunchError] = useState<string | null>(null)
  const [savingLaunch, startLaunchSave] = useTransition()
  const [marginTop, setMarginTop] = useState(String(printMargins.topMm))
  const [marginBottom, setMarginBottom] = useState(String(printMargins.bottomMm))
  const [marginError, setMarginError] = useState<string | null>(null)
  const [savingMargins, startMarginSave] = useTransition()

  const catalogByKey = useMemo(() => {
    return new Map(catalogs.map((catalog) => [catalog.key, catalog]))
  }, [catalogs])

  const activeCatalog = isCatalogKey(section) ? (catalogByKey.get(section) ?? null) : null

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

  function openBankDelete(account: BankAccountRow) {
    setPendingBankDelete(account)
    setBankDeleteError(null)
    setBankDeleteOpen(true)
  }

  function confirmBankDelete() {
    if (!pendingBankDelete) {
      return
    }

    const id = pendingBankDelete.id
    startBankDelete(async () => {
      try {
        const result = await deleteBankAccount(id)
        if (result.error) {
          setBankDeleteError(result.error)
          return
        }

        setBankDeleteOpen(false)
        setBankDeleteError(null)
      } catch {
        setBankDeleteError("Could not delete this bank account.")
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
    <div className="flex w-full min-w-0 flex-col gap-4">
      {section === "home" ? (
        <PageHeader
          title="Settings"
          className="mb-0 md:mb-2"
          description="Company, Lists, Bank Accounts, Documents, And Access."
        />
      ) : (
        <SettingsBackLink
          title={sectionTitle(section, activeCatalog)}
          description={sectionDescription(section)}
        />
      )}

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {section === "company" ? (
        <Card>
          <CardHeader>
            <CardTitle>Operational Tenure</CardTitle>
            <CardDescription>
              Revenue Per Day And Net Profit Per Day Count From This Launch Date.
            </CardDescription>
          </CardHeader>
          <div className="border-t border-border">
            <div className="flex items-center justify-between gap-3 px-4 py-3 md:px-6">
              <Label htmlFor="launch-date">Launch Date</Label>
              <Input
                id="launch-date"
                type="date"
                className="w-40 md:w-48"
                value={launchDate}
                disabled={savingLaunch}
                onChange={(event) => setLaunchDate(event.target.value)}
              />
            </div>
            <div className="flex items-center justify-between gap-3 border-t border-border px-4 py-3 md:px-6">
              <span className="text-muted-foreground">Shown As</span>
              <span>{formatDayMonYear(launchDate)}</span>
            </div>
          </div>
          {launchError ? (
            <p role="alert" className="px-4 py-3 text-sm text-destructive md:px-6">
              {launchError}
            </p>
          ) : null}
          <CardFooter className="justify-end">
            <Button
              type="button"
              disabled={savingLaunch}
              onClick={() => {
                setLaunchError(null)
                startLaunchSave(async () => {
                  const result = await updateLaunchDate(launchDate)
                  if (result.error) {
                    setLaunchError(result.error)
                  }
                })
              }}
            >
              {savingLaunch ? "Saving…" : "Save Launch Date"}
            </Button>
          </CardFooter>
        </Card>
      ) : null}

      {section === "company" ? (
        <Card>
          <CardHeader>
            <CardTitle>Last Backup</CardTitle>
            <CardDescription>
              Daily Zip Built At 02:00 Dhaka. Email Sending Stays Off.
            </CardDescription>
          </CardHeader>
          <div className="border-t border-border">
            <div className="flex items-center justify-between gap-3 px-4 py-3 md:px-6">
              <span className="text-muted-foreground">Time</span>
              <span>{lastBackup?.ranAtLabel ?? "No Backup Yet"}</span>
            </div>
            <div className="flex items-center justify-between gap-3 border-t border-border px-4 py-3 md:px-6">
              <span className="text-muted-foreground">Size</span>
              <span>{lastBackup?.sizeLabel ?? "—"}</span>
            </div>
            <div className="flex items-center justify-between gap-3 border-t border-border px-4 py-3 md:px-6">
              <span className="text-muted-foreground">Status</span>
              {lastBackup ? <StatusBadge status={lastBackup.status} /> : <span>—</span>}
            </div>
          </div>
        </Card>
      ) : null}

      {section === "company" ? (
        <Card>
          <CardHeader>
            <CardTitle>Print Margins</CardTitle>
            <CardDescription>
              Blank Space Above And Below Document Content So It Fits The Pre-Printed Letterhead Pad.
              Print Output Has No Logo Or Footer.
            </CardDescription>
          </CardHeader>
          <div className="border-t border-border">
            <div className="flex items-center justify-between gap-3 px-4 py-3 md:px-6">
              <Label htmlFor="print-margin-top">Top Margin (mm)</Label>
              <Input
                id="print-margin-top"
                type="number"
                inputMode="numeric"
                min={0}
                max={80}
                step={1}
                className="w-40 text-right tabular-nums md:w-48"
                value={marginTop}
                disabled={savingMargins}
                onChange={(event) => setMarginTop(event.target.value)}
              />
            </div>
            <div className="flex items-center justify-between gap-3 border-t border-border px-4 py-3 md:px-6">
              <Label htmlFor="print-margin-bottom">Bottom Margin (mm)</Label>
              <Input
                id="print-margin-bottom"
                type="number"
                inputMode="numeric"
                min={0}
                max={80}
                step={1}
                className="w-40 text-right tabular-nums md:w-48"
                value={marginBottom}
                disabled={savingMargins}
                onChange={(event) => setMarginBottom(event.target.value)}
              />
            </div>
          </div>
          {marginError ? (
            <p role="alert" className="px-4 py-3 text-sm text-destructive md:px-6">
              {marginError}
            </p>
          ) : null}
          <CardFooter className="justify-end">
            <Button
              type="button"
              disabled={savingMargins}
              onClick={() => {
                setMarginError(null)
                startMarginSave(async () => {
                  const topVal = Math.round(Number(marginTop))
                  const bottomVal = Math.round(Number(marginBottom))
                  const result = await updatePrintMargins(topVal, bottomVal)
                  if (result.error) {
                    setMarginError(result.error)
                    return
                  }
                  setMarginTop(String(topVal))
                  setMarginBottom(String(bottomVal))
                  savedToast("Print margins saved")
                  router.refresh()
                })
              }}
            >
              {savingMargins ? "Saving…" : "Save Print Margins"}
            </Button>
          </CardFooter>
        </Card>
      ) : null}

      {section === "home" ? <SettingsHome catalogs={catalogs} documentCount={documentTemplates.length} bankCount={bankAccounts.length} /> : null}

      {section === "documents" ? (
        <DocumentTemplatePanel
          templates={documentTemplates}
          projectTypes={
            catalogs.find((catalog) => catalog.key === "project_types")?.items.map((item) => item.name) ??
            []
          }
        />
      ) : null}

      {activeCatalog ? (
        <CatalogDetail
          catalog={activeCatalog}
          onCreate={() => openCreate(activeCatalog)}
          onEdit={(item) => openEdit(activeCatalog, item)}
          onDelete={(item) => openDelete(activeCatalog, item)}
        />
      ) : null}

      {section === "bank" ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Fiscal Year</CardTitle>
              <CardDescription>
                Statements Label A July Start As FY 2025–26. Bangladesh Tax Year Stays 1 July–30 June.
              </CardDescription>
            </CardHeader>
            <div className="flex items-center justify-between gap-3 border-t border-border px-4 py-3 md:px-6">
              <Label htmlFor="fiscal-year-start">Starts In</Label>
              <Select
                items={fiscalMonthOptions}
                value={fiscalMonth}
                disabled={savingFiscal}
                onValueChange={(value) => setFiscalMonth(value ?? "7")}
              >
                <SelectTrigger id="fiscal-year-start" className="w-40 md:w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent align="start">
                  {fiscalMonthOptions.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {fiscalError ? (
              <p role="alert" className="px-4 py-3 text-sm text-destructive md:px-6">
                {fiscalError}
              </p>
            ) : null}
            <CardFooter className="justify-end">
              <Button
                type="button"
                disabled={savingFiscal}
                onClick={() => {
                  setFiscalError(null)
                  startFiscalSave(async () => {
                    const result = await updateFiscalYearStartMonth(Number(fiscalMonth))
                    if (result.error) setFiscalError(result.error)
                  })
                }}
              >
                {savingFiscal ? "Saving…" : "Save Fiscal Year"}
              </Button>
            </CardFooter>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Bank Accounts</CardTitle>
              <CardDescription>
                {bankAccounts.length === 0
                  ? "Add Your First Bank Account Before Recording Payments."
                  : `${itemCountLabel(bankAccounts.length)}. Ordered By Sort Order, Then Name.`}
              </CardDescription>
            </CardHeader>
            {bankError ? (
              <p role="alert" className="px-4 pb-3 text-sm text-destructive md:px-6">
                {bankError}
              </p>
            ) : null}
            {bankAccounts.length === 0 ? (
              <Empty>
                <EmptyMedia variant="icon">
                  <Landmark aria-hidden="true" />
                </EmptyMedia>
                <EmptyTitle>Add Your First Bank Account</EmptyTitle>
              </Empty>
            ) : (
              <ul className="border-t border-border">
                {bankAccounts.map((account) => (
                  <li
                    key={account.id}
                    className="flex flex-col gap-3 border-t border-border px-4 py-3 first:border-t-0 md:px-6 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium break-words">{account.name}</p>
                        {account.isActive ? (
                          <StatusBadge status="active" />
                        ) : (
                          <StatusBadge status="inactive" />
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {[account.accountHolderName, account.bankName, account.currency]
                          .filter(Boolean)
                          .join(" · ") || "Details Missing"}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {account.accountNumber
                          ? `Account Number ${account.accountNumber}`
                          : "Account Number Missing"}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Opening Balance <Money value={account.openingBalance} /> · Sort Order{" "}
                        {account.sortOrder}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        disabled={updatingBank || deletingBank}
                        onClick={() => openBankForm(account)}
                      >
                        Edit
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        disabled={updatingBank || deletingBank}
                        onClick={() => toggleBankAccount(account)}
                      >
                        {bankPendingId === account.id && updatingBank
                          ? "Saving…"
                          : account.isActive
                            ? "Deactivate"
                            : "Activate"}
                      </Button>
                      <Button
                        type="button"
                        variant="destructive"
                        disabled={updatingBank || deletingBank}
                        onClick={() => openBankDelete(account)}
                      >
                        Delete
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <CardFooter className="justify-end">
              <Button type="button" onClick={() => openBankForm(null)}>
                <Plus aria-hidden="true" data-icon="inline-start" />
                Add Bank Account
              </Button>
            </CardFooter>
          </Card>
        </>
      ) : null}

      <BankAccountFormDialog
        key={`bank-${bankFormSession}`}
        open={bankFormOpen}
        onOpenChange={setBankFormOpen}
        account={bankFormAccount}
        suggestedSortOrder={nextSortOrder(bankAccounts)}
      />

      <DeleteConfirmDialog
        open={bankDeleteOpen}
        onOpenChange={(open) => {
          if (open || deletingBank) {
            return
          }

          setBankDeleteOpen(false)
          setBankDeleteError(null)
        }}
        title={`Delete ${pendingBankDelete?.name ?? "Bank Account"}`}
        itemName={pendingBankDelete?.name}
        error={bankDeleteError}
        pending={deletingBank}
        confirmKey={pendingBankDelete?.id}
        onConfirm={confirmBankDelete}
      />

      <CatalogFormDialog
        key={`catalog-${formSession}`}
        open={formOpen}
        onOpenChange={setFormOpen}
        catalog={formCatalog}
        item={formItem}
      />

      <DeleteConfirmDialog
        open={deleteOpen}
        onOpenChange={(open) => {
          if (open || deleting) {
            return
          }

          setDeleteOpen(false)
          setDeleteError(null)
        }}
        title={
          pendingDelete
            ? `Delete ${catalogSingularTitle(pendingDelete.catalog.singular)}`
            : "Delete Item"
        }
        itemName={pendingDelete?.item.name}
        error={deleteError}
        pending={deleting}
        confirmKey={pendingDelete?.item.id}
        onConfirm={confirmDelete}
      />
    </div>
  )
}

function CatalogDetail({
  catalog,
  onCreate,
  onEdit,
  onDelete,
}: {
  catalog: CatalogList
  onCreate: () => void
  onEdit: (item: CatalogItem) => void
  onDelete: (item: CatalogItem) => void
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{catalog.label}</CardTitle>
        <CardDescription>
          {itemCountLabel(catalog.items.length)}. Ordered By Sort Order, Then Name.
        </CardDescription>
      </CardHeader>
      {catalog.items.length === 0 ? (
        <Empty>
          <EmptyMedia variant="icon">
            <Inbox aria-hidden="true" />
          </EmptyMedia>
          <EmptyTitle>No Items Yet.</EmptyTitle>
        </Empty>
      ) : (
        <ul className="border-t border-border">
          {catalog.items.map((item) => (
            <li
              key={item.id}
              className="flex flex-col gap-3 border-t border-border px-4 py-3 first:border-t-0 md:px-6 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium break-words">{item.name}</p>
                  {catalog.hasActive && item.isActive === false ? (
                    <StatusBadge status="inactive" />
                  ) : null}
                  {catalog.hasActive && item.isActive !== false ? (
                    <StatusBadge status="active" />
                  ) : null}
                </div>
                <p className="text-sm text-muted-foreground tabular-nums">
                  Sort Order {item.sortOrder}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" onClick={() => onEdit(item)}>
                  Edit
                </Button>
                <Button type="button" variant="destructive" onClick={() => onDelete(item)}>
                  Delete
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <CardFooter className="justify-end">
        <Button type="button" onClick={onCreate}>
          <Plus aria-hidden="true" data-icon="inline-start" />
          Add {catalogSingularTitle(catalog.singular)}
        </Button>
      </CardFooter>
    </Card>
  )
}

const catalogIcons: Partial<Record<CatalogKey, LucideIcon>> = {
  departments: Contact,
  project_types: FolderKanban,
  project_phases: ListTree,
  office_expense_categories: Wallet,
  project_expense_categories: Receipt,
  payment_methods: Landmark,
  vendor_work_categories: Truck,
  asset_categories: Box,
  lead_sources: UserPlus,
  lead_stages: ListTree,
  lead_statuses: Shield,
}

const catalogDescriptions: Partial<Record<CatalogKey, string>> = {
  departments: "Teams Used On Employees",
  project_types: "Types Shown On Projects",
  project_phases: "Phases A Project Can Be In",
  office_expense_categories: "Categories For Office Costs",
  project_expense_categories: "Categories For Project Costs",
  payment_methods: "How Money Is Received And Paid",
  vendor_work_categories: "Work Vendors Can Be Hired For",
  asset_categories: "Groups On The Assets List",
  lead_sources: "Where A Lead Came From",
  lead_stages: "Steps In The Lead Pipeline",
  lead_statuses: "Open, Won, Lost, And Other States",
}

function SettingsHome({
  catalogs,
  documentCount,
  bankCount,
}: {
  catalogs: CatalogList[]
  documentCount: number
  bankCount: number
}) {
  return (
    <div className="flex flex-col gap-6">
      <SettingsGroup
        title="Company"
        description="Launch Date, Bank Accounts, Documents, And Who Can Sign In."
        columns="lg:grid-cols-4"
      >
        <SettingLink
          href="/settings/company"
          icon={Settings}
          title="Company"
          description="Launch Date, Print Margins, And Backup"
        />
        <SettingLink
          href="/settings/bank"
          icon={Landmark}
          title="Bank Accounts"
          description="Accounts, Opening Balances, And Fiscal Year"
          count={bankCount}
        />
        <SettingLink
          href="/settings/documents"
          icon={FileText}
          title="Document Templates"
          description="Quotations And Work Orders"
          count={documentCount}
        />
        <SettingLink
          href="/settings/users"
          icon={Shield}
          title="Users & Permissions"
          description="People, Invites, And Role Templates"
        />
      </SettingsGroup>
      <SettingsGroup
        title="Lists"
        description="Names Used On Projects, Expenses, Vendors, Leads, And Assets."
      >
        {catalogs.map((catalog) => (
          <SettingLink
            key={catalog.key}
            href={`/settings/${catalog.key}`}
            icon={catalogIcons[catalog.key] ?? ListTree}
            title={catalog.label}
            description={catalogDescriptions[catalog.key] ?? "Add, Edit, Or Remove Entries"}
            count={catalog.items.length}
          />
        ))}
      </SettingsGroup>
    </div>
  )
}

function SettingsGroup({
  title,
  description,
  columns = "md:grid-cols-3",
  children,
}: {
  title: string
  description: string
  columns?: string
  children: ReactNode
}) {
  return (
    <section className="flex flex-col gap-2.5">
      <SectionHeader title={title} className="pt-0 md:mt-0" />
      <p className="px-1 text-sm text-muted-foreground md:-mt-1 md:px-0">{description}</p>
      <div className={cn("grid grid-cols-1 gap-2.5 sm:grid-cols-2 md:gap-3.5", columns)}>
        {children}
      </div>
    </section>
  )
}

function SettingLink({
  href,
  icon: Icon,
  title,
  description,
  count,
}: {
  href: string
  icon: LucideIcon
  title: string
  description: string
  count?: number
}) {
  return (
    <Link
      href={href}
      className="flex min-h-32 flex-col rounded-card glass-panel px-4 py-4 text-left focus-visible:ring-3 focus-visible:ring-ring/50 md:px-5 md:py-4.5"
    >
      <span className="flex items-start justify-between gap-3">
        <span className="flex size-9.5 shrink-0 items-center justify-center rounded-xl bg-fill text-muted-foreground">
          <Icon className="size-4.5" aria-hidden="true" />
        </span>
        {count != null ? (
          <Badge variant="outline" className="tabular-nums">
            {itemCountLabel(count)}
          </Badge>
        ) : null}
      </span>
      <span className="mt-auto pt-4.5 text-row font-strong">{title}</span>
      <span className="mt-0.5 text-caption text-muted-foreground">{description}</span>
    </Link>
  )
}

function SettingsBackLink({
  title,
  description,
}: {
  title: string
  description?: string
}) {
  return (
    <div className="flex flex-col gap-2">
      <Button
        type="button"
        variant="ghost"
        className="w-fit"
        nativeButton={false}
        render={<Link href="/settings" />}
      >
        <ArrowLeft aria-hidden="true" data-icon="inline-start" />
        Settings
      </Button>
      <PageHeader title={title} description={description} className="mb-0 md:mb-2" />
    </div>
  )
}

function sectionTitle(section: SettingsSection, catalog: CatalogList | null): string {
  if (catalog) return catalog.label
  if (section === "company") return "Company"
  if (section === "bank") return "Bank Accounts"
  if (section === "documents") return "Document Templates"
  return "Settings"
}

function sectionDescription(section: SettingsSection): string | undefined {
  if (section === "company") return "Launch Date, Print Margins, And The Latest Backup."
  if (section === "bank") return "Accounts, Opening Balances, And The Fiscal Year Start."
  if (section === "documents") return "Reusable Layouts For Quotations And Work Orders."
  return undefined
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