# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

MonitorPro — a React/TypeScript single-page app for uptime/website monitoring (dashboard, inventory, incidents, reports, notifications, settings). This is an AI Studio-generated app; there is no backend — all data is mock/local.

## Commands

- `npm run dev` — start Vite dev server on port 3000
- `npm run build` — production build
- `npm run preview` — preview production build
- `npm run lint` — type-check only (`tsc --noEmit`); there is no separate lint tool configured
- No test suite exists in this repo.

## Architecture

- **Single-page, client-only app with no router.** `src/App.tsx` owns all top-level state (`user`, `websites`, `incidents`, `notifications`, `settings`, `currentView`, `selectedWebsiteId`) and manually switches between views via a `renderView()` switch statement keyed on `ViewType` (`src/types.ts`). Navigation is done by calling `onNavigateToView(view, extraData)` props passed down, not URL changes.
- **Persistence is localStorage-only.** Every piece of state is loaded via `loadData(key, default)` and written back via `saveData(key, value)` (`src/data.ts`) in a `useEffect` per state slice, under keys prefixed `monitorpro_`. There is no real backend/API; `INITIAL_WEBSITES`, `INITIAL_INCIDENTS`, `INITIAL_NOTIFICATIONS`, `INITIAL_WORKSPACE_SETTINGS`, and `DEFAULT_USER` in `src/data.ts` are the seed/mock data used on first load.
- **All mutations are handlers defined in `App.tsx`** (e.g. `handleAddWebsite`, `handleEditWebsite`, `handleDeleteWebsite`, `handleToggleStatus`, `handleAcknowledgeIncident`, `handleResolveIncident`, `handleInjectIncident`, `handleTriggerPingTest`) and passed down as props to view components in `src/components/`. There is no state management library (no Redux/Zustand/Context) — everything is prop drilling from `App.tsx`.
- Login is a fully mocked/local auth flow (`LoginView.tsx`) — any email passes, sets a `UserSession` in state/localStorage; there's no real backend auth.
- `handleInjectIncident` / `handleTriggerPingTest` are "playground" simulation actions (manually crash a site or re-ping it) used to demo incident lifecycle without a real monitoring backend.
- Path alias `@/*` maps to the repo root (see `tsconfig.json` / `vite.config.ts`).
- Styling is Tailwind CSS v4 via `@tailwindcss/vite` plugin (no `tailwind.config.js` — v4 config lives in CSS, see `src/index.css`). Icons from `lucide-react`; animations from `motion`.
- `@google/genai`, `express`, and `dotenv` are present in dependencies but unused by the current UI — likely scaffolding from the AI Studio template rather than active app architecture.
- UI copy/content (incident descriptions, site names, etc.) is in Spanish.
