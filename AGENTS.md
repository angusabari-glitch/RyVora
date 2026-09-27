# RyVora Engineering Rules

- RyVora is a simulated portfolio application. Never present it as production experience or as a production healthcare system.
- Use synthetic, non-PHI data only. Never invent real patient information or introduce real identifiers.
- Treat the existing Power Apps app as a reference baseline only; do not alter or delete it from this repository workflow.
- Keep UI, business calculations, services, and data access separate. Prefer small modules with explicit inputs and outputs.
- Never hard-code business KPI values. Derive them from validated data, and test calculations independently.
- Do not infer or fabricate the approved synthetic dataset v1.2. Validate its manifest, workbook schema, business relationships, and file checksum before staging or consuming it; fail clearly when it is missing or invalid.
- Do not build a business module until the user explicitly approves that feature.
- Every completed feature must include appropriate automated tests. When a test fails, reproduce it, identify the root cause, make the smallest correct fix, and add regression coverage when appropriate.
- Never suppress errors simply to make tests pass. Report unresolved failures and warnings.
- Use TypeScript strict mode, pnpm, Biome, and Vitest. Keep the lockfile committed and use `pnpm install --frozen-lockfile` for reproducible installs.
- Before declaring a change complete, run the relevant tests, type checks, lint, and production build; report the exact commands and outcomes.
