# Atrium style guide

Atrium is the DSA ERP design system the client approved (Atrium Desktop and Atrium Mobile mockups). It looks like a calm, Apple-like glass UI: a warm off-white or near-black canvas with a soft aurora wash, translucent cards, olive-green accents, large titles, and native phone patterns (floating tab bar, bottom sheets, grouped lists).

This guide is the contract for every page. Phase 1 converted the tokens, the shell, the shared components, and three reference pages. Phase 2 applies the same patterns to every other page. If something here conflicts with an older comment or rule, this guide wins.

- [Sources of truth](#sources-of-truth)
- [Tokens](#tokens)
- [Shell and layout](#shell-and-layout)
- [Components](#components)
- [Page recipes](#page-recipes)
- [Page mapping](#page-mapping)
- [Do and don't](#do-and-dont)
- [Phase 2 checklist](#phase-2-checklist)
- [Verifying a page](#verifying-a-page)

## Sources of truth

| What | Where |
| --- | --- |
| Desktop mockups (HTML, dark and light) | `docs/atrium/mockups/desktop/dNN-<page>-<theme>.html` |
| Mobile mockups (HTML, dark and light) | `docs/atrium/mockups/mobile/mNN-<page>-<theme>.html` |
| Tokens (the only place color values live) | `src/app/globals.css` |
| Class merging and the token scale registry | `src/lib/utils.ts` |
| Primitives | `src/components/ui/*` |
| Shared app components | `src/components/*` |

The mockup HTML files are self-contained. Open one in a browser, or render it with Playwright at 1440x900 (desktop) or 390x844 (mobile), to compare. Each mobile file draws an iPhone frame with a status bar, so ignore the top 44px and the home indicator when you compare.

Reference pages to copy from:

| Pattern | Copy from |
| --- | --- |
| Signed-out screens | `src/app/login/*` (d01, m01) |
| Dashboard, KPI cards, charts, metric tiles, section panels | `src/app/(app)/dashboard/dashboard-view.tsx`, `dashboard-charts.tsx` (d02, m02) |
| List page (table on desktop, grouped list on phones) | `src/app/(app)/clients/clients-table.tsx` (d04, m05) |
| Add or edit form (bottom sheet on phones, dialog on desktop) | `src/app/(app)/clients/client-form-dialog.tsx` (d26, m27) |
| Delete confirmation with slide-to-delete | `src/components/delete-confirm-dialog.tsx`, `slide-to-delete.tsx` (d27, m28, m29) |
| Module launcher | `src/app/(app)/modules/modules-grid.tsx` (m03) |

## Tokens

All tokens are CSS variables in `src/app/globals.css`, exposed as Tailwind utilities by `@theme inline`. Light values are under `:root` and dark values are under `.dark`. Desktop-only values are overridden inside `@media (width >= 48rem)`, so the unprefixed utility is always correct for the current screen. Components never contain a color value, never use `dark:`, and never use palette utilities such as `bg-zinc-900`.

### Color

| Role | Utilities | Light | Dark |
| --- | --- | --- | --- |
| Canvas | `bg-background`, `text-foreground` | `#f2f3ee` / `#1d1d1f` | `#0b0c0a` / `#f5f5f7` |
| Secondary text | `text-muted-foreground`, `text-subtle-foreground` | `#6e6e73` | `#a1a1a6` |
| Brand (olive) | `bg-primary`, `text-primary-foreground`, `text-primary-text`, `bg-primary-tint` | `#45632d` | `#8fad55` |
| Status | `text-success`, `text-warning`, `text-destructive`, `text-info`, plus `bg-*-tint` | `#1f9d45`, `#b25e00`, `#d7262b`, `#0068d1` | `#4ade73`, `#ffb054`, `#ff6b6e`, `#5cb2ff` |
| Extra tints | `bg-neutral-tint text-neutral`, `bg-violet-tint text-violet` | | |
| Lines | `border-border` (hairline), `border-border-subtle`, `border-rim` (glass edge) | | |
| Surfaces | `bg-card`, `bg-surface`, `bg-surface-strong`, `bg-solid`, `bg-popover`, `bg-dialog`, `bg-sheet` | | |
| Fills | `bg-fill` (quiet wells, segmented track), `bg-fill-strong` (skeleton, ring track), `bg-field` (inputs), `bg-control` | | |
| Navigation | `bg-tab-active`, `text-tab-active-foreground`, `bg-segment-active`, `bg-sidebar*` | | |
| Overlay | `bg-scrim` | | |
| On colored tiles | `text-on-color` | | |
| Charts | `chart-1` blue, `chart-2` green, `chart-3` orange, `chart-4` red, `chart-5` violet, `chart-6` cyan, `chart-7` magenta, `chart-8` yellow, `chart-9` teal, `chart-10` pink, `chart-gold` | | |

Opacity on a token is fine (`bg-primary/90`, `ring-ring/50`). In SVG or Recharts props, use `var(--chart-1)` and similar, never a hex value.

Payment states always use `<StatusBadge>`: paid is success, partial or pending is warning, unpaid is destructive, active is info, and anything else is neutral.

### Type

The font is the app's existing sans. Numbers use `tabular-nums`. Money always goes through `<Money>`.

| Utility | Phone | Desktop | Use |
| --- | --- | --- | --- |
| `text-large-title` / `md:text-page-title` | 34px / 700 | 38px / 700 | Page title (`PageHeader` sets both) |
| `text-dialog-title` | 22px / 700 | | Dialog and sheet titles |
| `text-section` | 20px / 700 | | Section titles between card groups |
| `text-panel-title` | 17px / 650 | | Card titles |
| `text-kpi` | 28px | 27px | KPI values |
| `text-stat` | 22px / 700 | | Secondary big numbers |
| `text-metric` | 19px | 20px | Metric tile values |
| `text-row` | 15.5px | | Grouped list row titles |
| `text-callout` | 15px | | Body on phones, list amounts |
| `text-ui` | 13.5px | | Desktop body, table cells, controls |
| `text-label` | 13px | | Field labels, captions under titles |
| `text-caption` | 12.5px | | Table headers, chart axis labels |
| `text-micro` | 11.5px | | Badges on phones, footnotes |
| `text-tab` | 10.5px | | Tab bar labels only |

Weights: `font-book` (450), `font-label` (550), `font-strong` (650), plus Tailwind's `font-semibold` and `font-bold`.

Inputs are 16px on phones (`text-base`) so iOS Safari never zooms, and `md:text-ui` from md up. The primitives already do this, so don't override it.

### Radius

| Utility | Value | Use |
| --- | --- | --- |
| `rounded-control` | 13px | Inputs, select triggers, small wells, skeleton bars |
| `rounded-tile` | 16px | Metric tiles, icon boxes, empty-state icon |
| `rounded-card` | 26px on phones, 22px on desktop | Cards, panels, list groups, tables |
| `rounded-group` | 24px | Inset form groups |
| `rounded-sidebar` | 26px | Desktop sidebar |
| `rounded-dialog` | 30px | Desktop dialogs |
| `rounded-alert` | 34px | Alert dialogs |
| `rounded-hero` | 40px on phones, 34px on desktop | Login card |
| `rounded-sheet` | 44px | Phone bottom sheets |
| `rounded-full` | | Buttons, badges, capsules, tab bar, segmented control |

### Elevation and glass

Use these utilities instead of hand-built shadows and blurs:

| Utility | Use |
| --- | --- |
| `glass-panel` | Cards, panels, list groups, tables. It includes the fill, rim, blur, and `shadow-glass`. |
| `glass-chrome` | Floating chrome: the phone tab bar and the desktop top-bar controls |
| `glass-control` | Capsule controls on the canvas (year picker, toolbar capsules) |
| `glass-float` | Popovers, menus, desktop dialogs |
| `glass-sheet` | Phone bottom sheets |
| `bg-aurora` | The page wash. `AppShell` and the login page already set it, so pages never add it. |
| `tile-sheen` | Gloss on colored icon boxes (`bg-chart-N tile-sheen text-on-color`) |
| `bg-warning-wash` | Warm wash for a metric that needs attention (Accounts Payable) |
| `shadow-primary`, `shadow-destructive` | Built into the solid buttons |
| `shadow-segment` | The active pill of a segmented control |
| `shadow-nav-active` | The active sidebar item |

Blur radii are `backdrop-blur-glass` (30px), `backdrop-blur-chrome` (16px), and `backdrop-blur-float` (40px).

### Spacing

- Phone page gutter is 16px (the shell sets it). Cards are padded `p-4`. Grids use `gap-2.5`.
- Desktop content is padded by the shell. Cards use `md:px-5.5` or `md:px-6` with `md:py-5` or `md:py-5.5`. Grids use `md:gap-4`.
- Between page sections: `gap-4 md:gap-5`, or `SectionHeader`, which carries its own spacing.

### Motion

- Sheets slide up with `animate-sheet-in` and `animate-sheet-out` (the iOS curve `cubic-bezier(0.32, 0.72, 0, 1)`). Desktop dialogs fade and zoom. All of this is built into `DialogContent`.
- Charts animate only when the user has not asked for reduced motion (`useReducedMotion` in `dashboard-charts.tsx`).
- The shimmer on "Slide to Delete" and skeleton pulses are `motion-safe:` only.

### The `cn` registry

`cn` in `src/lib/utils.ts` is configured with the Atrium scales. If you add a new named size, weight, radius, shadow, or blur token to `@theme`, add its name to `createCn` too. Otherwise class merging treats `text-ui` as a color and drops it next to `text-muted-foreground`. Every component, including `src/components/ui/*`, imports `cn` from `@/lib/utils`.

## Shell and layout

The shell lives in `AppShell` (`src/components/app-shell.tsx`). Pages render only their content.

- **Desktop (md and up):** a floating glass sidebar (`AppSidebar`) with a lucide icon for every item (from `src/lib/nav-icons.ts`; never dots or initials), and a top bar with the Documents menu, global search (Ctrl+K), the profile menu, and the theme toggle.
- **Phones:** a top row with back or search and a "more" menu (`MobileMoreMenu`), a floating glass tab bar (`MobileTabBar`: Dashboard, Projects, Leads, All Modules), and safe-area padding. `pb-tabbar` keeps content clear of the tab bar. Every other module is reached from `/modules`.
- A new destination is a new entry in `navItems` (`src/lib/access.ts`) plus an icon in `navIcons`. Do not add another sidebar, header, or tab bar.
- Layouts are mobile-first. Unprefixed classes are the phone layout, and `md:` adds desktop behavior, matching the shell's breakpoint. Never use `max-md:` or other max-width variants.

## Components

### PageHeader and SectionHeader (`src/components/page-header.tsx`)

```tsx
<PageHeader
  title="Clients"
  description="Last Updated Oct 13, 2026"   // optional
  actions={<><ListExport … /><Button>…</Button></>}
/>
<SectionHeader title="Performance Metrics" aside="38 Projects Since 2021" />
```

On phones the title is a 34px large title and the actions wrap below it as capsules. On desktop the title is 38px and the actions are right-aligned on its baseline. Every page starts with exactly one `PageHeader`.

### Cards and panels

Use `Card` (`src/components/ui/card.tsx`). It is already a `glass-panel` with `rounded-card`. For a titled chart or summary block, copy the `Panel` helper in `dashboard-view.tsx`: a `Card` with `gap-0 p-4 md:px-6 md:py-5.5`, a `text-panel-title` heading, an optional `text-label text-muted-foreground` caption, and an aside slot for a legend or badge.

### KPI cards and metric tiles

- **KPI card:** label (`text-label text-muted-foreground`), a delta badge (`Badge` success or destructive with a trend icon, or secondary when there's no change), the value (`<Money size="kpi">`), and a sparkline. See `KpiCard` in the dashboard.
- **Metric tile:** a colored icon box (`size-7.5 md:size-9.5 md:rounded-xl bg-chart-N tile-sheen text-on-color`), a label, the value (`text-metric`), and a caption. Each tile keeps one chart color for both the icon and its progress bar.
- **Compact metric strip:** one `glass-panel` divided by hairlines on desktop, and separate small cards on phones (see `CompactMetric`).

### Money (`src/components/money.tsx`)

`<Money value={n} />` renders the ৳ glyph from the bundled Taka subset, uses tabular figures, and dims the paisa. Use `size="kpi"` inside KPI values. Color comes from the parent (`text-success`, `text-destructive`). Never format money with string concatenation in JSX.

### Badges

`Badge` variants: `default` (brand tint), `secondary` (fill), `outline` (hairline), `success`, `pending`, `warning`, `destructive`, `info`, `neutral`, `violet`, `ghost`, `link`.

- Status values always use `<StatusBadge status="…" />`, which adds the 6px current-color dot.
- Types and roles (Individual, Company, Owner) use `outline` or `secondary`, with no dot.
- Percentages and trends use `success` or `destructive` with a lucide `TrendingUp` or `TrendingDown` icon.

### Buttons

| Variant | Use |
| --- | --- |
| `default` | The one primary action per view (Add New Client, Save, Sign In) |
| `outline` | Secondary toolbar actions (Export, Customize Columns) |
| `secondary` | Quiet actions (Cancel, dialog close) |
| `ghost` | Row actions, icon buttons inside cards |
| `destructive` | Destructive action on a tinted background |
| `destructive-solid` | The final Delete in a confirmation |
| `link` | Inline text links |

Sizes are `default`, `lg`, `icon`, and `icon-lg`. Phones get 44px targets automatically (`h-11` and `size-11`), and desktop shrinks to 36px. Do not use `xs`, `sm`, `icon-xs`, or `icon-sm` in pages; they exist only so shadcn internals keep working. Icons go inside with `data-icon="inline-start"` or `data-icon="inline-end"`.

### Data lists (`src/components/data-list.tsx`)

`DataList` is the only table. Give it `mobileItem` so phones get the Atrium grouped list (title, value, subtitle, meta) and the table renders from md up:

```tsx
mobileItem={(client) => ({
  title: client.displayName,
  subtitle: `${kindLabel} · ${client.projectCount} Projects`,
  meta: <Money value={client.totalProjectValue} />,   // or <StatusBadge … />
})}
```

- `value` is the right side of the first line. `meta` is the right side of the second line: a `<StatusBadge>`, or an amount that reads with the subtitle.
- Without `mobileItem`, phones scroll the table sideways inside the card. This is the fallback for unconverted pages, not a target.
- Keep `renderActions` (the row "⋯" menu) on phones too. The mockups don't draw it, but edit and delete must stay reachable.
- The toolbar is `ListSearch` (search plus an optional filter select) and `CustomizeColumns`. Empty and error states are built in (`Empty` with an `Inbox` icon).

### Forms

- Use the `Field` primitives (`src/components/ui/field.tsx`): `FieldGroup`, `Field`, `FieldLabel`, `FieldTitle`, `FieldDescription`, `FieldError`.
- In add and edit dialogs use `<FieldGroup layout="inset">`. On phones that renders one rounded grouped list (label above a borderless 16px control, hairline separators). From md up it is a two-column grid. `<Field span="half">` shares a desktop row.
- Mark invalid fields with `data-invalid` on `Field` and `aria-invalid` on the control, and show the message with `FieldError`.
- Every input sets the right keyboard and autofill hints:

| Data | Attributes |
| --- | --- |
| Name | `autoComplete="name"` or `"off"`, `autoCapitalize="words"`, `enterKeyHint="next"` |
| Email | `type="email" inputMode="email" autoComplete="email" autoCapitalize="none" spellCheck={false}` |
| Phone | `type="tel" inputMode="tel" autoComplete="tel"` |
| Money or decimal | `inputMode="decimal"` |
| Whole number | `inputMode="numeric"` |
| Search | `type="search" enterKeyHint="search"` |
| Date | `type="date"` (the native picker is the phone-native control) |

- Select uses `Select` and `SelectTrigger`. `variant="capsule"` is the glass capsule used on the canvas (the dashboard year picker). The default `field` variant is used inside forms and toolbars. Searchable pickers use `Combobox` or `NameCombobox`.

### Dialogs and sheets (`src/components/ui/dialog.tsx`)

`.cursor/rules/form-dialog.mdc` is binding. In short:

- `DialogContent className="overflow-hidden sm:max-w-lg"`: a bottom sheet on phones (grab handle, 44px radius, slides up) and a centered glass dialog on desktop.
- `mobileLayout="nav"` when the footer holds exactly Cancel and Save. Phones then show them beside the title like an iOS sheet.
- Fields go in `DialogBody`, which is the only scroller. `DialogHeader` and `DialogFooter` stay fixed.
- `variant="drawer"` is for long side panels (access editing, d23 and m24): a full-height sheet on phones and a right-hand drawer on desktop.
- Never remove `lockDialogScroll`, the visual-viewport sizing, or the focus reveal.

### Delete confirmation

Always use `<DeleteConfirmDialog>` (`src/components/delete-confirm-dialog.tsx`). It renders the trash media tile, the title, the item name, an error slot, and `SlideToDelete` for confirmation (m29), with Cancel and Delete buttons (d27, m28). Do not build an inline `AlertDialog` for deletes.

### Tabs (`src/components/ui/tabs.tsx`)

- The default `TabsList` is the Atrium segmented control: a `bg-fill` capsule with a raised `bg-segment-active` pill. Use it for 2 to 5 views of the same data (Overview, Payments, Documents).
- `variant="line"` is an underline strip that scrolls sideways, for longer tab sets.
- Triggers draw at 32px but keep a 44px hit area on phones.

### Empty, loading, and toasts

- `Empty`, `EmptyMedia variant="icon"`, `EmptyTitle`, `EmptyDescription`, and `EmptyContent` (for an action) come from `src/components/ui/empty.tsx`. Use a lucide icon that names the object (`Inbox`, `FileText`, `Users`). The icon sits in a `bg-fill` tile, never on a colored circle.
- `Skeleton` (`src/components/ui/skeleton.tsx`) uses `bg-fill-strong` with a `motion-safe` pulse. `src/app/(app)/loading.tsx` is the generic route skeleton. A page whose layout differs a lot (for example, a dashboard) may add its own `loading.tsx` built only from `Skeleton` inside `Card`.
- Toasts use `sonner` through `src/components/ui/sonner.tsx` (glass float, token colors). Call `toast.success(...)` or `toast.error(...)`. Never render a custom banner for a transient result.

### Charts

Copy from `dashboard-charts.tsx`:

- Recharts for time series. Area fills use the `Fade` gradient (series color, 0.3 at the top, 0 at the bottom), strokes are about 2.2 to 2.6px, the grid is dashed `3 5` with `stroke="var(--border)"`, and axis ticks use `fill="var(--muted-foreground)"`.
- Custom SVG for donuts and rings (`ExpenseDonut`, `Ring`).
- The tooltip is `ChartTooltip` (glass float).
- Legends use `LegendDot`.
- Series colors come from the chart tokens. Revenue is `chart-1`, expense `chart-3`, profit `chart-2`, and counts or trends `chart-5`.

## Page recipes

**List page** (Leads, Vendors, Income, and the other modules). Copy `clients-table.tsx`:

1. `PageHeader` with the title and the actions `ListExport`, `CustomizeColumns`, and the primary Add button.
2. `ListSearch` with a placeholder and an optional status filter.
3. `DataList` with `mobileItem`. Name cells are `text-ui font-semibold`. Amounts use `<Money>` with success or destructive color only when the sign carries meaning. Statuses use `StatusBadge`. Types use an outline `Badge`.
4. A row "⋯" `DropdownMenu` with Edit and Delete. Delete opens `DeleteConfirmDialog`.

If the mockup shows summary tiles above the list (Bank, Budgets, Payroll), use a `grid grid-cols-2 gap-2.5 md:grid-cols-4 md:gap-4` of `Card` tiles with `Money`.

**Detail page** (Project Summary d06 and m07, Purchase Order detail, Payroll detail):

1. A `PageHeader` with an eyebrow (client or vendor), the title, a `StatusBadge`, and the actions.
2. A KPI row of `Card`s.
3. `Tabs` (segmented) for the sections.
4. Each section is a `Panel`-style `Card`: key-value rows as a `<dl>` with `border-t border-border` hairlines, or a nested `DataList`.

**Form** (add or edit any record). Copy `client-form-dialog.tsx` and `.cursor/rules/form-dialog.mdc`. Long forms such as the project form (d26 and m27) group fields under `FieldSet` and `FieldLegend` inside `DialogBody`.

**Settings-style page** (Settings d25 and m26, Profile). Grouped `Card`s, each a list of rows (label on the left, value or control on the right, hairline separators), like iOS Settings. Save buttons go in each card's `CardFooter`.

## Page mapping

### Pages with a mockup

| Route | Desktop | Mobile | Status |
| --- | --- | --- | --- |
| `/login`, `/set-password` | d01 | m01 | Done (Phase 1) |
| `/dashboard` | d02 | m02 | Done (Phase 1) |
| `/modules` | (sidebar) | m03 | Done (Phase 1) |
| `/clients` (+ form, delete) | d04, d26, d27 | m05, m27, m28, m29 | Done (Phase 1) |
| `/leads` | d03 | m04 | Phase 2 |
| `/projects` | d05 | m06 | Phase 2 |
| `/projects/[id]` | d06 | m07 | Phase 2 |
| `/vendors` | d07 | m08 | Phase 2 |
| `/purchase-orders` | d08 | m09 | Phase 2 |
| `/accounts/invoices` | d09 | m10 | Phase 2 |
| `/accounts/receivable` | d10 | m11 | Phase 2 |
| `/income` | d11 | m12 | Phase 2 |
| `/accounts/payable` | d12 | m13 | Phase 2 |
| `/expense` | d13 | m14 | Phase 2 |
| `/accounts/expenses` (Operational Expense) | d14 | m15 | Phase 2 |
| `/backlog` | d15 | m16 | Phase 2 |
| `/accounts/vat-tax` | d16 | m17 | Phase 2 |
| `/accounts/bank` | d17 | m18 | Phase 2 |
| `/accounts/budgets` | d18 | m19 | Phase 2 |
| `/assets` | d19 | m20 | Phase 2 |
| `/hr/employees` | d20 | m21 | Phase 2 |
| `/hr/payroll` | d21 | m22 | Phase 2 |
| `/settings/users` (+ access editor) | d22, d23 | m23, m24 | Phase 2 |
| `/activity` | d24 | m25 | Phase 2 |
| `/settings` | d25 | m26 | Phase 2 |
| Every add or edit form | d26 | m27 | Phase 2 (copy the client form) |
| Every delete | d27 | m28, m29 | Phase 2 (switch to `DeleteConfirmDialog`) |

### Screens without a mockup

| Screen | Atrium mapping |
| --- | --- |
| **Activity Log** (`/activity`, beyond d24 and m25) | List page. Desktop `DataList` (When, Who, Action, Record). Phone grouped list: `title` is the action sentence, `subtitle` is the person and record, `value` is the relative time. Filters are a `ListSearch` select plus a segmented `Tabs` for All, Creates, Edits, Deletes when that fits. A change diff opens in a `Dialog` (`variant="drawer"`) as a `<dl>` of before and after rows. |
| **Ctrl+K search** (`GlobalSearch`) | Desktop: a centered `glass-float` dialog with a 16px search `InputGroup` at the top and grouped results (`text-caption` group label, rows with a lucide module icon in a `bg-fill rounded-lg` box, and a keyboard hint). Phone: opened from the top-row search button as a full-height bottom sheet with the field pinned on top. Empty results use `Empty`. |
| **Profile menu** (`AccountMenu`, `MobileMoreMenu`) | A `DropdownMenu` on `glass-float`. The header is the avatar (`bg-avatar`) with name and email, then items with lucide icons (My Profile, Theme, Documents on phones), a separator, and Sign Out as `variant="destructive"`. On phones the "more" menu holds everything the desktop top bar holds. |
| **Profile page** (`/profile`) | Settings-style page: an identity card (avatar, name, role badge), then a grouped `FieldGroup layout="inset"` card for name and phone and a password card. |
| **Document studios** (`/documents/*`, `[id]`, `new`) | Lists follow the list recipe. The studio editor is split view on desktop: a left `Card` holding the form, and the paper preview on the right. The paper stays white in both themes because it is the printed artifact, using the document's own print styles, not app tokens. On phones it is the form first, with a "Preview" segmented `Tabs` that switches to the paper scaled to fit. Toolbar actions (Save, Download PDF, Share) are capsules in `PageHeader`. |
| **Reports** (`/reports`, `/reports/[slug]`) | The index is a grid of `Card` links (`grid-cols-1 gap-2.5 md:grid-cols-2 xl:grid-cols-3`), each with a colored icon tile, title, and description. A report page has a `PageHeader` with Export, filters in a toolbar row (capsule selects and date fields; on phones they go in a bottom sheet behind a "Filters" button), summary KPI `Card`s, then `DataList` or chart `Panel`s. |
| **Attachments** (`RecordAttachments`) | Inside a form or detail card, a quiet `bg-fill rounded-control` well listing files as rows (file-type icon, name, size, a ghost icon button to remove). The upload control is an `outline` button with `Paperclip`. With no files, it shows one muted line, not a big empty state. |
| **Bank reconciliation** (inside `/accounts/bank`) | Bank recipe (d17 and m18) for balances. Reconciliation opens a drawer `Dialog` (`variant="drawer"`) with a segmented `Tabs` for Unmatched and Matched. Rows show statement and ledger amounts side by side on desktop and stacked on phones. Matched rows get a success `StatusBadge`, and the difference is shown with `Money` in destructive when not zero. |
| **Purchase order and payroll detail** (`/purchase-orders/[id]`, `/hr/payroll/[id]`) | Detail recipe (copy the d06 and m07 structure). |
| **No access** (`/no-access`) | A centered `Empty` with a `ShieldX` icon, the title, and a description. No buttons beyond a link home. |
| **Invite accept, verify** (`/auth/accept`, `/verify/[token]`) | Signed-out chrome from `/login` (the `AuthStage` card). Never invent another signed-out layout. |

## Do and don't

**Do**

- Start every page from a reference page and a mockup. Calm and uncluttered wins: one primary action, generous spacing, and hairlines instead of boxes inside boxes.
- Use semantic tokens and the shared components for everything. If a shared component can't do something, extend it once (for example, a new variant) and use that.
- Use lucide icons for every navigation item, tile, and empty state, sized with `size-*` and colored with `text-*` tokens.
- Write phone layout first: grouped lists, bottom sheets, a 44px minimum touch target, 16px inputs, the right `inputMode` and `autoComplete`, and `pb-tabbar` clearance (the shell handles it).
- Keep titles in Title Case like the mockups ("Add New Client", "Last 12 Weeks").
- Respect `prefers-reduced-motion`.

**Don't**

- Don't hardcode colors (hex, `rgb()`, `oklch()`, palette classes, or arbitrary colors), and don't add `dark:` overrides or change values in `globals.css` for one screen.
- Don't write custom one-off styles: no inline `style={{…}}` for visuals, no `<style>` tags, and no hand-built buttons, inputs, selects, dialogs, or tables.
- Don't use dots, initials, or colored circles as icons. (The 6px dot inside `StatusBadge` and chart legend dots are the only dots.)
- Don't put a second header, tab bar, or sidebar in a page.
- Don't use `max-sm:`, `max-md:`, or other max-width variants, or design desktop first and undo it.
- Don't use Button sizes `xs`, `sm`, `icon-xs`, or `icon-sm` in pages, and don't shrink controls below their defaults.
- Don't remove focus rings, and don't add `outline-none`, `ring-0`, or `focus-visible:ring-0` to a control.
- Don't use inline `AlertDialog` deletes. Use `DeleteConfirmDialog`.
- Don't put inline scripts in the document. The CSP is nonce-based; see PWA below.

### PWA

- `src/app/manifest.ts` declares standalone display, theme colors, and icons (`public/icons/`). `src/app/layout.tsx` sets `theme-color` from the theme cookie and links the iOS splash images (`public/splash/`).
- `public/sw.js` is registered by `src/components/service-worker.tsx` in production only. It serves `public/offline.html` when a navigation fails. The worker and the offline page are served with their own strict CSP in `next.config.ts`, and `src/proxy.ts` skips them.
- Never add an inline `<script>`. The offline page is static HTML with inline CSS only, which its own CSP allows.

## Phase 2 checklist

For each page in the Phase 2 list:

1. Open its desktop and mobile mockups, dark and light.
2. Replace the header with `PageHeader`, and any section titles with `SectionHeader`.
3. Give `DataList` a `mobileItem` that matches the mockup's row (title, value, subtitle, meta).
4. Move amounts to `<Money>`, statuses to `<StatusBadge>`, and types to outline `Badge`.
5. Convert add and edit dialogs to the client-form structure (`FieldGroup layout="inset"`, `mobileLayout="nav"`, input hints).
6. Replace inline delete `AlertDialog`s with `DeleteConfirmDialog`.
7. Replace hand-rolled tabs with `Tabs`, empty paragraphs with `Empty`, and spinners with `Skeleton`.
8. Remove any remaining hardcoded color, `dark:` override, or legacy teal class.
9. Don't change data fetching, server actions, validation, or permissions.
10. Verify (below) at every size and in both themes.

Remaining pages: `/leads`, `/projects`, `/projects/[id]`, `/vendors`, `/purchase-orders`, `/purchase-orders/[id]`, `/accounts/invoices`, `/accounts/receivable`, `/income`, `/accounts/payable`, `/expense`, `/accounts/expenses`, `/backlog`, `/accounts/vat-tax`, `/accounts/bank` (with reconciliation), `/accounts/budgets`, `/assets`, `/hr/employees`, `/hr/payroll`, `/hr/payroll/[id]`, `/settings/users` (with the access drawer), `/activity`, `/settings`, `/profile`, `/reports`, `/reports/[slug]`, `/documents/*` (quotations, work orders, invoices, receipts, purchase orders: lists, `[id]`, `new`), `/no-access`, `/auth/accept`, `/verify/[token]`, the global search dialog, and every module's add, edit, and delete dialogs.

## Verifying a page

1. `npm run lint`, `npx tsc --noEmit`, and `npm run build` all pass.
2. Screenshot at 390x844, 430x932, 768x1024, 1440x900, and 1920x1080, in dark and light. Pages scroll inside `main`, so for full-page shots grow the viewport to `main.scrollHeight` before capturing.
3. Put each screenshot beside the mockup render at the same width and compare spacing, type sizes, radii, and colors, not just the overall layout.
4. Check the phone keyboard path: focus each field in a sheet, make sure the field scrolls into view, the page behind does not jump, and the right keyboard appears.
5. Test the dev server on `http://localhost:3000`, not `127.0.0.1`. Next dev blocks `/_next` assets for a different origin and the page won't hydrate.
