export const THEME_COOKIE = "theme"

export type Theme = "light" | "dark"

/** What the user picked. "system" follows prefers-color-scheme; light stays the default. */
export type ThemePreference = Theme | "system"

// The browser chrome, the manifest, and the splash screens cannot read CSS
// variables. These mirror --background in src/app/globals.css; change both together.
export const themeColors: Record<Theme, string> = {
  light: "#f2f3ee",
  dark: "#0b0c0a",
}

// The server cannot see prefers-color-scheme, so "system" renders light and the
// head script in the root layout switches it to dark before paint when needed.
export function parseTheme(value: string | undefined): Theme {
  return value === "dark" ? "dark" : "light"
}

export function parseThemePreference(value: string | undefined): ThemePreference {
  return value === "dark" || value === "system" ? value : "light"
}

export function themeCookie(theme: ThemePreference): string {
  return `${THEME_COOKIE}=${theme}; Path=/; Max-Age=31536000; SameSite=Lax`
}

// Runs in <head> before paint: resolves "system", follows OS changes, and
// activates the standalone PWA launch splash before first paint so the
// underlying login or dashboard screen never flashes.
export const systemThemeScript = `(function(){var d=document.documentElement,m=window.matchMedia("(prefers-color-scheme: dark)"),c=${JSON.stringify(themeColors)};function a(){if(d.dataset.themePreference!=="system")return;var t=m.matches?"dark":"light";d.classList.toggle("dark",t==="dark");d.style.colorScheme=t;document.querySelectorAll('meta[name="theme-color"]').forEach(function(e){e.setAttribute("content",c[t])})}a();m.addEventListener("change",a);try{if(!sessionStorage.getItem("dsa-pwa-splash-shown")&&(window.matchMedia("(display-mode: standalone)").matches||navigator.standalone)){d.dataset.pwaSplash="active"}}catch(e){}})()`
