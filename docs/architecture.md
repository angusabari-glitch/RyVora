# RyVora application architecture

RyVora is a simulated portfolio application for US healthcare revenue cycle operations. It uses synthetic, non-PHI data and is not a production healthcare system.

## Runtime and boundaries

- `src/app`: React application composition, navigation state, formatters, design tokens, and global CSS.
- `src/components`: shared shell, navigation, header, KPI/status cards, accessible table/chart foundations, filters, and loading/error/empty states.
- `src/pages`: Executive Dashboard, Claims, Denials, Payments, AR Management, Exceptions, Interoperability, Analytics, Automation, and AI / HITL. These are the ten implemented product modules. Traceability exists only as a validated dataset worksheet and is not a navigable module.
- `src/data`: typed dashboard facts, compact workbook contracts, and adapters that expand the validated Vite projection into source records.
- `src/business`: module-specific record mapping, calculations, selectors, filtering, sorting, and pagination.
- `src/services`: module-level orchestration of dataset adapters and business selectors. These are local data services, not network API clients.
- `scripts/dataset.mjs`: approved workbook manifest/checksum/schema and relationship validation, plus byte-identical local staging.
- `vite.config.ts`: validates the approved workbook and builds virtual projections for the application. Workbook-derived data is included in the local frontend bundle; there is no application API or database.
- `tests`: Vitest unit tests against the approved projection and Testing Library UI tests.

Data flow:

`Approved v1.2 workbook → dataset validation → Vite projection → data adapter → service → business selectors → React page → shared components`

The Claims-oriented projection contains the columns needed by Claims, Denials, Payments, and AR. A separate smaller Dashboard projection supplies dashboard facts and validation targets. The workbook remains immutable. The virtual-module load fails on schema, checksum, relationship, or other blocking validation errors. KPI target mismatches can be surfaced by the Dashboard without replacing calculated values.

Navigation is state-based in `src/app/App.tsx`; it does not currently use URL-backed routing. Module list and detail state is held in each page. Denials, Payments, AR, and Exceptions can navigate to an existing Claim detail using the app callback. Exceptions can also route to existing Payment, Denial, or AR details by identifier.

Interoperability has focused path support for `/interoperability` and `/interoperability/:transactionId`, Analytics at `/analytics`, Automation at `/automation` and `/automation/:workflowId`, and AI / HITL at `/ai-hitl` and `/ai-hitl/:recommendationId`; other modules continue using the existing state-based navigation.

## Executive Dashboard

`src/pages/ExecutiveDashboardPage.tsx` renders the dashboard model loaded by `src/services/executiveDashboardService.ts` and calculated in `src/business/executiveDashboard.ts`.

- Total claims counts `Claims` rows.
- Billed amount sums finite `Claims.Billed_Amount` values.
- Denial rate is the proportion of distinct claims referenced by `Denials`.
- Average AR age is the mean of finite non-negative `AR.AR_Age` values.
- Claim status, denial reason/category, and AR aging distributions are grouped from source data.
- Priority claims and management alerts are selected by deterministic business rules.
- Validation targets are data-quality expectations; the calculated KPI remains visible when a discrepancy occurs.

## Claims

`src/pages/ClaimsPage.tsx` uses `src/services/claimsService.ts` and `src/business/claims.ts` to show the claim work queue and claim detail. Claim records join Claims to Patients, Providers, Payers, 837 transactions, Payments_835, Denials, and AR using their validated identifiers. The approved v1.2 Claims worksheet does not contain procedure or diagnosis code columns, so these are not modeled or shown as claim facts.

## Denials

`src/pages/DenialsPage.tsx` uses `src/services/denialsService.ts` and `src/business/denials.ts`. It joins Denials to Claims, AI_Recommendations, and Human_Reviews. Human-review records provide the review context displayed in denial detail; this is not a general audit log. The dataset’s `Audit_Trail` worksheet is validated but is not currently projected into a user-facing feature.

## Payments / 835

`src/pages/PaymentsPage.tsx` uses `src/services/paymentsService.ts` and `src/business/payments.ts`. Payment rows join to claims and payers. `Payments_835.835_Match_Status` is treated as the source reconciliation result. Billed variance is calculated separately, in cents, against the linked `Claims.Billed_Amount`; it does not override source match status. The approved worksheet does not provide an 835 payload, payment method, trace/check/EFT identifier, or patient-responsibility field.

## AR Management

`src/pages/ARManagementPage.tsx` uses `src/services/arService.ts` and `src/business/ar.ts`. Its only AR source is the approved v1.2 `AR` worksheet (1,000 records), exposed through the Claims-oriented validated workbook projection.

Fields used from `AR`:

- `AR_ID` (primary key), `Claim_ID` (relationship)
- `Original_Balance`, `Current_Balance`, `Adjustment_Amount`
- `AR_Age`, `Aging_Bucket`
- `AR_Status`, `Next_Action`, `Owner`, `Reconciliation_Status`

Claim, payer, payments, denials, and exceptions are joined by `Claim_ID` through the approved source relationships. The AR worksheet has no direct payer, payment, denial, exception, or audit identifiers. Exception context is displayed only for exception rows sharing the linked claim ID. There is no AR follow-up history or write workflow.

### AR calculations and rules

- **AR Records:** number of AR worksheet records.
- **Outstanding AR:** sum of finite `Current_Balance` values, with cents rounded at the row level.
- **Average AR Age:** arithmetic mean of finite non-negative `AR_Age` values; the denominator is the number of valid ages.
- **Follow-Up Population:** AR rows with source `AR_Status` Active, source `Next_Action` Follow Up, and positive current balance.
- **Aging distribution:** uses source `Aging_Bucket` values unchanged. A missing bucket is grouped as “Not recorded.” Counts, balances, and percentages use all AR records as the denominator/population.
- **Priority:** deterministic and informational. Only follow-up rows with positive balance are assigned Critical/High/Routine. Critical or High comes from the linked source claim priority; otherwise AR age greater than 60 days is High; remaining follow-up rows are Routine. Each row displays the reason. Other rows are “No follow-up.” This is not AI scoring and does not write back to the dataset.

Known source values include AR status Active/Closed and aging buckets `0-30`, `31-60`, `61-90`, and `90+`. These are presented as source categories, not recalculated date buckets. The approved dataset does not supply follow-up event history, so the page presents current source next action only.

## Exceptions

`src/pages/ExceptionsPage.tsx` uses `src/services/exceptionsService.ts` and `src/business/exceptions.ts`. The service composes the existing Claims, Payments, Denials, and AR services with the validated workbook projection. The page is a read-only exception work queue and detail view; resolving or assigning exceptions is not persisted.

The source is the approved v1.2 `Exceptions` worksheet. The model uses `Exception_ID`, `Claim_ID`, `Exception_Type`, `Severity`, `Description`, `Owner`, `Status`, and `Created_Date`. The inspected source contains 180 exception records, all linked to claims. The workbook defines no exception monetary amount, SLA, or follow-up event history, so the page does not infer or fabricate those values.

- Source `Status` remains visible. For unresolved counts, `Resolved`, `Closed`, `Cancelled`, and `Canceled` are treated as resolved, matching the existing Dashboard exception convention; other non-empty statuses remain unresolved.
- Source `Severity` is displayed as provided; the page does not calculate or reinterpret it.
- The observed exception types map to workstream labels: `837 Rejection` → Interoperability, `835 Unmatched` → Payments, and `High AR Aging` → AR Management. Unknown types map to Unavailable. This labels exception types and does not claim a direct source-module identifier exists.
- Detail links are joined using `Claim_ID`. An `837 Rejection` can show the linked claim’s 837 transaction. An `835 Unmatched` can show matching unmatched 835 payment records for that claim. `High AR Aging` can show linked AR records. Claim-linked denial rows are labeled as context only; the Exceptions worksheet has no denial identifier. Missing linked detail is shown as unavailable.
- KPIs, type distribution, work queue filtering, sorting, and pagination are derived from workbook records in independently testable business functions.

## Interoperability

`src/pages/InteroperabilityPage.tsx` uses `src/services/interoperabilityService.ts` and `src/business/interoperability.ts`. The validated `Claim_Transactions_837` worksheet is the interoperability source; its 1,000 transaction rows are the same records used for KPIs, distributions, filters, pagination, and detail. Source statuses (`Accepted`, `Rejected`) and `Transaction_Type` values are displayed unchanged. The success KPI counts source `Accepted` statuses; failed counts include source `Failed` or `Rejected` statuses, and the rate denominator is all transaction rows.

The 837 source has `Transaction_ID`, `Claim_ID`, `Transaction_Type`, `Submission_Date`, `837_Status`, `Rejection_Code`, `Rejection_Reason`, and `Response_Date`. It does not contain interface names, endpoint system names, direction, owner, created timestamps, message/control identifiers, duration, or retry counts. These remain explicitly Not recorded in the page; no additional interoperability records or routing values are fabricated. Claim and related AR, payment, denial, and exception context are joined through existing module services and the validated `Claim_ID` relationship. Detail is read-only.

## Analytics

`src/pages/AnalyticsPage.tsx` consumes `src/services/analyticsService.ts`, which composes the existing Claims, Denials, Payments, AR, Exceptions, and Interoperability module services. `src/business/analytics.ts` reuses their established summary, status, denial-reason, aging, exception-type, and interoperability-status selectors. It does not add an independent dataset or production integration. Source records are cached in memory for the page session; active payer, claim-status, and service-date filters are applied to Claims and related module rows through validated `Claim_ID` relationships.

The trend groups actual `Claims.Service_Date` values by calendar month; it does not create synthetic timestamps. Payment and 837 event dates are not mixed into that global date range. The payer analysis relates claims, denials, AR, and exceptions through their claim relationship; payment amounts retain the `Payments_835.Payer_ID` source value. Missing payer names remain explicitly unavailable. Cross-module population counts use `Claim_ID` membership and the selected claims as the denominator. Payer and priority-claim detail affordances open a real linked Claims record. Analytics is read-only and remains a simulated synthetic / non-PHI portfolio view, not production payer, EHR, clearinghouse, or live reporting analytics.

## Data and privacy boundary

The Claims-oriented projection includes synthetic `Patient_ID` values and `Insurance_Plan` to support the current Claims experience. These are synthetic identifiers/data, not real patient information. The Dashboard projection does not expose the Patients worksheet. Do not add PHI or fabricate patient information.

`pnpm data:validate` checks manifest metadata, SHA-256, schema, row counts, required values, key uniqueness, relationships, numeric/date types, cross-table consistency, and documented retained historical summary metadata. `pnpm data:seed` validates and copies the workbook byte-for-byte to ignored `.local-data/approved-synthetic-v1.2/`; it does not transform or upload the source file. Vite reads the approved source workbook for projection.

## AI / HITL

`src/pages/AIHITLPage.tsx` consumes `src/services/aiHitlService.ts` and `src/business/aiHitl.ts`. The service composes the existing Denials projection, which joins `AI_Recommendations` to `Denials` and links `Human_Reviews` by `AI_Recommendation_ID`. This adds no parallel data source, external AI integration, write service, database, or persistence.

Source `AI_Status` and linked Human_Reviews status are displayed separately. Under the existing Denials rule, a recommendation is reviewed when it has a linked Human_Reviews row; otherwise it is pending. The source contains 30 rows with `AI_Status` `Reviewed` but no linked review row. These are explicitly surfaced and remain pending under that rule. The source projection includes 290 recommendations and 180 Human_Reviews records; these represent synthetic fixture records, not live activity or model quality measures.

The page provides source-based summary counts, recommendation type/source-status distributions, human-decision distribution, searchable/filterable/sortable/paginated recommendation and pending queues, and `/ai-hitl/:recommendationId` detail with AI recommendation and human decision records kept distinct. Denial and claim links use existing module routes. No decision is inferred and no recommendation is executed. `Audit_Trail` is validated during dataset intake but is not projected at runtime, so record-level audit history is unavailable here. The view remains read-only.

## Current platform gaps

- No database, runtime API, authentication, authorization, or multi-user persistence.
- No URL-backed router or shared server-state/query layer.
- No app-side Audit_Trail viewer or user-action history.
- Follow-up, exception resolution, and AR updates are not persisted; the current AR module is a read-only operational view.
- Services construct local in-memory models from build-time workbook projections.
- Several module services independently assemble the shared ClaimRecord projection from the same approved data in module-scoped memory. This is deterministic for the present 1,000-claim source but duplicates work; a shared request/session model can be considered if data size or live refresh is introduced.

## Quality strategy

Vitest unit tests cover business calculations and workbook-derived models. Testing Library verifies rendered modules and interactions. TypeScript strict mode, Biome, and the Vite production build are the static quality checks.
