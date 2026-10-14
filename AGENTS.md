<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Atrium design system

All UI follows the client-approved Atrium design. Before touching UI, read `docs/atrium-style-guide.md` and the binding rules in `.cursor/rules/ui.mdc` and `.cursor/rules/form-dialog.mdc`. The mockups (desktop `dNN`, mobile `mNN`, dark and light) are in `docs/atrium/mockups/`. Follow `.cursor/rules/efficiency.mdc` for reuse, scope, and the verification budget.

- **Atrium tokens only.** Colors, type, radii, shadows, and glass come from `src/app/globals.css` through Tailwind utilities. Never hardcode a color, add `dark:` overrides, or change token values for one screen. The old teal theme is gone; do not bring back teal or palette classes.
- **Shared components only.** Build with `PageHeader`, `Card`, `Money`, `StatusBadge`, `DataList` (with `mobileItem`), `FieldGroup layout="inset"`, `Dialog`, `DeleteConfirmDialog`, `Tabs`, `Empty`, `Skeleton`, and the `src/components/ui` primitives. No custom one-off styles, inline visual styles, or lookalike primitives.
- **Copy a reference page.** Login (`src/app/login`), Dashboard (`src/app/(app)/dashboard`), and Clients (`src/app/(app)/clients`, list and form) are the converted references. Match the page's mockup at phone and desktop sizes, in both themes.
- **Real icons, never dots.** Navigation, tiles, and empty states use `lucide-react` icons.
- **Calm, uncluttered layouts.** One primary action per view, generous spacing, and hairlines instead of nested boxes.
- **Mobile-native patterns.** Mobile-first classes with the shell switching at `md:`, grouped list cards, bottom sheets, 44px touch targets, 16px inputs with the right `inputMode` and `autoComplete`, safe areas, and reduced-motion support.
- Don't change business logic, server actions, or the database while restyling. Keep the nonce CSP working (no inline scripts).
- Before finishing, run `npm run lint`, `npx tsc --noEmit`, and `npm run build`, and compare screenshots at 390, 430, 768, 1440, and 1920 wide, in dark and light, against the mockups.
