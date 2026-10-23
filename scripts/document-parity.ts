import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"

import { amountInWords } from "../src/lib/documents/money"
import type { PrintDocument } from "../src/lib/documents/present"
import { loadPrintCss, renderDocumentPdf } from "../src/lib/documents/setc/pdf"
import { contentBox, renderDocument } from "../src/lib/documents/setc/render"
import type { DocumentModel } from "../src/lib/documents/setc/types"

const outDir = path.resolve("artifacts/set-c")
const marginSets = [
  { name: "16-54", margins: { topMm: 16, bottomMm: 54 } },
  { name: "32-28", margins: { topMm: 32, bottomMm: 28 } },
]

const words = amountInWords(1632960)

function printDoc(patch: Partial<PrintDocument> & Pick<PrintDocument, "kicker" | "title" | "numberLabel" | "documentNo">): PrintDocument {
  return {
    issuedOn: "14 September 2026",
    verifyUrl: "https://erp.example.com/verify/" + "ab".repeat(32),
    parties: [{ heading: "Prepared For", name: "Mr. Arif Chowdhury", detail: "Apartment B-6\nBashundhara R/A, Dhaka" }],
    facts: [
      { label: "Client Name", value: "Mr. Arif Chowdhury" },
      { label: "Project Name", value: "Chowdhury Residence – Interior" },
      { label: "Area", value: "2,450 Sft" },
      { label: "Valid Until", value: "14 October 2026" },
    ],
    intro: "",
    lines: [],
    milestonesTitle: "Payment Schedule",
    milestones: [],
    wordsLabel: "Amount In Words",
    words,
    summary: [{ label: "Total", amount: "৳16,32,960.00", strong: true }],
    terms: "Valid for 30 days from the date of issue.\nPayment by cheque to DynamicSpace Architects & Engineers.",
    exclusions: "Loose furniture.\nVAT, if applicable.",
    notes: "",
    signatures: [
      { label: "Prepared By", name: "Engr. Mahmudul Hasan", detail: "Project Manager" },
      { label: "Authorized Signature", name: "Zishan MD Adnan Ul Hoque", detail: "Founder | Architect" },
    ],
    ...patch,
  }
}

const quotation = printDoc({
  kicker: "Quotation",
  title: "Estimate & Financial Proposal",
  numberLabel: "Quotation No.",
  documentNo: "QTN/DSAE/CRI-AC/14092026",
  lines: [
    { section: "A. Design & Consultancy", item: "Interior Design", specification: "Concept and drawings.", quantity: "2,450", unit: "Sft", unitPrice: "60.00", total: "1,47,000.00" },
    { section: "A. Design & Consultancy", item: "Site Supervision", specification: "Periodic visits.", quantity: "1", unit: "Job", unitPrice: "45,000.00", total: "45,000.00" },
    { section: "B. Civil & Finishing", item: "False Ceiling", specification: "Gypsum board.", quantity: "1,850", unit: "Sft", unitPrice: "145.00", total: "2,68,250.00" },
    { section: "C. Woodwork", item: "Kitchen Cabinet", specification: "Soft-close.", quantity: "28", unit: "Rft", unitPrice: "9,500.00", total: "2,66,000.00" },
  ],
  milestones: [
    { label: "On signing", percent: "40%", amount: "6,53,184.00" },
    { label: "At 50% progress", percent: "30%", amount: "4,89,888.00" },
    { label: "At handover", percent: "30%", amount: "4,89,888.00" },
  ],
  summary: [
    { label: "Sub Total", amount: "15,55,200.00" },
    { label: "AIT (5%)", amount: "77,760.00" },
    { label: "Total Quoted Amount", amount: "16,32,960.00", strong: true },
  ],
  signatures: [
    { label: "Prepared By", name: "Engr. Mahmudul Hasan", detail: "Project Manager" },
    { label: "Authorized Signature", name: "Zishan MD Adnan Ul Hoque", detail: "Founder | Architect" },
    { label: "Accepted By (Client)", name: "Mr. Arif Chowdhury", detail: "Signature & Date" },
  ],
})

const models: Array<[string, DocumentModel]> = [
  ["01-quotation", { kind: "print", doc: quotation }],
  ["02-work-order", { kind: "print", doc: printDoc({
    kicker: "Work Order",
    title: "Vendor / Service Provider",
    numberLabel: "Ref",
    documentNo: "WO/DSAE/MDL-HGA/12022026",
    parties: [{ heading: "To", name: "Md. Kamrul Hasan", detail: "Proprietor, Hasan Glass & Aluminium\nTejgaon, Dhaka" }],
    facts: [
      { label: "Vendor Name", value: "Hasan Glass & Aluminium" },
      { label: "Project Name", value: "Meghna Digital – Navana Tower L7" },
      { label: "Proposal Date", value: "05 February 2026" },
      { label: "Work Period", value: "15 February 2026 – 31 March 2026" },
    ],
    intro: "Work Order for Glass Partition & Tempered Glass Door Works\n\nWe are pleased to submit the following work order in accordance with the terms below.",
    lines: [
      { section: "", item: "Glass Partition", specification: "10mm clear float glass.", quantity: "780", unit: "Sft", unitPrice: "310.00", total: "2,41,800.00" },
      { section: "", item: "Tempered Glass Swing Door", specification: "Frameless 10mm.", quantity: "8", unit: "Nos", unitPrice: "17,500.00", total: "1,40,000.00" },
    ],
    milestones: [
      { label: "Advance", percent: "30%", amount: "1,14,540.00" },
      { label: "On progress", percent: "50%", amount: "1,90,900.00" },
      { label: "On acceptance", percent: "20%", amount: "76,360.00" },
    ],
    summary: [{ label: "Total Work Order Value", amount: "3,81,800.00", strong: true }],
    words: amountInWords(381800),
    terms: "All works as per design and direction of Architect.\nBills must quote the work order number.",
  }) }],
  ["03-purchase-order", { kind: "print", doc: printDoc({
    kicker: "Purchase Order",
    title: "Materials Procurement",
    numberLabel: "PO No.",
    documentNo: "PO/DSAE/OPS-RBH/18022026",
    parties: [
      { heading: "Vendor", name: "Rahim Board & Hardware", detail: "64 Nawabpur Road, Dhaka" },
      { heading: "Deliver To", name: "Operational", detail: "DSA Workshop, Banasree" },
    ],
    facts: [
      { label: "Project Name", value: "Operational" },
      { label: "Site", value: "Banasree, Dhaka" },
      { label: "Receiver", value: "Store In-Charge" },
      { label: "Delivery Date", value: "22 February 2026" },
    ],
    lines: [
      { section: "", item: "Plain Board 12mm", specification: "8 by 4 feet.", quantity: "85", unit: "Sheet", unitPrice: "1,450.00", total: "1,23,250.00" },
    ],
    summary: [
      { label: "Sub Total", amount: "1,23,250.00" },
      { label: "Grand Total", amount: "1,23,250.00", strong: true },
    ],
    words: amountInWords(123250),
    milestones: [],
  }) }],
  ["04-delivery-challan", { kind: "challan", doc: {
    documentNo: "DC/DSAE/MDL-HGA/07032026",
    issuedOn: "07 March 2026",
    verifyUrl: "https://erp.example.com/verify/" + "cd".repeat(32),
    deliverToName: "Meghna Digital Ltd.",
    deliverToDetail: "Navana Tower, Gulshan-1, Dhaka",
    facts: [
      { label: "Project Name", value: "Navana Tower – Level 7" },
      { label: "Client WO No.", value: "WO/MDL/ADM/2026/0187" },
      { label: "Dispatched From", value: "DSA Workshop, Banasree" },
      { label: "Vehicle No.", value: "Dhaka Metro-Ta 14-2378" },
      { label: "Driver Name", value: "Md. Sohel Rana" },
    ],
    lines: [
      { item: "Door Lock", specification: "", unit: "Nos", ordered: "8", delivered: "8", remarks: "1 carton" },
      { item: "Enamel Paint", specification: "", unit: "Tin", ordered: "12", delivered: "10", remarks: "Balance next lot" },
    ],
    packages: "Total Packages: 2",
    declaration: "Received the above goods in good order and condition.",
    note: "This challan is not a bill.",
    signatures: [
      { label: "Prepared By", name: "Md. Rakib Hossain", detail: "Store In-Charge" },
      { label: "Received By", name: "", detail: "Name, Signature & Date" },
    ],
  } }],
  ["05-bill-invoice", { kind: "print", doc: printDoc({
    kicker: "Bill Invoice",
    title: "Final Bill",
    numberLabel: "Invoice No.",
    documentNo: "INV/DSAE/MDL-MDL/14052026",
    parties: [{ heading: "Bill To", name: "Ms. Sharmin Akter", detail: "Meghna Digital Ltd.\nGulshan-1, Dhaka" }],
    facts: [
      { label: "Due Date", value: "28 May 2026" },
      { label: "Customer Name", value: "Meghna Digital Ltd." },
      { label: "Project Name", value: "Navana Tower – Level 7" },
      { label: "Work Order No.", value: "WO/MDL/ADM/2026/0187" },
    ],
    lines: [
      { section: "", item: "Final bill of interior fit-out", specification: "As per the approved work order.", quantity: "1", unit: "Job", unitPrice: "12,00,000.00", total: "12,00,000.00" },
    ],
    summary: [
      { label: "Sub Total", amount: "12,00,000.00" },
      { label: "Grand Total", amount: "12,00,000.00", strong: true },
      { label: "Less: Installment 01", amount: "5,00,000.00", deduct: true },
      { label: "Net Payable", amount: "7,00,000.00", strong: true },
    ],
    words: amountInWords(1200000),
    netWords: amountInWords(700000),
    bookAmount: 1200000,
    notes: "Please quote the invoice number with your payment.",
    milestones: [],
  }) }],
  ["06-money-receipt", { kind: "print", doc: printDoc({
    kicker: "Money Receipt",
    title: "Payment Acknowledgement",
    numberLabel: "Receipt No.",
    documentNo: "MR/DSAE/MDL-MDL/02032026",
    parties: [{ heading: "Received From", name: "Meghna Digital Ltd.", detail: "Gulshan-1, Dhaka" }],
    facts: [
      { label: "Against Invoice No.", value: "INV/DSAE/MDL-MDL/20022026" },
      { label: "Customer Name", value: "Meghna Digital Ltd." },
      { label: "Payment Method", value: "RTGS" },
      { label: "Transaction Ref.", value: "SCB-RTGS-260302-45871" },
    ],
    lines: [{ section: "", item: "Installment 02", specification: "Received by RTGS.", quantity: "", unit: "", unitPrice: "", total: "12,00,000.00" }],
    summary: [{ label: "Total Paid", amount: "12,00,000.00", strong: true }],
    words: amountInWords(1200000),
    wordsLabel: "Paid Amount In Words",
    notes: "This receipt is valid subject to realization.",
    milestones: [],
    terms: "",
    exclusions: "",
  }) }],
  ["07-payment-voucher", { kind: "voucher", doc: {
    documentNo: "PV/DSAE/MDL-HGA/24032026",
    issuedOn: "24 March 2026",
    verifyUrl: "https://erp.example.com/verify/" + "ef".repeat(32),
    paidToName: "Hasan Glass & Aluminium",
    paidToDetail: "Tejgaon, Dhaka",
    facts: [
      { label: "Vendor Name", value: "Hasan Glass & Aluminium" },
      { label: "Project Name", value: "Meghna Digital – Level 7" },
      { label: "Against WO No.", value: "WO/DSAE/MDL-HGA/12022026" },
      { label: "Vendor Bill No.", value: "HGA/BILL/2026/031" },
      { label: "Account Head", value: "Project Cost – Sub-Contract" },
    ],
    lines: [
      { item: "Running bill", specification: "Verified by the project manager.", amount: 190900 },
      { item: "Less: AIT", specification: "", amount: 9545, deduct: true },
    ],
    net: 181355,
    paymentMode: "A/C payee cheque, Dutch-Bangla Bank",
    statusNote: "",
    narration: "Payment against the running bill after deduction.",
    note: "Deducted tax will be deposited to the treasury.",
    signatures: [
      { label: "Prepared By", name: "Nusrat Jahan", detail: "Accounts Officer" },
      { label: "Authorized Signature", name: "Zishan MD Adnan Ul Hoque", detail: "Founder | Architect" },
    ],
  } }],
  ["08-completion", { kind: "certificate", doc: {
    documentNo: "WCC/DSAE/MDL-MDL/12052026",
    issuedOn: "12 May 2026",
    verifyUrl: "https://erp.example.com/verify/" + "12".repeat(32),
    clientName: "Ms. Sharmin Akter",
    clientDetail: "Meghna Digital Ltd.",
    facts: [
      { label: "Project Name", value: "Navana Tower – Level 7" },
      { label: "Work Order No.", value: "WO/MDL/ADM/2026/0187" },
      { label: "Site Address", value: "Gulshan-1, Dhaka" },
      { label: "Start Date", value: "01 February 2026" },
      { label: "Completion Date", value: "10 May 2026" },
    ],
    intro: "This is to certify that the interior fit-out works have been completed as per the work order.",
    scope: ["Dry wall partitions.", "Glass doors and hardware.", "Final cleaning."],
    inspections: [{ item: "Workmanship", status: "Satisfactory", remarks: "—" }],
    defect: "Workmanship defects reported within 6 months will be rectified.",
    signatures: [
      { label: "Prepared By", name: "Engr. Mahmudul Hasan", detail: "Project Manager" },
      { label: "Accepted By (Client)", name: "Ms. Sharmin Akter", detail: "Meghna Digital Ltd." },
    ],
  } }],
  ["09-salary-slip", { kind: "salary", doc: {
    documentNo: "SAL/DSAE/2026-09/014",
    issuedOn: "05 October 2026",
    verifyUrl: "https://erp.example.com/verify/" + "99".repeat(32),
    periodSubtitle: "Pay Period: September 2026",
    employeeName: "Engr. Tanvir Ahmed",
    employeeDetail: "Site Engineer (Civil)\nDepartment: Construction",
    facts: [
      { label: "Pay Period", value: "September 2026" },
      { label: "Working Days", value: "26" },
      { label: "Days Present / Leave", value: "25 / 1" },
      { label: "Payment Mode", value: "Bank Transfer" },
      { label: "Account No.", value: "**** 4821" },
    ],
    earnings: [{ label: "Basic Salary", amount: 30000 }, { label: "Allowance", amount: 24500 }],
    deductions: [{ label: "Deductions", amount: 9250 }],
    net: 45250,
    notes: ["This slip is confidential."],
    signatures: [
      { label: "Prepared By", name: "Nusrat Jahan", detail: "Accounts Officer" },
      { label: "Received By", name: "Engr. Tanvir Ahmed", detail: "Employee Signature & Date" },
    ],
  } }],
  ["10-notice", { kind: "letter", doc: {
    documentNo: "DSAE/ADM/NTC/1805-2026",
    issuedOn: "18 May 2026",
    verifyUrl: null,
    notice: true,
    audience: "For All Office & Site Staff",
    addressee: [],
    subject: "Office & Site Holiday for Eid-ul-Adha 2026",
    paragraphs: [
      "This is to notify all employees that the office and all project sites will remain closed from **25 May 2026 (Monday)** to **31 May 2026 (Sunday)**. Regular work will resume on **01 June 2026 (Monday)**.",
      "All staff are requested to complete pending handovers by 21 May 2026. We wish everyone a safe and joyous Eid Mubarak.",
    ],
    rows: [
      { label: "Salary & Festival Bonus", value: "Will be disbursed on or before 21 May 2026." },
      { label: "Project Sites", value: "Site Engineers must secure materials before leaving on 24 May 2026." },
      { label: "Emergency Contact", value: "DSA Office · +880 1841-848831" },
      { label: "Pending Payments", value: "Vendor payments due during the holiday will be processed on 01 June 2026." },
    ],
    duty: [
      { project: "Meghna Digital – Navana Tower L7", site: "Gulshan-1, Dhaka", person: "Md. Jamal Uddin", phone: "+880 1734-221190" },
      { project: "Chowdhury Residence", site: "Bashundhara R/A", person: "Md. Shafiqul Islam", phone: "+880 1922-675341" },
    ],
    closing: "",
    cc: "Distribution: Notice Board · All Site Offices",
    signatures: [{ label: "Authorized Signature", name: "Zishan MD Adnan Ul Hoque", detail: "Founder | Architect" }],
  } }],
  ["11-letter", { kind: "letter", doc: {
    documentNo: "DSAE/MDL/LTR/1005-2026",
    issuedOn: "10 May 2026",
    verifyUrl: "https://erp.example.com/verify/" + "aa".repeat(32),
    notice: false,
    audience: "Official Correspondence",
    addressee: ["Ms. Sharmin Akter", "Meghna Digital Ltd.", "Gulshan-1, Dhaka"],
    addresseeStrong: [true, true, false],
    subject: "Completion of work and request for final inspection",
    paragraphs: [
      "Dear Madam,",
      "We are pleased to inform you that the interior fit-out works have been completed as per the approved design.",
      "We kindly request a joint inspection of the site.",
    ],
    rows: [],
    duty: [],
    closing: "",
    cc: "CC: Project Manager",
    signatures: [{ label: "Authorized Signature", name: "Zishan MD Adnan Ul Hoque", detail: "Founder | Architect" }],
  } }],
]

function checkLayout() {
  const out: string[] = []
  const mm = 96 / 25.4
  const root = getComputedStyle(document.documentElement)
  const top = parseFloat(root.getPropertyValue("--doc-top"))
  const height = parseFloat(root.getPropertyValue("--doc-height"))
  document.querySelectorAll(".page").forEach((pg, i) => {
    const content = pg.querySelector(".content")
    if (!content) return
    const pr = pg.getBoundingClientRect()
    if (content.scrollHeight > content.clientHeight + 1) {
      out.push(`page ${i + 1} overflows by ${((content.scrollHeight - content.clientHeight) / mm).toFixed(1)}mm`)
    }
    const floor = top + height
    content.querySelectorAll("*").forEach((el) => {
      const r = el.getBoundingClientRect()
      if (!r.height) return
      const bottom = (r.bottom - pr.top) / mm
      if (bottom > floor + 0.4) out.push(`page ${i + 1} bottom ${bottom.toFixed(1)}mm past floor ${floor.toFixed(1)}`)
      if (bottom > 243.2) out.push(`page ${i + 1} crosses 243mm at ${bottom.toFixed(1)}`)
    })
  })
  if (/\bID\b/.test(document.body.innerText)) out.push("FOUND ID text")
  return { issues: out, pages: document.querySelectorAll(".page").length, top, height }
}

async function main() {
  await mkdir(outDir, { recursive: true })
  const css = await loadPrintCss()
  const letterheadUri = `data:image/png;base64,${(await readFile("public/brand/letterhead-300dpi.png")).toString("base64")}`
  const withLetterhead = (html: string) => html.replaceAll('src="/brand/letterhead-300dpi.png"', `src="${letterheadUri}"`)
  const report: string[] = []
  const puppeteer = await import("puppeteer-core")
  const browser = await puppeteer.default.launch({
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  })
  const page = await browser.newPage()
  await page.setViewport({ width: 1406, height: 1988, deviceScaleFactor: 1 })

  for (const set of marginSets) {
    const dir = path.join(outDir, set.name)
    await mkdir(dir, { recursive: true })
    const box = contentBox(set.margins)
    report.push(`${set.name} box top ${box.top} floor ${box.floor} height ${box.height}`)
    for (const [name, model] of models) {
      const letter = renderDocument(model, set.margins, "letterhead", css)
      const printed = renderDocument(model, set.margins, "print", css)
      await page.setContent(withLetterhead(letter.html), { waitUntil: "load" })
      await page.evaluate(() => document.fonts.ready)
      const checked = await page.evaluate(checkLayout)
      report.push(`${set.name} ${name} pages ${checked.pages} ${checked.issues.length ? checked.issues.join("; ") : "floor OK"}`)
      const handles = await page.$$(".page")
      for (let index = 0; index < handles.length; index += 1) {
        const shot = await handles[index].screenshot({ type: "png" })
        const file = handles.length === 1 ? `${name}-download.png` : `${name}-download-p${index + 1}.png`
        await writeFile(path.join(dir, file), shot)
      }
      await page.setContent(printed.html, { waitUntil: "load" })
      await page.evaluate(() => document.fonts.ready)
      const printPages = await page.$$(".page")
      for (let index = 0; index < printPages.length; index += 1) {
        const shot = await printPages[index].screenshot({ type: "png" })
        const file = printPages.length === 1 ? `${name}-print.png` : `${name}-print-p${index + 1}.png`
        await writeFile(path.join(dir, file), shot)
      }
      if (set.name === "16-54") {
        const download = await renderDocumentPdf(model, set.margins, true)
        const printPdf = await renderDocumentPdf(model, set.margins, false)
        await writeFile(path.join(dir, `${name}-download.pdf`), download)
        await writeFile(path.join(dir, `${name}-print.pdf`), printPdf)
      }
    }
  }
  await page.setViewport({ width: 375, height: 812, deviceScaleFactor: 1 })
  const phone = renderDocument(models[3][1], marginSets[1].margins, "letterhead", css)
  await page.setContent(
    `<!DOCTYPE html><html class="dark"><body style="margin:0;background:#141414;width:375px"><div id="frame" style="width:343px;margin:16px;overflow:hidden"></div></body></html>`,
    { waitUntil: "load" },
  )
  await page.evaluate((doc) => {
    const frame = document.getElementById("frame")
    const iframe = document.createElement("iframe")
    iframe.setAttribute("scrolling", "no")
    iframe.style.cssText = "width:794px;height:1123px;border:0;transform-origin:top left;transform:scale(0.432)"
    iframe.srcdoc = doc
    frame?.appendChild(iframe)
    if (frame) frame.style.height = `${Math.round(1123 * 0.432)}px`
  }, withLetterhead(phone.html))
  await new Promise((resolve) => setTimeout(resolve, 400))
  const phoneCheck = await page.evaluate(() => {
    const frame = document.getElementById("frame")
    const iframe = frame?.querySelector("iframe")
    const paper = iframe?.getBoundingClientRect()
    const doc = iframe?.contentDocument
    const pageBg = doc ? getComputedStyle(doc.body).backgroundColor : ""
    const shell = getComputedStyle(document.body).backgroundColor
    const frameBox = frame?.getBoundingClientRect()
    const spills =
      paper && frameBox
        ? paper.right > frameBox.right + 1 || paper.left < frameBox.left - 1
        : true
    return {
      shell,
      pageBg,
      paperWidth: Math.round(paper?.width ?? 0),
      frameWidth: Math.round(frameBox?.width ?? 0),
      spills,
    }
  })
  report.push(
    `375 night shell ${phoneCheck.shell} page ${phoneCheck.pageBg} paper ${phoneCheck.paperWidth}px in ${phoneCheck.frameWidth}px spill ${phoneCheck.spills ? "YES" : "no"}`,
  )
  await browser.close()
  await writeFile(path.join(outDir, "report.txt"), report.join("\n"), "utf8")
  console.log(report.join("\n"))
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
