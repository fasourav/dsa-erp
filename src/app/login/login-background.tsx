"use client"

import { Component, useEffect, useState, type ComponentType, type ReactNode } from "react"

// Registry emerald clashes with the olive mark, so the swirl stays in the brand olive.
const orbColors = ["#45632d", "#8fad55", "#10180c"]

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

export function LoginBackground() {
  const [Orb, setOrb] = useState<ComponentType<OrbProps> | null>(null)

  useEffect(() => {
    let cancelled = false
    // Import after mount. next/dynamic({ ssr: false }) bails out of SSR and
    // Next's dev overlay treats that bailout as an issue, so the canvas never stays up.
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

  if (!Orb) return null

  return (
    <OrbBoundary>
      <div className="h-full w-full">
        {/* Orb pauses motion, intro, and click pulse when prefers-reduced-motion is set. */}
        <Orb
          colors={orbColors}
          hue={354}
          backgroundColor="#10180c"
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
