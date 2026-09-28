# AI / Human-in-the-Loop

RyVora treats AI as decision support.

## Decision boundary

```text
Synthetic AI Recommendation
          ↓
Human Review
          ↓
Final Operational Action
```

The recommendation and human review are separate concepts.

## Governance principles

- AI output should be clearly labeled as recommendation/decision support.
- AI should not silently modify claim, denial, payment, or financial records.
- Human review remains distinct from the recommendation.
- Unsupported model accuracy, savings, confidence, or acceptance rates must not be invented.
- Current recommendation records are synthetic dataset-provided records.
- The portfolio application does not claim a live external LLM service.

## Production direction

A production implementation would require appropriate governance, security, monitoring, model validation, access control, auditability, and operational controls.
