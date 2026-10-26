# Documents

Set C is the print design for every business document. The on-screen preview and the downloaded PDF are the same HTML and CSS. The preview is a full page inside the document screen, so the stylesheet, fonts, and letterhead load from this app. An unsaved document shows the Draft watermark in both the preview and the PDF. After a document is saved, Download rebuilds it from the database; if the form has unsaved edits, Download stays disabled until you save. Nothing is drawn a second time with pdf-lib except placing the letterhead image under the pages so the 300 dpi PNG is not recompressed.

## Templates

The design lives in one stylesheet, `public/documents/setc.css`, and one renderer, `src/lib/documents/setc/render.ts`. Fonts are Poppins, Inter, and Noto Sans Bengali (the ৳ sign) in `public/documents/fonts/`. The letterhead is `public/brand/letterhead-300dpi.png`. Do not recompress that file.

To change the look later, edit `public/documents/setc.css` (and, only if the structure of a page changes, the matching function in `render.ts`). Preview and PDF both read that renderer, so they stay in step. Swap the stylesheet, keep the class names (`.page`, `.content`, `.head`, `.grid`, `.signs`), and the documents follow.

## Print and download

- **Download PDF** is the full A4 page on the letterhead.
- **Print** is the same inner page with the letterhead image removed, for pre-printed pads. Positions and spacing do not move.

The PDF route is `src/app/api/documents/pdf/route.ts`. On Vercel it uses `puppeteer-core` and `@sparticuz/chromium`. On this machine it uses the installed Chrome.

## Margins

Settings → top and bottom print margins apply on every page, including page 2. Content starts at the top margin. It ends at `min(243 mm, 297 mm − bottom margin)`, so it never crosses the letterhead footer. A bottom margin under 54 mm does not move that footer line; a larger one shortens every page. When no saved margins are loaded, the defaults are the Set C page: 16 mm top and 54 mm bottom. The saved company row is left as it is. Left and right insets stay 20 mm and 16 mm.

Prepared By, Checked By, and Authorized By each have a checkbox. Only ticked signatures are printed. The signature block sits inside the content box, above a flexible gap, so it does not overlap the footer.

## Numbering

New documents use:

`TYPE/DSAE/PROJECTCODE-PARTYCODE/DDMMYYYY`

TYPE is QTN, WO, PO, RFQ, DC, INV, MR, PV, or WCC. PARTYCODE is the vendor for WO, PO, RFQ, DC, and PV, and the client (or lead) for QTN, INV, MR, and WCC. Codes are the initials of the name. An operational purchase order uses OPS as the project code; an RFQ without a project uses ADM (`RFQ/DSAE/PROJECTCODE-VENDORCODE/DDMMYYYY`). A second document with the same stem on the same day gets `-2`, `-3`, and so on. A revised quotation gets `-V2`, `-V3`.

Salary slips: `SAL/DSAE/YYYY-MM/EMPCODE`, using the employee code (for example 014), not name initials. New employees get the next code (001, 002, …) on the employee form. You can edit it. A blank code on insert is filled in by the database. The code is unique ignoring case and surrounding spaces.

Letters and notices: `DSAE/PROJECTCODE-or-ADM/LTR-or-NTC/DDMM-YYYY`.

Documents that already have a number keep it. Saving an existing document does not renumber it. Download file names are the document number with `/` replaced by `-`. The print file adds `-print`.

## Where each document gets its figures

| Document | Source | Amount |
| --- | --- | --- |
| Quotation | Client or lead, and an optional project | Sum of its own lines, plus AIT |
| Work order | Purchase order | Sum of the work order lines |
| Purchase order | The purchase order | Must equal the purchase order total |
| Request for quotation | Vendor, and an optional project | Quantities and specifications only; no unit price or amount (`total` stays 0) |
| Delivery challan | Purchase order or project | Quantities on the challan; no second money total |
| Bill / invoice | Client invoice | Must equal the invoice amount; payments are the recorded receipts |
| Money receipt | Client payment | The payment amount |
| Payment voucher | Vendor payment or operational expense | Net paid is that recorded amount |
| Work completion certificate | Project, and its work order number when one exists | No invented contract value |
| Salary slip | Payroll line and employee | Earnings, deductions, and net pay match the payroll line |
| Letter / notice | Optional client or project | No book amount |

The verification QR is `https://<origin>/verify/<token>` after the document is saved.

## Permissions and trash

Each document uses the module it belongs to (quotations, work orders, purchase orders, projects, client invoices, vendor payments, operational expenses, payroll, or clients). Delete and permanent delete stay owner-only, through the existing trash.

Apply `supabase/migrations/20261023220000_set_c_documents.sql` before creating challans, vouchers, certificates, salary slips, or letters, and before saving a quotation that has a lead and no client, and apply `supabase/migrations/20261027020000_form_documents_rfq.sql` before saving RFQs. Migrations are not applied by the app.
