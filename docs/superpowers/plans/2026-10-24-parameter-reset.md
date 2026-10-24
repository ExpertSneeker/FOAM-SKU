# Individual parameter resets

Add a small, always-visible reset icon beside each editable parameter. Its accessible name identifies the parameter and its tooltip says 恢复默认. Reuse current built-in defaults; reset one field without changing other fields, module identities, or module order. Module and sheet dimension resets use physical centimeters while retaining the current display unit; unit resets change presentation only. Composite size presets reset their grouped dimensions/count, and the resolution preset resets both dimensions. Width and height also each have an individual reset.

Cover shape, stack alignment, every module field and preset, all sheet/roll fields, materials, camera, scene toggles/colors/lights/shadows, export format/dimensions/quality. Keep resets for background and shadow properties available when their editing controls are inactive, so stored values can still be reset. Export-time fieldsets disable reset buttons too. Continue using normalizeConfig for dependent geometry and transparent-PNG constraints.

Use shared ResetButton and ParameterLabel components, and add defaultValue support to RangeControl, Switch, and ColorControl. Keep buttons outside labels to prevent accidental checkbox toggles. Retain the overall reset button and existing JSON/storage schema. Browser plugin is absent; validate using existing Edge/Playwright tooling.

- [x] Write failing browser tests for isolated resets, modules and units, all global fields, sheet limits, export fields, persistence, export-time disabling, and narrow layout.
- [x] Implement shared controls and connect every editable parameter to its existing default.
- [x] Run Node tests, build, and full browser suite; inspect desktop/mobile screenshots outside the repo.
- [x] Review the final change and update usage documentation.

Validation: 37 Node tests and all 18 Edge browser tests passed; production build passed. Five new browser flows verify isolated changes against the complete saved configuration, module identity/order, physical-unit conversion, inactive settings, constrained short sheets, typed drafts, keyboard activation, and export-time disabling. Desktop 1440×1000 and mobile 390×844 / 360×800 checked; widened the mobile format column to retain the full PNG label. Screenshots are stored outside the repository in the system temp folder. Independent read-only review found no actionable defects. Existing DevTools-hook and shader-unrolling environment warnings remain; no app console errors occurred in the new scene flow.
