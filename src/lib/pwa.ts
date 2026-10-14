import type { Theme } from "@/lib/theme"

export const APP_NAME = "DSA ERP"
export const APP_DESCRIPTION = "Internal ERP for DynamicSpace Architects & Engineers."

// Portrait launch screens for iOS home-screen installs. Each entry is the
// device size in CSS pixels and its pixel ratio; the PNGs live in
// public/splash/ and are named <theme>-<width>x<height>.jpg in device pixels.
const splashDevices = [
  { width: 375, height: 667, ratio: 2 },
  { width: 375, height: 812, ratio: 3 },
  { width: 390, height: 844, ratio: 3 },
  { width: 393, height: 852, ratio: 3 },
  { width: 402, height: 874, ratio: 3 },
  { width: 414, height: 896, ratio: 2 },
  { width: 428, height: 926, ratio: 3 },
  { width: 430, height: 932, ratio: 3 },
  { width: 440, height: 956, ratio: 3 },
  { width: 820, height: 1180, ratio: 2 },
  { width: 1024, height: 1366, ratio: 2 },
] as const

export function splashFileName(theme: Theme, device: (typeof splashDevices)[number]) {
  return `${theme}-${device.width * device.ratio}x${device.height * device.ratio}.jpg`
}

export function startupImages() {
  return (["light", "dark"] as const).flatMap((theme) =>
    splashDevices.map((device) => ({
      url: `/splash/${splashFileName(theme, device)}`,
      media: `(prefers-color-scheme: ${theme}) and (device-width: ${device.width}px) and (device-height: ${device.height}px) and (-webkit-device-pixel-ratio: ${device.ratio}) and (orientation: portrait)`,
    })),
  )
}

export { splashDevices }
