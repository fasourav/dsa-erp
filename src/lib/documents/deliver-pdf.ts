// Phones never get a file from window.print(). iOS Safari ignores <a download>,
// and the installed Home Screen app blocks popup and blob navigations.
// A real PDF file handed to the share sheet is the path those browsers accept.
// A click-opened tab and an anchor download cover Android Chrome and desktop.

import { deliverFile } from "@/lib/deliver-file"

export async function deliverPdf(
  bytes: Uint8Array,
  filename: string,
  popup: Window | null,
): Promise<void> {
  await deliverFile(pdfBlob(bytes), filename, { popup, navigateOnIos: true })
}

function pdfBlob(bytes: Uint8Array): Blob {
  const buffer = new ArrayBuffer(bytes.byteLength)
  new Uint8Array(buffer).set(bytes)
  return new Blob([buffer], { type: "application/pdf" })
}

export function pdfFilename(documentNo: string, title: string, letterhead: boolean): string {
  const stem = (documentNo || title || "document").replace(/[^\w.-]+/g, "-").replace(/-+/g, "-")
  const suffix = letterhead ? "letterhead" : "print"
  return `${stem.slice(0, 80)}-${suffix}.pdf`
}

export async function readBrandPng(path: string): Promise<Uint8Array | undefined> {
  try {
    const response = await fetch(path)
    if (!response.ok) return undefined
    return new Uint8Array(await response.arrayBuffer())
  } catch {
    return undefined
  }
}
