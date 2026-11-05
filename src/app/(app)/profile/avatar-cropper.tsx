"use client"

import { useEffect, useRef, useState } from "react"

import { Button } from "@/components/ui/button"

const VIEW = 280
const OUT = 512

function paint(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  size: number,
  zoom: number,
  offset: { x: number; y: number },
) {
  const min = Math.max(VIEW / image.naturalWidth, VIEW / image.naturalHeight)
  const scale = (size / VIEW) * min * zoom
  const width = image.naturalWidth * scale
  const height = image.naturalHeight * scale
  ctx.clearRect(0, 0, size, size)
  ctx.drawImage(image, (size - width) / 2 + offset.x * (size / VIEW), (size - height) / 2 + offset.y * (size / VIEW), width, height)
}

export function AvatarCropper({
  image,
  pending,
  onCancel,
  onConfirm,
}: {
  image: HTMLImageElement
  pending: boolean
  onCancel: () => void
  onConfirm: (blob: Blob) => void
}) {
  const ref = useRef<HTMLCanvasElement>(null)
  const min = Math.max(VIEW / image.naturalWidth, VIEW / image.naturalHeight)
  const [zoom, setZoom] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null)

  const clamp = (point: { x: number; y: number }, scale = min * zoom) => {
    const maxX = Math.max(0, (image.naturalWidth * scale - VIEW) / 2)
    const maxY = Math.max(0, (image.naturalHeight * scale - VIEW) / 2)
    return {
      x: Math.min(maxX, Math.max(-maxX, point.x)),
      y: Math.min(maxY, Math.max(-maxY, point.y)),
    }
  }

  useEffect(() => {
    const ctx = ref.current?.getContext("2d")
    if (ctx) paint(ctx, image, VIEW, zoom, offset)
  }, [image, offset, zoom])

  const confirm = () => {
    const out = document.createElement("canvas")
    out.width = OUT
    out.height = OUT
    const ctx = out.getContext("2d")
    if (!ctx) return
    paint(ctx, image, OUT, zoom, offset)
    out.toBlob((blob) => {
      if (blob) onConfirm(blob)
    }, "image/webp", 0.9)
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative overflow-hidden rounded-md" style={{ width: VIEW, height: VIEW }}>
        <canvas
          ref={ref}
          width={VIEW}
          height={VIEW}
          className="touch-none cursor-grab bg-muted"
          onPointerDown={(event) => {
            event.currentTarget.setPointerCapture(event.pointerId)
            drag.current = { x: event.clientX, y: event.clientY, ox: offset.x, oy: offset.y }
          }}
          onPointerMove={(event) => {
            const current = drag.current
            if (!current) return
            setOffset(
              clamp({
                x: current.ox + event.clientX - current.x,
                y: current.oy + event.clientY - current.y,
              }),
            )
          }}
          onPointerUp={() => {
            drag.current = null
          }}
          onPointerCancel={() => {
            drag.current = null
          }}
        />
        <div aria-hidden className="pointer-events-none absolute inset-0 rounded-full shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]" />
      </div>
      <label className="flex w-full items-center gap-3 text-sm">
        Zoom
        <input
          type="range"
          min={1}
          max={4}
          step={0.01}
          value={zoom}
          className="flex-1"
          onChange={(event) => {
            const next = Number(event.target.value)
            setZoom(next)
            setOffset((current) => clamp(current, min * next))
          }}
        />
      </label>
      <div className="flex w-full justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={pending}>
          Cancel
        </Button>
        <Button type="button" onClick={confirm} disabled={pending}>
          {pending ? "Saving…" : "Save Photo"}
        </Button>
      </div>
    </div>
  )
}
