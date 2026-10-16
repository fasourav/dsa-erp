// Phones never get a file from window.print(). iOS Safari ignores <a download>,
// and the installed Home Screen app blocks popup and blob navigations.
// A real PDF file handed to the share sheet is the path those browsers accept.
// A click-opened tab and an anchor download cover Android Chrome and desktop.

export async function deliverPdf(
  bytes: Uint8Array,
  filename: string,
  popup: Window | null,
): Promise<void> {
  const blob = pdfBlob(bytes)
  const file = new File([blob], filename, { type: "application/pdf" })
  const url = URL.createObjectURL(blob)

  if (typeof navigator.share === "function" && typeof navigator.canShare === "function") {
    try {
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: filename })
        closePopup(popup)
        window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
        return
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        closePopup(popup)
        window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
        return
      }
    }
  }

  if (popup && !popup.closed) {
    popup.location.href = url
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
    return
  }

  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = filename
  anchor.rel = "noopener"
  anchor.target = "_blank"
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()

  const ios =
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  if (ios) window.location.assign(url)
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

function pdfBlob(bytes: Uint8Array): Blob {
  const buffer = new ArrayBuffer(bytes.byteLength)
  new Uint8Array(buffer).set(bytes)
  return new Blob([buffer], { type: "application/pdf" })
}

function closePopup(popup: Window | null) {
  if (!popup || popup.closed) return
  popup.close()
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
