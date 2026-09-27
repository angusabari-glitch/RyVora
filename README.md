# RyVora

RyVora is a simulated US Healthcare Revenue Cycle Management (RCM) digital transformation and interoperability portfolio application. It uses synthetic, non-PHI data only and is not a production healthcare system.

Implemented experiences are the Executive Dashboard, Claims, Denials, Payments / 835, read-only AR Management, Exceptions, Interoperability, Analytics, Automation, and AI / HITL. Each consumes approved synthetic RCM dataset v1.2 through local validated projections. Traceability is limited to validated source audit rows: there is no runtime Audit_Trail viewer or production audit service.

## Requirements

- Node.js 24.19.0 (the environment used to establish this foundation)
- pnpm 11.25.0

## Setup and commands

```powershell
pnpm install --frozen-lockfile
pnpm dev
pnpm test
pnpm lint
pnpm typecheck
pnpm build
pnpm data:validate
pnpm data:seed
```

`pnpm dev` starts the local Vite development server. `pnpm build` creates the production bundle in `dist/`.

## Approved synthetic dataset v1.2

The approved workbook remains immutable at `data/source/approved-synthetic-v1.1/RCM360_Synthetic_RCM_Dataset_v1_2_1000_Claims_QA_Expanded.xlsx`. `pnpm data:validate` verifies the manifest, checksum, worksheet schema, relationships, field types, and validation targets. `pnpm data:seed` stages a byte-identical copy in the ignored `.local-data/approved-synthetic-v1.2/` directory. Vite's data plugin validates and projects the approved workbook into Dashboard and Claims-oriented typed modules at dev/build time. The Claims-oriented projection includes synthetic patient identifiers and insurance plan fields for the Claims module; no real patient information is used. See [the dataset intake contract](docs/dataset-intake.md).

The dashboard calculates all displayed figures from workbook rows. Validation targets are stored as data-quality expectations and are not used as KPI values. Any dashboard calculation that differs from those targets is shown as a discrepancy while the calculated value remains visible.

AR Management uses source AR balances, ages, aging buckets, statuses, and next actions. It derives KPI summaries and explainable follow-up priority from the linked claim data. The module is read-only; the dataset has no AR follow-up history. See [the current application architecture](docs/architecture.md) for exact fields, calculations, and limitations.

Automation shows deterministic workflow definitions and eligible source populations only; the workbook does not contain execution records, so it does not report executions, savings, rates, or ROI. AI / HITL shows source recommendations and linked human reviews separately; it does not infer decisions, call an external AI service, or execute actions. Audit_Trail is validated but is not projected into the runtime application. This is a local portfolio prototype, not a production service: it has no authentication, authorization, database, runtime API, live payer connectivity, or persistence. Interoperability records use the validated 837 worksheet; interface, source-system, destination-system, and routing fields are unavailable because the source does not contain them.

## Architecture

See [docs/architecture.md](docs/architecture.md) for the stack and boundaries, and [AGENTS.md](AGENTS.md) for permanent engineering rules.
