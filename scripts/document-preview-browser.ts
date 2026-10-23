/**
 * Opens the real /documents screens in Chrome and checks the live preview
 * against the same HTML the PDF route prints. Requires the app on PREVIEW_BASE_URL
 * (default http://127.0.0.1:3000) and .env.local so a session can be opened.
 * Prints style results only. Does not print secrets.
 */
import { readFile } from "node:fs/promises"
import { createClient } from "@supabase/supabase-js"
import puppeteer from "puppeteer-core"

import { loadPrintCss } from "../src/lib/documents/setc/pdf"
import { renderDocument } from "../src/lib/documents/setc/render"
import type { DocumentModel } from "../src/lib/documents/setc/types"

const base = process.env.PREVIEW_BASE_URL ?? "http://127.0.0.1:3000"

type PreviewMetrics = {
  ok?: boolean
  reason?: string
  src?: string
  font: string
  foot: string
  head: string
  titleSize: string
  titleColor: string
  titleText?: string
  titleLines: number
  refText?: string
  refLines: number
  img: number
  css?: string
  rules?: number
  draft?: boolean
}

const certificate: DocumentModel = {
  kind: "certificate",
  doc: {
    documentNo: "WCC/DSAE/MDL-MDL/12052026",
    issuedOn: "12 May 2026",
    verifyUrl: null,
    clientName: "Meghna Digital Ltd.",
    clientDetail: "Gulshan-1, Dhaka",
    facts: [{ label: "Project Name", value: "Navana Tower" }],
    intro: "This is to certify that the work is complete.",
    scope: ["Partitions", "Glass doors"],
    inspections: [{ item: "Workmanship", status: "Satisfactory", remarks: "—" }],
    defect: "Six months.",
    signatures: [{ label: "Certified By", name: "Engr. Mahmudul Hasan", detail: "Project Manager" }],
  },
}

const liveMeasure = `(() => {
  const frame = document.querySelector('iframe[title="Document preview"]')
  if (!frame || !frame.contentDocument) return { ok: false, reason: "no preview frame" }
  const doc = frame.contentDocument
  const body = doc.body
  const foot = doc.querySelector(".pfoot")
  const head = doc.querySelector(".head")
  const title = doc.querySelector(".title h1")
  const ref = doc.querySelector(".head .ref b")
  const image = doc.querySelector("img.bg")
  const link = doc.querySelector('link[rel="stylesheet"]')
  let rules = 0
  try { rules = link && link.sheet ? link.sheet.cssRules.length : 0 } catch (error) { rules = -1 }
  return {
    ok: true,
    src: frame.getAttribute("srcdoc") ? "srcdoc" : frame.src,
    font: body ? getComputedStyle(body).fontFamily : "",
    foot: foot ? getComputedStyle(foot).display : "",
    head: head ? getComputedStyle(head).display : "",
    titleSize: title ? getComputedStyle(title).fontSize : "",
    titleColor: title ? getComputedStyle(title).color : "",
    titleText: title ? (title.textContent || "").trim() : "",
    titleLines: title ? title.getClientRects().length : 0,
    refText: ref ? (ref.textContent || "").trim() : "",
    refLines: ref ? ref.getClientRects().length : 0,
    img: image && image.complete ? image.naturalWidth : 0,
    css: link ? link.getAttribute("href") : "",
    rules,
    draft: body ? body.classList.contains("draft") : false,
  }
})()`

const sheetMeasure = `(() => {
  const body = document.body
  const foot = document.querySelector(".pfoot")
  const head = document.querySelector(".head")
  const title = document.querySelector(".title h1")
  const ref = document.querySelector(".head .ref b")
  const image = document.querySelector("img.bg")
  return {
    font: getComputedStyle(body).fontFamily,
    foot: foot ? getComputedStyle(foot).display : "",
    head: head ? getComputedStyle(head).display : "",
    titleSize: title ? getComputedStyle(title).fontSize : "",
    titleColor: title ? getComputedStyle(title).color : "",
    titleText: title ? (title.textContent || "").trim() : "",
    titleLines: title ? title.getClientRects().length : 0,
    refText: ref ? (ref.textContent || "").trim() : "",
    refLines: ref ? ref.getClientRects().length : 0,
    img: image && image.complete ? image.naturalWidth : 0,
    draft: body.classList.contains("draft"),
  }
})()`

function loadEnv() {
  const loader = process.loadEnvFile
  if (!loader) return
  try {
    loader(".env.local")
  } catch {
    // The app server may already have been given its environment.
  }
}

function sessionCookies(supabaseUrl: string, session: object) {
  const ref = new URL(supabaseUrl).hostname.split(".")[0]
  const name = `sb-${ref}-auth-token`
  const value = `base64-${Buffer.from(JSON.stringify(session)).toString("base64url")}`
  const size = 3180
  if (value.length <= size) return [{ name, value }]
  const parts: Array<{ name: string; value: string }> = []
  for (let index = 0, cursor = 0; cursor < value.length; index += 1, cursor += size) {
    parts.push({ name: `${name}.${index}`, value: value.slice(cursor, cursor + size) })
  }
  return parts
}

async function signIn(page: import("puppeteer-core").Page) {
  loadEnv()
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !serviceKey || !anonKey) throw new Error("Missing Supabase env. The documents pages need a session.")
  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
  const listed = await admin.auth.admin.listUsers({ page: 1, perPage: 20 })
  const user = listed.data.users.find((item) => item.email)
  if (!user?.email) throw new Error("No signed-up user to open the documents pages.")
  const link = await admin.auth.admin.generateLink({ type: "magiclink", email: user.email })
  const token = link.data.properties?.hashed_token
  if (!token) throw new Error("Could not open a session.")
  const anon = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } })
  const verified = await anon.auth.verifyOtp({ token_hash: token, type: "magiclink" })
  if (!verified.data.session) throw new Error("Could not open a session.")
  const cookies = sessionCookies(url, verified.data.session)
  await page.setCookie(
    ...cookies.map((cookie) => ({
      ...cookie,
      url: base,
      path: "/",
      httpOnly: false,
      secure: false,
      sameSite: "Lax" as const,
    })),
  )
  await page.goto(`${base}/documents/work-orders/new`, { waitUntil: "load", timeout: 60000 })
  const landed = new URL(page.url()).pathname
  if (landed === "/login" || landed.startsWith("/login")) throw new Error("Sign-in did not open the documents pages.")
}

async function firstLink(page: import("puppeteer-core").Page, listPath: string, prefix: string) {
  await page.goto(`${base}${listPath}`, { waitUntil: "load", timeout: 60000 })
  await new Promise((resolve) => setTimeout(resolve, 600))
  const href = await page.evaluate(`(() => {
    const prefix = ${JSON.stringify(prefix)}
    const link = Array.from(document.querySelectorAll("a")).find((item) => {
      const value = item.getAttribute("href") || ""
      return value.startsWith(prefix) && value.length > prefix.length && !value.endsWith("/new")
    })
    return link ? link.getAttribute("href") : ""
  })()`)
  return typeof href === "string" ? href : ""
}

async function discoverPaths(page: import("puppeteer-core").Page) {
  const notes: string[] = []
  const paths: string[] = []
  const invoice = await firstLink(page, "/documents/invoices", "/documents/invoices/")
  const receipt = await firstLink(page, "/documents/receipts", "/documents/receipts/")
  const purchaseOrder = await firstLink(page, "/documents/purchase-orders", "/documents/purchase-orders/")
  const project = await firstLink(page, "/projects", "/projects/")
  const order = await firstLink(page, "/purchase-orders", "/purchase-orders/")
  const payroll = await firstLink(page, "/hr/payroll", "/hr/payroll/")
  if (invoice) paths.push(invoice)
  if (receipt) paths.push(receipt)
  if (purchaseOrder) paths.push(purchaseOrder)
  const projectId = project.split("/").pop()
  const orderId = order.split("/").pop()
  if (orderId) paths.push(`/documents/challans/new?po=${orderId}`)
  else if (projectId) paths.push(`/documents/challans/new?project=${projectId}`)
  if (projectId) paths.push(`/documents/certificates/new?project=${projectId}`)
  if (projectId) paths.push(`/documents/letters/new?project=${projectId}`)
  await page.goto(`${base}/accounts/expenses`, { waitUntil: "load", timeout: 60000 })
  await new Promise((resolve) => setTimeout(resolve, 600))
  const expenseVoucher = await page.evaluate(`(() => {
    const link = Array.from(document.querySelectorAll("a")).find((item) => (item.getAttribute("href") || "").includes("/documents/vouchers/new?"))
    return link ? link.getAttribute("href") : ""
  })()`)
  if (typeof expenseVoucher === "string" && expenseVoucher) paths.push(expenseVoucher)
  if (payroll) {
    await page.goto(`${base}${payroll}`, { waitUntil: "load", timeout: 60000 })
    await new Promise((resolve) => setTimeout(resolve, 600))
    const slip = await page.evaluate(`(() => {
      const link = Array.from(document.querySelectorAll("a")).find((item) => (item.getAttribute("href") || "").includes("/documents/salary-slips/new?line="))
      return link ? link.getAttribute("href") : ""
    })()`)
    if (typeof slip === "string" && slip) paths.push(slip)
  }
  notes.push(
    `invoice ${invoice ? "yes" : "no"}, receipt ${receipt ? "yes" : "no"}, po doc ${purchaseOrder ? "yes" : "no"}, project ${projectId ? "yes" : "no"}, order ${orderId ? "yes" : "no"}, payroll ${payroll ? "yes" : "no"}`,
  )
  return { paths, notes }
}

async function main() {
  const css = await loadPrintCss()
  const letterhead = `data:image/png;base64,${(await readFile("public/brand/letterhead-300dpi.png")).toString("base64")}`
  const pdfHtml = renderDocument(certificate, { topMm: 16, bottomMm: 54 }, "letterhead", css, true).html.replaceAll(
    'src="/brand/letterhead-300dpi.png"',
    `src="${letterhead}"`,
  )

  const browser = await puppeteer.launch({
    executablePath: process.env.CHROME_PATH || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  })
  const page = await browser.newPage()
  await page.setViewport({ width: 1440, height: 900 })
  const failures: string[] = []

  try {
    await signIn(page)
  } catch (error) {
    await browser.close()
    const message = error instanceof Error ? error.message : "Sign-in failed."
    console.log(JSON.stringify({ ok: false, error: message }))
    process.exit(1)
  }

  const probe = await page.goto(`${base}/documents/work-orders/new`, { waitUntil: "load", timeout: 60000 })
  const csp = probe?.headers()["content-security-policy"] ?? ""
  const cspOk =
    csp.includes("style-src 'self' 'unsafe-inline'") &&
    csp.includes("font-src 'self' data:") &&
    csp.includes("img-src") &&
    csp.includes("'self'") &&
    !csp.includes(" about:")
  if (!cspOk) failures.push("CSP is missing a preview source or was widened with about:")

  const reference = await browser.newPage()
  await reference.setContent(pdfHtml, { waitUntil: "load" })
  await reference.evaluate("document.fonts.ready")
  const pdf = (await reference.evaluate(sheetMeasure)) as PreviewMetrics

  const linked = await discoverPaths(page)
  const paths = process.env.PREVIEW_PATHS
    ? process.env.PREVIEW_PATHS.split(",").map((path) => path.trim()).filter(Boolean)
    : [
        "/documents/quotations/new",
        "/documents/work-orders/new",
        "/documents/letters/new",
        ...linked.paths,
      ]
  const rows: Array<Record<string, unknown>> = []

  for (const path of paths) {
    const response = await page.goto(`${base}${path}`, { waitUntil: "load", timeout: 60000 })
    const landed = new URL(page.url()).pathname
    if (landed === "/login" || landed === "/no-access") {
      failures.push(`${path} redirected to ${landed}`)
      rows.push({ path, landed, status: response?.status() ?? 0 })
      continue
    }
    try {
      await page.waitForSelector('iframe[title="Document preview"]', { timeout: 45000, visible: false })
    } catch {
      const snippet = await page.evaluate(
        "(() => { const main = document.querySelector('main'); const text = main ? main.innerText : ''; const frames = document.querySelectorAll('iframe').length; return frames + ' iframes | ' + text.slice(0, 500) })()",
      )
      failures.push(`${path} has no preview iframe`)
      rows.push({ path, landed, status: response?.status() ?? 0, snippet })
      continue
    }
    const frame = await page.$('iframe[title="Document preview"]')
    if (!frame) {
      failures.push(`${path} has no preview iframe`)
      rows.push({ path, landed, status: response?.status() ?? 0 })
      continue
    }
    await page.evaluate(
      `(() => { const doc = document.querySelector('iframe[title="Document preview"]').contentDocument; return doc && doc.fonts ? doc.fonts.ready : null })()`,
    )
    await new Promise((resolve) => setTimeout(resolve, 400))
    let live = (await page.evaluate(liveMeasure)) as PreviewMetrics
    for (let attempt = 0; attempt < 8 && live.titleLines !== 1; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 250))
      live = (await page.evaluate(liveMeasure)) as PreviewMetrics
    }
    const styled =
      live.ok === true &&
      String(live.font).includes("Inter") &&
      !String(live.font).includes("Times") &&
      live.foot === pdf.foot &&
      live.head === pdf.head &&
      live.img === pdf.img &&
      live.img > 1000 &&
      live.titleColor === pdf.titleColor &&
      live.css === "/documents/setc.css" &&
      Number(live.rules) > 10 &&
      live.src === "srcdoc" &&
      (live.titleText?.length ?? 0) > 0 &&
      (live.titleSize === "22.6667px" || live.titleSize === "17.3333px") &&
      pdf.titleLines === 1 &&
      pdf.refLines === 1
    const draftOk = path.includes("/new") ? live.draft === true : true
    if (!styled || !draftOk) failures.push(`${path} preview does not match the PDF render`)
    rows.push({ path, landed, styled, draftOk, live, pdfFoot: pdf.foot, pdfFont: pdf.font, pdfImg: pdf.img })
  }

  await browser.close()
  console.log(JSON.stringify({ ok: failures.length === 0, cspOk, sources: linked.notes, pdf, failures, rows }, null, 2))
  if (failures.length) process.exit(1)
}

main()
