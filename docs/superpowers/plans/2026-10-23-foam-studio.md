# Foam Studio Implementation Plan

> Execute inline with superpowers:executing-plans; this side conversation prohibits subagents. The user has explicitly authorized implementation, local deployment and GitHub push.

**Goal:** 本地可配置海绵渲染工作台，可导出商品图并保存参数。
**Architecture:** React UI + independent Three.js engine; parameter schema normalizes all imported and persisted data. Rendering uses an on-demand preview and full-resolution export with alpha-preserving soft-shadow accumulation.
**Tech Stack:** React, Vite, Three.js r180, Node test runner, Playwright, Sharp.
**Spec:** `docs/design.md`

## Global Constraints

- Default perspective elevation 22°, focal length 65 mm; preserve rounded aligned slabs.
- Background / alpha / shadow settings must affect downloaded pixels.
- Export 256–4096 px per side; no remote deployment or uploaded product data.
- No subagents; existing initial README and remote main history retained.

## Review Focus

- Invalid imported JSON and non-finite values: reject unsupported schema, sanitize known fields.
- Inch/cm switching: preserve physical size and avoid cumulative rounding.
- Extreme aspect ratios / counts: fit all geometry without clipping.
- Transparent exports: zero-alpha corners, opaque foam and translucent ground shadow.
- Repeated rendering, export cancellation and resizing: dispose GPU resources, avoid stale frames and UI state.

## Task 1 — Validated parameters and geometry

Files: `src/config.js`, `src/render/geometry.js`, `tests/config.test.js`, `tests/geometry.test.js`.

- [x] Write and run tests for unit round trips, invalid imports, limits, exact dimensions and flush centers.
- [x] Implement `normalizeConfig`, `parseConfig`, unit conversions and `createFoamGeometry` / `pieceCenters`.
- [x] Run `npm test` and confirm green.

## Task 2 — Renderer and interactive studio

Files: `src/render/{textures,scene,camera,StudioRenderer}.js`, `src/components/*`, `src/App.jsx`, `src/styles.css`, `tests/studio.spec.js`.

- [x] Add browser assertions for preview, camera settings, export resolution, alpha and controls; observe failure before app implementation.
- [x] Implement the engine, progressive soft shadows and cancellable PNG/JPEG exports; wire reusable React controls and persistence.
- [x] Run browser tests and inspect desktop/mobile screenshots and exported pixels.

## Task 3 — Local delivery and GitHub

Files: `README.md`, `start-local.cmd`, `scripts/local-server.mjs`.

- [x] Build static distribution and run locally at loopback port 4173.
- [x] Document startup, parameter behavior, future static hosting, verified limits.
- [x] Self-review diff, run required checks, commit and push main; verify remote commit.

## Execution notes

- Initial remote commit `4c9c296` contains README only. Local branch tracks origin/main.
- Native local git authentication works for fetch. GitHub connector confirms repository push permission.
- Browser plugin absent; use Playwright with installed Edge for WebGL verification.
- Image Gen is used only for UI concepting; no generated image is shipped as a product render or interactive UI.
- Delivery: production service verified at `http://127.0.0.1:4173/`; feature commit `75e67c5` pushed to `origin/main` and confirmed with `git ls-remote`. Results and self-review are in `docs/verification.md`.
