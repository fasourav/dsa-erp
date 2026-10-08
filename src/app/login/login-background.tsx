"use client"

import dynamic from "next/dynamic"
import { Component, type ReactNode } from "react"

const linesGradient = ["#06B6D4", "#3B82F6", "#4547f5"]

const FloatingLines = dynamic(
  () =>
    import("@/components/FloatingLines").catch((error: unknown) => {
      console.error("FloatingLines unavailable", error)
      return { default: function FloatingLinesFallback() {
        return null
      } }
    }),
  { ssr: false, loading: () => null },
)

type BoundaryProps = {
  children: ReactNode
}

type BoundaryState = {
  failed: boolean
}

class FloatingLinesBoundary extends Component<BoundaryProps, BoundaryState> {
  state: BoundaryState = { failed: false }

  static getDerivedStateFromError(): BoundaryState {
    return { failed: true }
  }

  componentDidCatch(error: unknown) {
    console.error("FloatingLines unavailable", error)
  }

  render() {
    if (this.state.failed) return null
    return this.props.children
  }
}

export function LoginBackground({ lightMode }: { lightMode: boolean }) {
  return (
    <FloatingLinesBoundary>
      <div className="h-full w-full">
        <FloatingLines
          linesGradient={linesGradient}
          animationSpeed={1}
          interactive
          bendRadius={5}
          bendStrength={-0.2}
          mouseDamping={0.09}
          parallax
          parallaxStrength={0.2}
          mixBlendMode="normal"
          lightMode={lightMode}
        />
      </div>
    </FloatingLinesBoundary>
  )
}
