import puppeteer from "puppeteer-core"
import { PDFDocument } from "pdf-lib"

import { loadPrintCss } from "../src/lib/documents/setc/pdf"
import { renderDocument } from "../src/lib/documents/setc/render"
import type { DocumentModel } from "../src/lib/documents/setc/types"

async function pagesOf(bytes: Uint8Array) {
  const doc = await PDFDocument.load(bytes)
  return doc.getPageCount()
}

async function main() {
  const css = await loadPrintCss()
  const model = {
    kind: "print",
    doc: {
      kicker: "Quotation",
      title: "Estimate",
      numberLabel: "Quotation No.",
      documentNo: "QTN/DSAE/CRI-AC/14092026",
      issuedOn: "14 September 2026",
      verifyUrl: null,
      parties: [{ heading: "Prepared For", name: "A", detail: "B" }],
      facts: [{ label: "Client Name", value: "A" }, { label: "Project Name", value: "P" }],
      intro: "",
      lines: [
        { section: "A", item: "One", specification: "Spec", quantity: "1", unit: "Job", unitPrice: "10", total: "10" },
        { section: "B", item: "Two", specification: "Spec", quantity: "2", unit: "Job", unitPrice: "20", total: "40" },
      ],
      milestonesTitle: "Payment Schedule",
      milestones: [{ label: "Start", percent: "100%", amount: "50" }],
      wordsLabel: "Amount In Words",
      words: "Taka Fifty Only",
      summary: [{ label: "Sub Total", amount: "50" }, { label: "Total Quoted Amount", amount: "50", strong: true }],
      terms: "One.\nTwo.",
      exclusions: "None.",
      notes: "",
      signatures: [{ label: "Prepared By", name: "A", detail: "B" }],
    },
  } satisfies DocumentModel
  const browser = await puppeteer.launch({
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    headless: true,
    args: ["--no-sandbox"],
  })
  const page = await browser.newPage()
  for (const mode of ["letterhead", "print", "sheet"] as const) {
    const { html, pages } = renderDocument(model, { topMm: 16, bottomMm: 54 }, mode, css)
    await page.setContent(html, { waitUntil: "load" })
    const pdf = await page.pdf({
      printBackground: true,
      preferCSSPageSize: true,
      omitBackground: mode === "sheet",
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
    })
    const buf = Buffer.from(pdf)
    console.log(mode, "html", pages.length, "pdf", await pagesOf(pdf), "dct", buf.includes("DCTDecode"))
  }
  await browser.close()
}

main()
