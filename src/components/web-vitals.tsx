"use client"

import { useReportWebVitals } from "next/web-vitals"

const TRACKED_METRICS = new Set(["LCP", "INP", "CLS", "FCP", "TTFB"])

export function WebVitals() {
  useReportWebVitals((metric) => {
    if (!TRACKED_METRICS.has(metric.name)) return

    const payload = {
      name: metric.name,
      value: metric.value,
      rating: metric.rating,
      delta: metric.delta,
      id: metric.id,
      navigationType: metric.navigationType,
      pathname: typeof window !== "undefined" ? window.location.pathname : "",
    }

    if (process.env.NODE_ENV !== "production") {
      console.info("[web-vitals]", payload)
      return
    }

    const body = JSON.stringify(payload)
    if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
      navigator.sendBeacon("/api/vitals", body)
    } else {
      fetch("/api/vitals", {
        method: "POST",
        body,
        headers: { "content-type": "application/json" },
        keepalive: true,
      }).catch(() => {})
    }
  })

  return null
}
