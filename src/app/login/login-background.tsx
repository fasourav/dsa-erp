"use client"

import { Component, useEffect, useState, type ComponentType, type ReactNode } from "react"

type BeamsProps = {
  color?: string
  beamWidth?: number
  rotation?: number
  speed?: number
  glow?: number
  fillLight?: number
  mouseInteraction?: boolean
  lightMode?: boolean
}

type BoundaryProps = {
  children: ReactNode
}

type BoundaryState = {
  failed: boolean
}

class BeamsBoundary extends Component<BoundaryProps, BoundaryState> {
  state: BoundaryState = { failed: false }

  static getDerivedStateFromError(): BoundaryState {
    return { failed: true }
  }

  componentDidCatch(error: unknown) {
    console.error("Beams unavailable", error)
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

function readBeamsTheme() {
  const isDark = document.documentElement.classList.contains("dark")
  return {
    lightMode: !isDark,
    color: readPaint(
      isDark
        ? "color-mix(in srgb, var(--primary) 55%, var(--primary-foreground))"
        : "var(--primary)",
    ),
  }
}

export function LoginBackground() {
  const [Beams, setBeams] = useState<ComponentType<BeamsProps> | null>(null)
  const [theme, setTheme] = useState<ReturnType<typeof readBeamsTheme> | null>(null)

  useEffect(() => {
    let cancelled = false
    void import("@/components/Beams")
      .then((mod) => {
        if (!cancelled) setBeams(() => mod.default as ComponentType<BeamsProps>)
      })
      .catch((error: unknown) => {
        console.error("Beams unavailable", error)
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const root = document.documentElement
    const update = () => setTheme(readBeamsTheme())
    update()
    const observer = new MutationObserver(update)
    observer.observe(root, { attributes: true, attributeFilter: ["class"] })
    return () => observer.disconnect()
  }, [])

  if (!Beams || !theme) return null

  return (
    <BeamsBoundary>
      <div className="h-full w-full">
        <Beams
          color={theme.color}
          beamWidth={140}
          rotation={20}
          speed={1}
          glow={0.85}
          fillLight={0.2}
          mouseInteraction={false}
          lightMode={theme.lightMode}
        />
      </div>
    </BeamsBoundary>
  )
}
