"use client"

import { Component, useEffect, useState, type ComponentType, type ReactNode } from "react"

type OrbProps = {
  colors?: string[]
  hue?: number
  backgroundColor?: string
  size?: number
  glow?: number
  bleed?: number
  wobble?: number
  highlight?: number
  trail?: number
  tiltX?: number
  tiltY?: number
  speed?: number
  hoverIntensity?: number
  rotateOnHover?: boolean
  forceHoverState?: boolean
  followCursor?: boolean
  clickPulse?: boolean
  intro?: boolean
}

type BoundaryProps = {
  children: ReactNode
}

type BoundaryState = {
  failed: boolean
}

const PAINTS = [
  "var(--primary)",
  "color-mix(in srgb, var(--primary) 62%, var(--on-color))",
  "color-mix(in srgb, var(--primary) 24%, var(--login-button-ink))",
] as const

class OrbBoundary extends Component<BoundaryProps, BoundaryState> {
  state: BoundaryState = { failed: false }

  static getDerivedStateFromError(): BoundaryState {
    return { failed: true }
  }

  componentDidCatch(error: unknown) {
    console.error("Orb unavailable", error)
  }

  render() {
    if (this.state.failed) return null
    return this.props.children
  }
}

function readPaint(paint: string): string {
  const probe = document.createElement("span")
  probe.style.color = paint
  document.body.appendChild(probe)
  const color = getComputedStyle(probe).color
  probe.remove()
  return color
}

function readPalette() {
  return {
    colors: PAINTS.map((paint) => readPaint(paint)),
    backgroundColor: readPaint("var(--login-button-ink)"),
  }
}

export function LoginBackground() {
  const [Orb, setOrb] = useState<ComponentType<OrbProps> | null>(null)
  const [palette, setPalette] = useState<ReturnType<typeof readPalette> | null>(null)

  useEffect(() => {
    let cancelled = false
    void import("@/components/Orb")
      .then((mod) => {
        if (!cancelled) setOrb(() => mod.default as ComponentType<OrbProps>)
      })
      .catch((error: unknown) => {
        console.error("Orb unavailable", error)
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const root = document.documentElement
    const update = () => setPalette(readPalette())
    update()
    const observer = new MutationObserver(update)
    observer.observe(root, { attributes: true, attributeFilter: ["class"] })
    return () => observer.disconnect()
  }, [])

  if (!Orb || !palette) return null

  return (
    <OrbBoundary>
      <div className="h-full w-full">
        <Orb
          colors={palette.colors}
          hue={0}
          backgroundColor={palette.backgroundColor}
          size={0.96}
          glow={1.9}
          bleed={1}
          wobble={1}
          highlight={1.2}
          trail={1}
          tiltX={0}
          tiltY={0}
          speed={1}
          hoverIntensity={1}
          rotateOnHover
          forceHoverState
          followCursor
          clickPulse
          intro
        />
      </div>
    </OrbBoundary>
  )
}
