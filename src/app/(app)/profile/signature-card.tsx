"use client"

import { useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"

import { removeSignature, uploadSignature } from "@/app/(app)/profile/media-actions"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { savedToast } from "@/lib/saved"

const SIGNATURE_MAX_BYTES = 1024 * 1024
const allowed = new Set(["image/png", "image/webp", "image/jpeg"])

async function toPng(file: File): Promise<Blob> {
  const image = new Image()
  const url = URL.createObjectURL(file)
  image.src = url
  try {
    await image.decode()
  } finally {
    URL.revokeObjectURL(url)
  }
  const scale = Math.min(1, 1200 / image.naturalWidth, 400 / image.naturalHeight)
  const canvas = document.createElement("canvas")
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale))
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale))
  canvas.getContext("2d")?.drawImage(image, 0, 0, canvas.width, canvas.height)
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("encode"))), "image/png")
  })
}

export function SignatureCard({ signatureUrl }: { signatureUrl: string | null }) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()

  async function pick(file: File | undefined) {
    if (!file) return
    if (file.type && !allowed.has(file.type)) {
      setError("Use a PNG, WebP, or JPEG image.")
      return
    }
    setError(null)
    let png: Blob
    try {
      png = await toPng(file)
    } catch {
      setError("Could not read that signature. Try another image.")
      return
    }
    if (png.size > SIGNATURE_MAX_BYTES) {
      setError("Use a smaller signature image (under 1 MB).")
      return
    }
    const formData = new FormData()
    formData.set("file", new File([png], "current.png", { type: "image/png" }))
    start(async () => {
      const result = await uploadSignature(formData)
      if (result.error) {
        setError(result.error)
        return
      }
      savedToast("Signature Saved")
      router.refresh()
    })
  }

  function remove() {
    start(async () => {
      const result = await removeSignature()
      if (result.error) {
        setError(result.error)
        return
      }
      setError(null)
      savedToast("Signature Removed")
      router.refresh()
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Signature</CardTitle>
        <CardDescription>Used when you place your signature on documents. A transparent PNG works best.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex h-24 items-center justify-center rounded-md border bg-white px-3">
          {signatureUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- private signed URL
            <img src={signatureUrl} alt="" className="max-h-20 object-contain" />
          ) : (
            <span className="text-sm text-muted-foreground">No signature yet</span>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" disabled={pending} onClick={() => inputRef.current?.click()}>
            {signatureUrl ? "Replace" : "Upload"}
          </Button>
          {signatureUrl ? (
            <Button type="button" variant="ghost" disabled={pending} onClick={remove}>
              Remove
            </Button>
          ) : null}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/webp,image/jpeg"
          className="hidden"
          onChange={(event) => {
            void pick(event.target.files?.[0])
            event.target.value = ""
          }}
        />
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
      </CardContent>
    </Card>
  )
}
