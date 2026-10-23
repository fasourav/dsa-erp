import { readFile } from "node:fs/promises"
import puppeteer from "puppeteer-core"
import { loadPrintCss } from "../src/lib/documents/setc/pdf"
import { renderDocument } from "../src/lib/documents/setc/render"
import type { DocumentModel } from "../src/lib/documents/setc/types"

const model: DocumentModel = {
  kind: "challan",
  doc: {
    documentNo: "DC/DSAE/MDL-HGA/07032026",
    issuedOn: "07 March 2026",
    verifyUrl: null,
    deliverToName: "Meghna Digital Ltd.",
    deliverToDetail: "Gulshan-1, Dhaka",
    facts: [
      { label: "Project Name", value: "Navana Tower" },
      { label: "Driver Name", value: "Md. Sohel Rana" },
    ],
    lines: [{ item: "Door Lock", specification: "", unit: "Nos", ordered: "8", delivered: "8", remarks: "" }],
    packages: "",
    declaration: "Received in good order.",
    note: "",
    signatures: [{ label: "Prepared By", name: "Md. Rakib Hossain", detail: "Store" }],
  },
}

async function main() {
  const css = await loadPrintCss()
  const letterhead = `data:image/png;base64,${(await readFile("public/brand/letterhead-300dpi.png")).toString("base64")}`
  const html = renderDocument(model, { topMm: 32, bottomMm: 28 }, "letterhead", css).html.replaceAll(
    'src="/brand/letterhead-300dpi.png"',
    `src="${letterhead}"`,
  )
  const browser = await puppeteer.launch({
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    headless: true,
    args: ["--no-sandbox"],
  })
  const page = await browser.newPage()
  await page.setViewport({ width: 375, height: 812, deviceScaleFactor: 2 })
  await page.setContent(
    `<!DOCTYPE html><html class="dark"><body style="margin:0;background:#141414;width:375px"><div id="frame" style="width:343px;margin:16px;overflow:hidden"></div></body></html>`,
    { waitUntil: "load" },
  )
  await page.evaluate((doc) => {
    const frame = document.getElementById("frame")
    const iframe = document.createElement("iframe")
    iframe.style.cssText = "width:794px;height:1123px;border:0;transform-origin:top left;transform:scale(0.432)"
    iframe.srcdoc = doc
    frame?.appendChild(iframe)
    if (frame) frame.style.height = `${Math.round(1123 * 0.432)}px`
  }, html)
  await new Promise((resolve) => setTimeout(resolve, 500))
  const result = await page.evaluate(() => {
    const frame = document.getElementById("frame")
    const iframe = frame?.querySelector("iframe")
    const paper = iframe?.getBoundingClientRect()
    const frameBox = frame?.getBoundingClientRect()
    const doc = iframe?.contentDocument
    return {
      shell: getComputedStyle(document.body).backgroundColor,
      page: doc ? getComputedStyle(doc.querySelector(".page") ?? doc.body).backgroundColor : "",
      paperWidth: Math.round(paper?.width ?? 0),
      frameWidth: Math.round(frameBox?.width ?? 0),
      spills: paper && frameBox ? paper.right > frameBox.right + 2 : true,
    }
  })
  console.log(JSON.stringify(result))
  await browser.close()
}

main()
