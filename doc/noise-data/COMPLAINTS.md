# Noise data: reported problems

Read `DESIGN.md` ("How to take feedback") first. Each entry records what was reported, the implementation detail that caused it, the fix, and the regression test. Principles stay unless Mangle explicitly changes one.

| Date | Reported (Mangle's words) | Real cause (detail, or mechanisms in conflict) | Fix (commit) | Regression test |
|---|---|---|---|---|
| 20 Nov 2026 | "zoom and tile misalignment; I want 100% exact" | Mercator pixel lattice vs BNG 10 m cells (11.9 m, 1.49° rotation) in pre-baked tiles: a pixel shows the cell under its own centre, so band edges shift at every zoom | WebGL layer from the raw grid (9729a93, 0176a68, 8dd3211): each pixel looks up the 10 m cell under its own lat/lng; baked Mercator tiles removed | test A + test B (`lib/map/noise-grid-gl-math.test.mjs`) + gl gate (`app/dev/noise-gl-gate`, `scripts/noise-gl-gate.mjs`) |
