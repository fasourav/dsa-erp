"use client"

import { Moon, Sun } from "lucide-react"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import { themeCookie, type Theme } from "@/lib/theme"

export function ThemeToggle({ initialTheme }: { initialTheme: Theme }) {
  const [theme, setTheme] = useState(initialTheme)
  const nextTheme: Theme = theme === "dark" ? "light" : "dark"
  const label =
    nextTheme === "dark" ? "Switch to dark theme" : "Switch to light theme"

  function toggleTheme() {
    document.documentElement.classList.toggle("dark", nextTheme === "dark")
    document.cookie = themeCookie(nextTheme)
    setTheme(nextTheme)
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      aria-label={label}
      onClick={toggleTheme}
    >
      {theme === "dark" ? (
        <Sun aria-hidden="true" className="size-4" />
      ) : (
        <Moon aria-hidden="true" className="size-4" />
      )}
    </Button>
  )
}
