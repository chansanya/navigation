# Repository Guidelines

## Project Structure & Module Organization

This is a Vue 3 + Pinia navigation app deployed on Cloudflare Pages with Pages Functions and D1.

- `src/` contains the frontend app: `views/` for pages, `components/` for UI, `stores/` for Pinia state, `styles/` for base variables and themes, and `assets/icons/` for SVG icons.
- `functions/` contains Cloudflare Pages Functions. API routes live under `functions/api/`, with shared D1/session helpers in `functions/db.ts` and `functions/session.ts`.
- `db/schema.sql` defines the base D1 schema; incremental changes belong in `db/migrations/`.
- `scripts/` contains maintenance scripts; SQL snapshots are stored in `scripts/sql/`.
- `public/` stores static assets such as favicon and logo files. `docs/` stores deployment and usage documentation.

## Build, Test, and Development Commands

- `npm run dev` starts the Vite frontend dev server.
- `npm run build` builds the production frontend into `dist/`.
- `npm run pages:dev` runs Cloudflare Pages Functions locally against `dist/`; build first for full Pages behavior.
- `npx vue-tsc --noEmit` runs TypeScript/Vue type checking.
- `npm run export:local-db` exports local SQLite/D1 data to SQL.
- `npm run export:remote-db` exports remote D1 data to `scripts/sql/remote-data.sql`.
- `npm run sync:local-db` and `npm run sync:remote-db` apply prepared SQL snapshots.

## Coding Style & Naming Conventions

Use TypeScript for app and function code. Vue files use `<script setup lang="ts">`. Follow existing two-space indentation, single quotes, and no semicolons. Components use PascalCase filenames, stores use lower-case domain names such as `sites.ts`, and API routes follow Pages conventions such as `[id].ts`.

Keep new scripts separate instead of adding unrelated behavior to existing scripts. This reduces accidental destructive operations.

## Testing Guidelines

There is no dedicated unit test suite yet. For changes, run `npx vue-tsc --noEmit` and `npm run build`. For shell script edits, run `bash -n <script>`. For Cloudflare/D1 behavior, test with `npm run pages:dev` after building.

## Commit & Pull Request Guidelines

Use Conventional Commit prefixes seen in history, for example `feat: add site move action` or `fix: 编辑站点保存被归一化相同的其它记录误拦`. Keep commits focused.

Pull requests should include a concise summary, verification commands run, screenshots for visible UI changes, and notes for D1 schema or migration changes.

## Security & Configuration Tips

Do not commit real secrets. Use `.dev.vars` locally and keep examples in `.dev.vars.example`. Required secrets include `ADMIN_TOKEN`, `PRIVATE_PASSWORD`, and Cloudflare deployment credentials where applicable. Password vault data must remain encrypted client-side; server code should store only salt, IV, and ciphertext.
