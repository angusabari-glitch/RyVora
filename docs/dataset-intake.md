# Approved synthetic dataset v1.2

RyVora uses the approved synthetic RCM dataset v1.2 as an immutable input. The supplied workbook remains at `data/source/approved-synthetic-v1.1/RCM360_Synthetic_RCM_Dataset_v1_2_1000_Claims_QA_Expanded.xlsx`; the folder name is retained because it is the location provided. The manifest identifies the workbook as v1.2 and pins its SHA-256 digest.

## Schema and validation

`data/schema/approved-synthetic-v1.2.json` specifies every worksheet, column order, record count, primary key, typed field, relationship, Claim_Status domain, and aggregate validation target. `pnpm data:validate` verifies the manifest and source hash, loads the workbook without writing to it, and checks schema, row counts, required values, key uniqueness, foreign keys, date serials, numeric/financial values, business relationships, and KPI reconciliation.

Excel date values in this workbook are stored as numeric Excel serials using the General number format. Validation interprets fields declared as dates as Excel serials; the source workbook is not reformatted.

The workbook's `Validation_Summary` sheet is a retained historical v1.1 baseline snapshot, as corroborated by `Expansion_QA` (“Original v1.1 operational records retained unchanged”). Its 12 baseline counts are specified under `embeddedSummaryBaseline` in the v1.2 schema. Nine are lower than the current v1.2 operational worksheet counts: Claims 100→1,000; 837 Transactions 100→1,000; Denials 29→290; AI Recommendations 29→290; Human Reviews 18→180; 835 Payments 52→520; AR Records 100→1,000; Exceptions 18→180; Audit Events 306→3,060. Patients 50, Providers 10, and Payers 6 match both baseline and v1.2 counts. These are historical source metadata and validation expectations, not v1.2 schema values. `pnpm data:validate` checks that the embedded baseline metadata still matches the approved workbook, reconciles each label to its v1.2 sheet, and prints the differences as documented metadata. It fails if a value or label changes unexpectedly; it does not rewrite workbook QA content.

## Staging

`pnpm data:seed` reruns full validation and copies the manifest and workbook byte-for-byte into `.local-data/approved-synthetic-v1.2/`, an ignored local staging directory. It never transforms, overwrites, or uploads the approved source workbook. Re-running the command replaces only that generated staging directory.

Only synthetic, non-PHI data is permitted. Do not generate substitutes, add real patient information, or change source data without approval.
