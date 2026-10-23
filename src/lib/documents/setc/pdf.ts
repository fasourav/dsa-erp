import { readFile } from "node:fs/promises"
import path from "node:path"

import { PDFDocument } from "pdf-lib"

import type { PrintMargins } from "@/lib/documents/drafts"
import { renderDocument, type DocumentMode } from "@/lib/documents/setc/render"
import type { DocumentModel } from "@/lib/documents/setc/types"

let cssPromise: Promise<string> | null = null
let letterheadPromise: Promise<Uint8Array> | null = null

const printCssPath = path.join(process.cwd(), "public/documents/setc.css")
const fontDir = path.join(process.cwd(), "public/documents/fonts")
const letterheadPath = path.join(process.cwd(), "public/brand/letterhead-300dpi.png")

export async function loadPrintCss(): Promise<string> {
  cssPromise ??= (async () => {
    const css = await readFile(printCssPath, "utf8")
    const fonts = [
      ["/documents/fonts/Poppins-Regular.ttf", "Poppins-Regular.ttf"],
      ["/documents/fonts/Poppins-Medium.ttf", "Poppins-Medium.ttf"],
      ["/documents/fonts/Poppins-SemiBold.ttf", "Poppins-SemiBold.ttf"],
      ["/documents/fonts/Poppins-Bold.ttf", "Poppins-Bold.ttf"],
      ["/documents/fonts/Inter-400.ttf", "Inter-400.ttf"],
      ["/documents/fonts/Inter-400Italic.ttf", "Inter-400Italic.ttf"],
      ["/documents/fonts/Inter-500.ttf", "Inter-500.ttf"],
      ["/documents/fonts/Inter-600.ttf", "Inter-600.ttf"],
      ["/documents/fonts/Inter-700.ttf", "Inter-700.ttf"],
      ["/documents/fonts/NotoSansBengali-Medium.ttf", "NotoSansBengali-Medium.ttf"],
    ] as const
    let next = css
    for (const [url, file] of fonts) {
      const bytes = await readFile(path.join(fontDir, file))
      next = next.replaceAll(`url(${url})`, `url("data:font/ttf;base64,${bytes.toString("base64")}")`)
    }
    return next
  })()
  return cssPromise
}

async function letterheadPng(): Promise<Uint8Array> {
  letterheadPromise ??= readFile(letterheadPath)
  return letterheadPromise
}

function localChrome(): string {
  const fromEnv = process.env.PUPPETEER_EXECUTABLE_PATH || process.env.CHROME_PATH
  if (fromEnv) return fromEnv
  if (process.platform === "win32") {
    return "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
  }
  if (process.platform === "darwin") {
    return "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
  }
  return "/usr/bin/google-chrome"
}

async function launch() {
  const puppeteer = await import("puppeteer-core")
  const onServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME)
  if (onServerless) {
    const chromium = (await import("@sparticuz/chromium")).default
    return puppeteer.default.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: true,
    })
  }
  return puppeteer.default.launch({
    executablePath: localChrome(),
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  })
}

async function htmlToPdf(html: string, transparent: boolean): Promise<Uint8Array> {
  const browser = await launch()
  try {
    const page = await browser.newPage()
    await page.setContent(html, { waitUntil: "load" })
    await page.evaluate(() => document.fonts.ready)
    const pdf = await page.pdf({
      printBackground: true,
      preferCSSPageSize: true,
      omitBackground: transparent,
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
    })
    return pdf
  } finally {
    await browser.close()
  }
}

/** Puts the original PNG under each page so the letterhead is not recompressed. */
async function underlayLetterhead(content: Uint8Array, png: Uint8Array): Promise<Uint8Array> {
  const source = await PDFDocument.load(content)
  const out = await PDFDocument.create()
  const image = await out.embedPng(png)
  const embedded = await out.embedPdf(source)
  embedded.forEach((form, index) => {
    const size = source.getPage(index).getSize()
    const page = out.addPage([size.width, size.height])
    page.drawImage(image, { x: 0, y: 0, width: size.width, height: size.height })
    page.drawPage(form)
  })
  return out.save()
}

export async function renderDocumentPdf(
  model: DocumentModel,
  margins: PrintMargins,
  letterhead: boolean,
): Promise<Uint8Array> {
  const css = await loadPrintCss()
  const mode: DocumentMode = letterhead ? "letterhead" : "print"
  let { html } = renderDocument(model, margins, mode, css)
  if (letterhead) {
    const png = await letterheadPng()
    const uri = `data:image/png;base64,${Buffer.from(png).toString("base64")}`
    html = html.replaceAll('src="/brand/letterhead-300dpi.png"', `src="${uri}"`)
  }
  const pdf = await htmlToPdf(html, false)
  // Chrome prints this PNG with Flate, which does not soften it. If a runtime
  // ever switches the image to JPEG, put the original PNG back underneath.
  if (letterhead && Buffer.from(pdf).includes("DCTDecode")) {
    return underlayLetterhead(await htmlToPdf(html.replaceAll(/<img class="bg"[^>]*>/g, ""), true), await letterheadPng())
  }
  return pdf
}
