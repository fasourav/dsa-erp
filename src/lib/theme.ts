export const THEME_COOKIE = "theme"

export type Theme = "light" | "dark"

// The browser chrome, the manifest, and the splash screens cannot read CSS
// variables. These mirror --background in src/app/globals.css; change both together.
export const themeColors: Record<Theme, string> = {
  light: "#f2f3ee",
  dark: "#0b0c0a",
}

export function parseTheme(value: string | undefined): Theme {
  return value === "dark" ? "dark" : "light"
}

export function themeCookie(theme: Theme): string {
  return `${THEME_COOKIE}=${theme}; Path=/; Max-Age=31536000; SameSite=Lax`
}
