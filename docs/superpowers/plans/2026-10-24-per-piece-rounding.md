# Per-piece foam rounding

Round every slab, including its top and bottom rims at internal contacts. Replace merged stack sidewalls and synthetic seam shading with individual rounded slab meshes positioned by stackPieces. Preserve physical outer dimensions, zero vertical spacing, nine-position alignment, materials, camera, transparent defaults, and independent roll geometry. Clamp radius against each individual slab's thickness and short sides. Share geometry and material between identical slab dimensions within a scene, disposing each resource once.

- [x] Write failing tests for individual interior rims, mixed thickness/radius limits, alignment, exact contact heights, and shared-resource disposal.
- [x] Switch scene construction to individual slabs; remove obsolete merged-run geometry and synthetic seam shader.
- [x] Update previous merged-sidewall tests and docs to the new requirement. Verify actual exported pixels change around internal contacts when radius increases; capture the user's large-radius two-piece example.
- [x] Run Node tests, build, browser regressions and independent review; verify the persistent 4173 service remains healthy.

Validation: 38 Node tests, all 18 Edge browser tests, and production build passed. Actual 1024/2000 PNG comparisons cover every interior contact on both visible faces. Captured a two-piece 18.2 mm white-background export and matching UI screenshot outside the repository. Independent review found no actionable defects and separately reran 17 geometry/alignment/module tests. The persistent production service remained available on 127.0.0.1:4173 throughout and serves the updated build.
