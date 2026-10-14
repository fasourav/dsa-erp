import type { MetadataRoute } from "next"

import { APP_DESCRIPTION, APP_NAME } from "@/lib/pwa"
import { themeColors } from "@/lib/theme"

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: `${APP_NAME} · DynamicSpace`,
    short_name: APP_NAME,
    description: APP_DESCRIPTION,
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    display_override: ["standalone", "minimal-ui"],
    orientation: "any",
    background_color: themeColors.light,
    theme_color: themeColors.light,
    categories: ["business", "finance", "productivity"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Dashboard", url: "/dashboard", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Clients", url: "/clients", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Projects", url: "/projects", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  }
}
