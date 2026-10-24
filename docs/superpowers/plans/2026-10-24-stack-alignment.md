# Stack alignment and shape simplification

**Goal:** Remove the whole-roll option and let mixed-size slab stacks align to edges or corners.

**Design:** Keep the existing React / Three.js architecture and transparent default. Use one `stackAlignment` setting for the whole stack, with nine positions in product coordinates (left/right along X, front/back along Z). Align each module against the maximum length and width of the complete stack; changing order must not change horizontal placement. Default to `center`. Continue using cumulative heights and continuous sidewalls for adjacent equal footprints. Both preview and export use the same scene builder.

**Compatibility:** Keep JSON version 2 and existing storage keys. Missing or invalid alignment becomes `center`. Migrate old `shape: 'roll'` configurations to `shape: 'partial'` with a zero-length tail, retaining sheet dimensions, material, orientation, and independent stack settings. The shape picker contains only stack and partial.

**Alternatives:** A shared nine-position setting keeps one clear control and supports edge/corner alignment. Per-module offsets introduce independent placement beyond this request. Use the shared setting.

**Execution:** Implement inline in the existing checkout, preserving the pending transparent-default changes. Commit and push verified changes according to the user's subsequent workflow instruction recorded in AGENTS.md.

## Tasks

- [x] Add and run failing geometry/configuration tests: nine positions with a 80×60 base and 40×30 upper module, order-independent placement, continuous seams, camera framing, JSON/storage round trips, invalid settings, and old-roll migration.
- [x] Add `STACK_ALIGNMENTS` / `stackAlignment` in `src/config.js`; update `stackPieces(modules, alignment)` and `stackRuns(modules, alignment)` in `src/render/geometry.js`; pass the setting through `src/render/scene.js`.
- [x] Remove the whole-roll UI/render branches. Add an accessible nine-position selector above the module list in `ModuleEditor.jsx`; keep the current visual style and use two shape-picker columns. Update docs and superseded tests.
- [x] Run `npm test`, `npm run build`, and Playwright flows covering alignment changes, persisted/imported settings, a real transparent PNG, shape switching, and mobile layout. Browser plugin is unavailable in this session, so use the repository Playwright workflow with Edge.
- [x] Review the diff for compatibility, coordinate directions, geometry cache invalidation, and preserved transparent defaults.

Validation: 37/37 Node tests, production build, and 13/13 Edge browser tests passed. Checked desktop 1440×1000 and mobile 390×844, actual transparent PNG changes, configuration import/reload/reset, and two remaining shape options. Independent read-only review found no actionable defects and additionally compared 18 legacy-roll geometry cases against HEAD without differences. Existing environment warnings concern a React DevTools hook and shader-loop unrolling; no app console errors occurred in the new desktop flow.
