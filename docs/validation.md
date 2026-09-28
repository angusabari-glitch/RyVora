# Validation Strategy

RyVora validation focuses on whether the implemented application correctly represents the approved synthetic data, RCM relationships, calculations, and workflows.

## Validation areas

### Data validation
Confirm that the application uses the approved synthetic dataset and that required relationships and fields are handled correctly.

### Relationship validation
Check relationships such as:

- Claim → 837
- Claim → Denial
- Claim → Payment/835
- Claim → AR
- Denial → AI Recommendation
- AI Recommendation → Human Review

### KPI reconciliation
Validate that displayed KPIs are derived from the underlying data and match their defined population and transformation logic.

### Regression testing
Confirm that changes to one module do not break existing workflows, calculations, filters, or shared components.

### Browser verification
Verify major user journeys in the browser, including search, filtering, detail views, navigation, and cross-module relationships.

### Build-quality checks
Run the project's type, lint, test, and production-build checks as appropriate.

## Data integrity rule

Missing or unsupported source data should be represented as unavailable rather than fabricated.
