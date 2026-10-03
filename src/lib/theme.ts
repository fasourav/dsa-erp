export const THEME_COOKIE = "theme"

export type Theme = "light" | "dark"

export function parseTheme(value: string | undefined): Theme {
  return value === "dark" ? "dark" : "light"
}

export function themeCookie(theme: Theme): string {
  return `${THEME_COOKIE}=${theme}; Path=/; Max-Age=31536000; SameSite=Lax`
}
