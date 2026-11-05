import { mkdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import * as chromeLauncher from "chrome-launcher"
import lighthouse from "lighthouse"

const [, , url, label] = process.argv

if (!url || !label) {
  console.error("Usage: node scripts/perf-lighthouse.mjs <url> <label>")
  process.exit(1)
}

const outDir = join(process.cwd(), "perf")
mkdirSync(outDir, { recursive: true })

const extraHeaders = process.env.PERF_COOKIE
  ? { Cookie: process.env.PERF_COOKIE }
  : undefined

const formFactors = [
  {
    formFactor: "mobile",
    screenEmulation: {
      mobile: true,
      width: 412,
      height: 823,
      deviceScaleFactor: 1.75,
      disabled: false,
    },
  },
  {
    formFactor: "desktop",
    screenEmulation: {
      mobile: false,
      width: 1350,
      height: 940,
      deviceScaleFactor: 1,
      disabled: false,
    },
  },
]

const chrome = await chromeLauncher.launch({
  chromePath: process.env.CHROME_PATH || undefined,
  chromeFlags: ["--headless=new", "--no-sandbox", "--disable-gpu"],
})

try {
  for (const { formFactor, screenEmulation } of formFactors) {
    const runnerResult = await lighthouse(
      url,
      {
        port: chrome.port,
        logLevel: "error",
        output: "json",
      },
      {
        extends: "lighthouse:default",
        settings: {
          onlyCategories: ["performance"],
          formFactor,
          screenEmulation,
          throttlingMethod: "simulate",
          ...(extraHeaders ? { extraHeaders } : {}),
        },
      },
    )

    const lhr = runnerResult?.lhr
    if (!lhr) {
      throw new Error(`Lighthouse returned no report for ${formFactor}`)
    }

    const summary = {
      url,
      formFactor,
      performance: Math.round((lhr.categories.performance?.score ?? 0) * 100),
      lcp: Math.round(lhr.audits["largest-contentful-paint"]?.numericValue ?? 0),
      fcp: Math.round(lhr.audits["first-contentful-paint"]?.numericValue ?? 0),
      tbt: Math.round(lhr.audits["total-blocking-time"]?.numericValue ?? 0),
      cls: Number((lhr.audits["cumulative-layout-shift"]?.numericValue ?? 0).toFixed(4)),
      ttfb: Math.round(lhr.audits["server-response-time"]?.numericValue ?? 0),
      si: Math.round(lhr.audits["speed-index"]?.numericValue ?? 0),
    }

    const outPath = join(outDir, `${label}-${formFactor}.json`)
    writeFileSync(outPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8")
    console.log(`${formFactor}: wrote ${outPath}`, summary)
  }
} finally {
  await chrome.kill()
}
