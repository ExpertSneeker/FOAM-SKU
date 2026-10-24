# Collapsible modules in physical order

Render module cards from top to bottom, reversing only the display list. Keep configuration modules in their existing bottom-to-top order, stable IDs, physical stacking, file compatibility, and move directions. The top card's up action and bottom card's down action remain disabled.

Each module has an independent keyboard-accessible expand/collapse button, initially expanded, with aria-expanded and aria-controls. Keep the dimensional/count summary, layer badge, and up/down/delete actions visible while collapsed. Preserve expansion state by module ID while reordering. New modules are added to the physical top, expanded, and scrolled into view. Expansion changes must not modify saved product parameters or rerender the model.

- [x] Add failing browser tests for physical display order, isolated collapse, move/add/delete behavior, storage/export compatibility, and mobile keyboard access.
- [x] Implement card disclosure, reversed display order, top insertion scrolling, compact styles and documentation.
- [x] Run Node tests, build, full browser tests and independent review. Inspect desktop/mobile screenshots outside the repository and verify service 4173 remains available.

Verification: full 22-test browser regression run passed before the independent review's short-window correction. Review then found that nearest-edge scrolling clips a new card's header at 1100×580; added a regression test and confirmed failure. A header-only nearest-edge attempt exposed fractional clipping, so the final fix aligns the card's top and retains its internal padding. All five module browser tests passed after this fix, including the short-window case; final Node suite passed 38/38 and production build passed. Desktop 1440×1000 and mobile 390×844 / 360×800 screenshots were inspected outside the repository. JSON export/storage order, saved parameters, rendered foam, move directions and module identities remain covered. Production service 4173 returned HTTP 200 after validation.

Final integration verification before GitHub push: `npm run check` passed with 38/38 Node tests, a successful production build, and all 23/23 browser tests on the final implementation.
