# Data boundary

The approved synthetic healthcare dataset v1.2 is the authoritative input. Vite validates the workbook and projects Dashboard facts and a Claims-oriented set of typed compact worksheet rows. The latter includes synthetic Patient_ID and Insurance_Plan values used by the Claims experience; these are not real patient information. The approved workbook remains immutable.

Dataset schema, checksum verification, historical baseline reconciliation, and deterministic local staging are defined in [dataset-intake.md](../../docs/dataset-intake.md). Never replace a missing bundle with guessed, generated, or production data.
