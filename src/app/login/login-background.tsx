"use client"

import dynamic from "next/dynamic"
import { Component, type ReactNode } from "react"

// Registry emerald clashes with the olive mark, so the swirl stays in the brand olive.
const orbColors = ["#45632d", "#8fad55", "#10180c"]

const Orb = dynamic(
  () =>
    import("@/components/Orb").catch((error: unknown) => {
      console.error("Orb unavailable", error)
      return {
        default: function OrbFallback() {
          return null
        },
      }
    }),
  { ssr: false, loading: () => null },
)

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
  return (
    <OrbBoundary>
      <div className="h-full w-full">
        {/* Orb pauses motion, intro, and click pulse when prefers-reduced-motion is set. */}
        <Orb
          colors={orbColors}
          hue={354}
          backgroundColor="#635d5d"
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
