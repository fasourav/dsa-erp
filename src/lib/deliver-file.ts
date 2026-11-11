// Shared browser file delivery helper for PDF, Excel, and CSV downloads.
// Uses the Web Share API when supported (e.g. iOS Safari / Home Screen app),
// falls back to an open popup or an anchor download, and only navigates on iOS
// when explicitly requested (PDFs only; never navigate to an xlsx blob).

export const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"

export async function deliverFile(
  blob: Blob,
  filename: string,
  options: { popup?: Window | null; navigateOnIos?: boolean } = {},
): Promise<void> {
  const { popup = null, navigateOnIos = false } = options
  const file = new File([blob], filename, { type: blob.type || "application/octet-stream" })
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

  if (navigateOnIos) {
    const ios =
      /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
    if (ios) window.location.assign(url)
  }
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

function closePopup(popup: Window | null) {
  if (!popup || popup.closed) return
  popup.close()
}
