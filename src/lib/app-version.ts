import packageJson from "../../package.json"

// Next only inlines NEXT_PUBLIC_* into client bundles, and
// process.env.npm_package_version is unset outside `npm run`.
export const APP_VERSION = packageJson.version
export const APP_VERSION_LABEL = `v${APP_VERSION}`
