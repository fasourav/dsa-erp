"use client"

import { Moon, Sun } from "lucide-react"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import { themeColors, themeCookie, type Theme } from "@/lib/theme"
import { cn } from "@/lib/utils"

export function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle("dark", theme === "dark")
  document.documentElement.style.colorScheme = theme
  document.cookie = themeCookie(theme)
  document
    .querySelectorAll('meta[name="theme-color"]')
    .forEach((meta) => meta.setAttribute("content", themeColors[theme]))
}

export function currentTheme(): Theme {
  return document.documentElement.classList.contains("dark") ? "dark" : "light"
}

export function ThemeToggle({
  initialTheme,
  className,
}: {
  initialTheme: Theme
  className?: string
}) {
  const [theme, setTheme] = useState(initialTheme)
  const nextTheme: Theme = theme === "dark" ? "light" : "dark"
  const label =
    nextTheme === "dark" ? "Switch to dark theme" : "Switch to light theme"

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
      className={cn("md:size-9.5", className)}
      onClick={toggleTheme}
    >
      {theme === "dark" ? (
        <Sun aria-hidden="true" className="size-4.5 md:size-4" />
      ) : (
        <Moon aria-hidden="true" className="size-4.5 md:size-4" />
      )}
    </Button>
  )
}
