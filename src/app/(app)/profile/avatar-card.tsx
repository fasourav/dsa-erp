"use client"

import { useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"

import { AvatarCropper } from "@/app/(app)/profile/avatar-cropper"
import { removeAvatar, uploadAvatar } from "@/app/(app)/profile/media-actions"
import { UserAvatar } from "@/components/user-avatar"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { savedToast } from "@/lib/saved"

const RAW_LIMIT = 10 * 1024 * 1024
const allowed = new Set(["image/png", "image/webp", "image/jpeg"])

export function AvatarCard({
  name,
  email,
  avatarUrl,
}: {
  name: string
  email: string
  avatarUrl: string | null
}) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [image, setImage] = useState<HTMLImageElement | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()

  function pick(file: File | undefined) {
    if (!file) return
    if (file.size > RAW_LIMIT) {
      setError("Use an image under 10 MB.")
      return
    }
    if (file.type && !allowed.has(file.type)) {
      setError("Use a PNG, WebP, or JPEG image.")
      return
    }
    const next = new Image()
    const url = URL.createObjectURL(file)
    next.onload = () => {
      URL.revokeObjectURL(url)
      setError(null)
      setImage(next)
    }
    next.onerror = () => {
      URL.revokeObjectURL(url)
      setError("Could not read that image.")
    }
    next.src = url
  }

  function save(blob: Blob) {
    const formData = new FormData()
    formData.set("file", new File([blob], "circle.webp", { type: "image/webp" }))
    start(async () => {
      const result = await uploadAvatar(formData)
      if (result.error) {
        setError(result.error)
        return
      }
      setImage(null)
      setError(null)
      savedToast("Photo Saved")
      router.refresh()
    })
  }

  function remove() {
    start(async () => {
      const result = await removeAvatar()
      if (result.error) {
        setError(result.error)
        return
      }
      setError(null)
      savedToast("Photo Removed")
      router.refresh()
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profile Photo</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex items-center gap-4">
          <UserAvatar name={name} email={email} avatarUrl={avatarUrl} className="size-16 text-base" />
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" disabled={pending} onClick={() => inputRef.current?.click()}>
              {avatarUrl ? "Replace" : "Upload"}
            </Button>
            {avatarUrl ? (
              <Button type="button" variant="ghost" disabled={pending} onClick={remove}>
                Remove
              </Button>
            ) : null}
          </div>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/webp,image/jpeg"
          className="hidden"
          onChange={(event) => {
            pick(event.target.files?.[0])
            event.target.value = ""
          }}
        />
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
      </CardContent>
      <Dialog
        open={image !== null}
        onOpenChange={(open) => {
          if (!open && !pending) setImage(null)
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Crop Photo</DialogTitle>
          </DialogHeader>
          {image ? (
            <AvatarCropper image={image} pending={pending} onCancel={() => setImage(null)} onConfirm={save} />
          ) : null}
        </DialogContent>
      </Dialog>
    </Card>
  )
}
