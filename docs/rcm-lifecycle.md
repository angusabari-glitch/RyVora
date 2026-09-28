# RCM Lifecycle

RyVora treats the modules as connected views of one revenue-cycle ecosystem rather than independent screens.

```text
Claim
  ↓
837 submission context
  ↓
Adjudication / outcome
  ↓
Denial where applicable
  ↓
AI recommendation
  ↓
Human review
  ↓
Payment / 835
  ↓
Reconciliation
  ↓
AR when unresolved
  ↓
Exception / follow-up
  ↓
Analytics and automation opportunities
```

## Module relationships

### Claims
Establishes the central claim record and its financial and operational context.

### Denials
Connects denial reason, category, follow-up, financial context, and available decision-support records.

### Payments
Connects payment/remittance context to claims and supports deterministic reconciliation where source fields permit.

### AR
Represents outstanding receivables, aging, exposure, prioritization, and follow-up context.

### Exceptions
Surfaces unresolved operational or data conditions that require investigation or escalation.

### Analytics
Aggregates validated information across operational domains for trends, distributions, relationships, and drill-down.

### Automation
Identifies rule-based workflow opportunities without representing unimplemented external execution as live.

### AI / HITL
Presents recommendation records separately from human review and final operational action.
