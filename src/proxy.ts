import { type NextRequest } from "next/server"

import { updateSession } from "@/lib/supabase/proxy"

export async function proxy(request: NextRequest) {
  return updateSession(request)
}

export const config = {
  matcher: [
    {
      /*
       * Match all request paths except static assets, cron/vitals endpoints,
       * and Next prefetch requests. Auth checks must not intercept CSS, JS,
       * fonts, images, or the PWA files (service worker, manifest, offline
       * page), which must load before anyone signs in.
       */
      source:
        "/((?!_next/static|_next/image|api/vitals|api/cron|favicon.ico|sw\\.js|manifest\\.webmanifest|offline\\.html|.*\\.(?:svg|png|jpg|jpeg|gif|webp|woff2|ico|ttf|otf|woff|css|js|map|txt|xml|json)$).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
}
