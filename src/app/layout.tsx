import type { Metadata, Viewport } from "next"
import { Inter, Noto_Sans_Bengali } from "next/font/google"
import localFont from "next/font/local"
import { cookies, headers } from "next/headers"

import { PwaSplash } from "@/components/pwa-splash"
import { ServiceWorker } from "@/components/service-worker"
import { Toaster } from "@/components/ui/sonner"
import { APP_DESCRIPTION, APP_NAME, startupImages } from "@/lib/pwa"
import { parseTheme, parseThemePreference, systemThemeScript, THEME_COOKIE, themeColors } from "@/lib/theme"
import { cn } from "@/lib/utils"

import "./globals.css"

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  axes: ["opsz"],
})

// U+09F3 only: the taka sign renders in Noto Sans Bengali, everything else in Inter.
const taka = localFont({
  src: "./fonts/taka.woff2",
  variable: "--font-taka",
  weight: "100 900",
  display: "swap",
  adjustFontFallback: false,
  fallback: [],
  declarations: [{ prop: "unicode-range", value: "U+09F3" }],
})

const bengali = Noto_Sans_Bengali({
  variable: "--font-bengali",
  subsets: ["bengali"],
  preload: false,
})

async function currentTheme() {
  const cookieStore = await cookies()
  return parseTheme(cookieStore.get(THEME_COOKIE)?.value)
}

async function currentThemePreference() {
  const cookieStore = await cookies()
  return parseThemePreference(cookieStore.get(THEME_COOKIE)?.value)
}

export async function generateMetadata(): Promise<Metadata> {
  const theme = await currentTheme()
  return {
    title: {
      default: APP_NAME,
      template: `%s · ${APP_NAME}`,
    },
    description: APP_DESCRIPTION,
    applicationName: APP_NAME,
    appleWebApp: {
      capable: true,
      title: APP_NAME,
      statusBarStyle: theme === "dark" ? "black" : "default",
      startupImage: startupImages(),
    },
    formatDetection: { telephone: false },
  }
}

export async function generateViewport(): Promise<Viewport> {
  const theme = await currentTheme()
  return {
    width: "device-width",
    initialScale: 1,
    viewportFit: "cover",
    themeColor: themeColors[theme],
    colorScheme: theme,
  }
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const theme = await currentTheme()
  const nonce = (await headers()).get("x-nonce") ?? undefined
  const preference = await currentThemePreference()

  return (
    <html
      lang="en"
      data-theme-preference={preference}
      // The head script may add "dark" for the System preference before hydration.
      suppressHydrationWarning
      className={cn(
        inter.variable,
        taka.variable,
        bengali.variable,
        "h-full",
        theme === "dark" && "dark",
      )}
    >
      <head>
        <script nonce={nonce} dangerouslySetInnerHTML={{ __html: systemThemeScript }} />
      </head>
      <body className="flex min-h-full flex-col">
        <PwaSplash />
        {children}
        <Toaster />
        <ServiceWorker />
      </body>
    </html>
  )
}
