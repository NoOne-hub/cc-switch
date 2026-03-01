# Repository Guidelines

## Project Structure & Module Organization
- `src/`: React + TypeScript renderer code (components, hooks, API wrappers, config, i18n).
- `src-tauri/`: Rust backend (Tauri commands, services, platform integration).
- `tests/`: Frontend unit/integration tests (Vitest + Testing Library + MSW).
- `src-tauri/tests/`: Rust integration tests for command/service behavior.
- `assets/`: screenshots, partner logos, static media.
- `docs/`: release notes, architecture/refactor plans, and development references.

Use path aliases from `tsconfig.json` (`@/*` -> `src/*`) instead of deep relative imports.

## Build, Test, and Development Commands
- `pnpm install`: install workspace dependencies.
- `pnpm dev`: run the desktop app in Tauri dev mode (frontend + Rust backend).
- `pnpm dev:renderer`: run only the Vite renderer for UI iteration.
- `pnpm typecheck`: strict TypeScript checks (`noEmit`).
- `pnpm test:unit`: run Vitest test suite once.
- `pnpm test:unit:watch`: run Vitest in watch mode.
- `pnpm build`: produce production desktop bundles via Tauri.
- `cd src-tauri && cargo test`: run Rust integration tests.

## Coding Style & Naming Conventions
- TypeScript/React: Prettier-formatted, 2-space indentation, double quotes, semicolons.
- Rust: standard `rustfmt` style and idiomatic module split by domain.
- Components: `PascalCase` files (`SettingsPage.tsx`); hooks: `useXxx` (`useProviderActions.ts`).
- Tests: mirror source areas; prefer behavior-oriented names (e.g., `ProviderList.test.tsx`).

Run `pnpm format` before opening a PR, and `pnpm format:check` in CI/local validation.

## Testing Guidelines
- Frontend: Vitest in `jsdom` with shared setup in `tests/setupGlobals.ts` and `tests/setupTests.ts`.
- Mock network/back-end boundaries with `tests/msw/*`.
- Keep test files as `*.test.ts`/`*.test.tsx` under matching folders (`tests/components`, `tests/hooks`, `tests/integration`).
- Include regression tests for bug fixes in both UI and Rust command layers when applicable.

## Commit & Pull Request Guidelines
- This source snapshot does not include `.git` metadata, so history-based conventions are unavailable locally.
- Follow Conventional Commits (`feat:`, `fix:`, `refactor:`, `test:`, `docs:`) and keep commits focused.
- PRs should include: concise summary, affected areas, test evidence (commands + results), linked issue, and UI screenshots/GIFs for visual changes.
- For release-impacting changes, update relevant docs in `docs/` and `CHANGELOG.md`.

## Security & Configuration Tips
- Never commit secrets (API keys, signing keys, local config paths).
- Keep environment-specific data in user config files, not repository defaults.
- Validate import/export and migration paths with tests when touching config persistence.
