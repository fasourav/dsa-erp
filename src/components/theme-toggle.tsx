"use client"

import { Monitor, Moon, Sun } from "lucide-react"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import { themeColors, themeCookie, type Theme, type ThemePreference } from "@/lib/theme"
import { cn } from "@/lib/utils"

const themeLabels: Record<ThemePreference, string> = {
  light: "Light",
  dark: "Dark",
  system: "System",
}

export function themeLabel(preference: ThemePreference): string {
  return themeLabels[preference]
}

export function nextThemePreference(preference: ThemePreference): ThemePreference {
  return preference === "light" ? "dark" : preference === "dark" ? "system" : "light"
}

function resolveTheme(preference: ThemePreference): Theme {
  if (preference !== "system") return preference
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
}

export function applyTheme(preference: ThemePreference) {
  const theme = resolveTheme(preference)
  document.documentElement.dataset.themePreference = preference
  document.documentElement.classList.toggle("dark", theme === "dark")
  document.documentElement.style.colorScheme = theme
  document.cookie = themeCookie(preference)
  document
    .querySelectorAll('meta[name="theme-color"]')
    .forEach((meta) => meta.setAttribute("content", themeColors[theme]))
}

export function currentTheme(): Theme {
  return document.documentElement.classList.contains("dark") ? "dark" : "light"
}

export function currentThemePreference(): ThemePreference {
  const value = document.documentElement.dataset.themePreference
  return value === "dark" || value === "system" ? value : value === "light" ? "light" : currentTheme()
}

export function ThemeIcon({
  preference,
  className,
}: {
  preference: ThemePreference
  className?: string
}) {
  const Icon = preference === "dark" ? Moon : preference === "system" ? Monitor : Sun
  return <Icon aria-hidden="true" className={className} />
}

export function ThemeToggle({
  initialTheme,
  className,
}: {
  initialTheme: ThemePreference
  className?: string
}) {
  const [theme, setTheme] = useState(initialTheme)
  const nextTheme = nextThemePreference(theme)
  const label = `Theme: ${themeLabel(theme)}. Switch to ${themeLabel(nextTheme)}`

  function toggleTheme() {
    applyTheme(nextTheme)
    setTheme(nextTheme)
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      aria-label={label}
      title={label}
      className={cn("md:size-9.5", className)}
      onClick={toggleTheme}
    >
      <ThemeIcon preference={theme} className="size-4.5 md:size-4" />
    </Button>
  )
}
