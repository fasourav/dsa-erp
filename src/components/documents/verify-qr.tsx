import QRCode from "qrcode"

export function VerifyQr({ url }: { url: string | null }) {
  if (!url) {
    return (
      <div className="doc-qr">
        <div className="doc-qr-pending" />
        <p>Save to verify</p>
      </div>
    )
  }

  const code = QRCode.create(url, { errorCorrectionLevel: "M" })
  const size = code.modules.size
  const dark: Array<{ x: number; y: number }> = []
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      if (code.modules.get(x, y)) dark.push({ x, y })
    }
  }

  return (
    <div className="doc-qr">
      <svg viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Scan to verify">
        <rect width={size} height={size} className="fill-card" />
        {dark.map((cell) => (
          <rect
            key={`${cell.x}-${cell.y}`}
            x={cell.x}
            y={cell.y}
            width={1}
            height={1}
            className="fill-foreground"
          />
        ))}
      </svg>
      <p>Scan to verify</p>
    </div>
  )
}
