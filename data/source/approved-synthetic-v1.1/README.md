# Approved synthetic dataset v1.2

This source folder retains the location supplied for the approved v1.1 baseline. Its working workbook is the immutable v1.2 expansion: `RCM360_Synthetic_RCM_Dataset_v1_2_1000_Claims_QA_Expanded.xlsx`.

The adjacent `manifest.json` records the approved version and source SHA-256. The workbook is read-only input: validation reads it and `pnpm data:seed` copies it byte-for-byte into the ignored `.local-data/approved-synthetic-v1.2/` staging directory. Do not edit or regenerate the source workbook.

The exact workbook schema and validation targets are documented in `data/schema/approved-synthetic-v1.2.json`. The `Validation_Summary` worksheet contains a historical v1.1 baseline snapshot. Nine baseline counts are lower than v1.2 operational row counts; they are preserved source metadata, explicitly mapped and checked by the schema/validator, and reported as reconciled informational output. They are not the v1.2 counts. The immutable workbook is never rewritten.
