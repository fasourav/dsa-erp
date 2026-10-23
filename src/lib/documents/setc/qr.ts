import QRCode from "qrcode"

/** Inline SVG QR. Empty when there is no real verification URL yet. */
export function qrSvg(url: string | null): string {
  if (!url) return ""
  const qr = QRCode.create(url, { errorCorrectionLevel: "M" })
  const size = qr.modules.size
  let path = ""
  for (let y = 0; y < size; y += 1) {
    let x = 0
    while (x < size) {
      if (!qr.modules.get(x, y)) {
        x += 1
        continue
      }
      let width = 1
      while (x + width < size && qr.modules.get(x + width, y)) width += 1
      path += `M${x} ${y + 0.5}h${width}`
      x += width
    }
  }
  return `<svg viewBox="0 0 ${size} ${size}" class="segno"><path fill="none" stroke="#2a2f28" stroke-width="1" d="${path}"/></svg>`
}
