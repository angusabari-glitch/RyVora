# RyVora — US Healthcare RCM Digital Transformation & Interoperability Platform

> **Portfolio demonstration:** RyVora is a simulated healthcare revenue-cycle management (RCM) application using synthetic, non-PHI data. It is not represented as a production healthcare system or live implementation.

## Overview

RyVora demonstrates an end-to-end RCM operating model connecting:

**Claims → 837 → Denials → AI Recommendation → Human Review → Payment/835 → AR → Exceptions → Analytics / Automation**

The project combines healthcare business analysis, RCM workflow design, product/solution design, interoperability concepts, analytics, application delivery, validation, and governed AI-assisted workflows.

## Business Problem

Healthcare RCM operations can span multiple systems, transaction formats, queues, spreadsheets, and handoffs. A claim may move through submission, adjudication, denial, payment, reconciliation, and AR follow-up while information about the same financial event is distributed across different operational contexts.

RyVora represents a connected operational view of that lifecycle so users can understand what happened, why it happened, what needs attention, and what information supports the next action.

## My Role

**Healthcare Business Analyst / Product & Solution Design — Independent Portfolio Project**

Key responsibilities demonstrated:

- Requirements analysis and documentation
- RCM workflow and process design
- Business rules and acceptance criteria
- User stories and traceability
- AS-IS / TO-BE workflow thinking
- Solution and integration concepts
- X12 837/835 transaction context
- HL7/FHIR interoperability concepts
- KPI and relationship validation
- AI/HITL governance design
- Automation opportunity analysis
- Application validation and regression testing

## Product Areas

| Area | Purpose |
|---|---|
| Executive Dashboard | Operational RCM overview and calculated KPIs |
| Claims | Claim work queue, search, filters, financial context and detail |
| Denials | Denial analysis, reason/follow-up context and decision support |
| Payments | 835/remittance context and claim/payment reconciliation |
| AR Management | Aging, exposure, prioritization and follow-up |
| Exceptions | Unresolved operational/data conditions |
| Interoperability | 837/835 relationships and FHIR-oriented concepts |
| Analytics | Cross-module operational analysis |
| Automation | Rule-based workflow opportunities |
| AI / HITL | AI recommendations with separate human review |

## Architecture

```text
Approved Synthetic Dataset
          ↓
       Validation
          ↓
   Build-time Projection
          ↓
      Typed Data
          ↓
       Services
          ↓
    Business Logic
          ↓
       React UI
```

The application is intentionally structured so the UI is not the source of business truth. Data access, reusable calculations, and business rules are separated from presentation components.

## Technology

- React 19
- TypeScript 5.9
- Vite
- pnpm
- Vitest / JSDOM / Testing Library
- Biome
- Inter Variable
- X12 837/835 transaction concepts
- HL7/FHIR interoperability concepts
- SQL and Power BI requirements concepts
- Jira / Visio for analysis and design artifacts

## Synthetic Dataset

The approved v1.2 portfolio dataset contains:

- Claims — 1,000
- 837 Transactions — 1,000
- Denials — 290
- AI Recommendations — 290
- Human Reviews — 180
- 835 Payments — 520
- AR Records — 1,000
- Exceptions — 180
- Audit Events — 3,060
- Patients — 50
- Providers — 10
- Payers — 6

KPIs and operational values should be derived from the approved dataset rather than hard-coded.

## Interoperability

RyVora distinguishes two complementary interoperability concepts:

- **X12 837** — administrative healthcare claim submission context.
- **X12 835** — administrative payment/remittance context.
- **HL7 FHIR** — API/resource-oriented healthcare interoperability concepts.

The portfolio does **not** claim live payer connectivity, live FHIR APIs, or production EDI processing.

## AI and Human-in-the-Loop

AI is represented as **decision support**, not autonomous financial or clinical authority.

The design separates:

```text
AI Recommendation
       ↓
Human Review
       ↓
Final Operational Action
```

Current AI recommendation records are synthetic dataset-provided records. The application does not claim a live external LLM integration, model accuracy, financial savings, or autonomous action.

## Validation

The application is validated through:

- End-to-end workflow checks
- Data and relationship validation
- KPI reconciliation
- Regression testing
- Browser verification
- Type/lint/build checks
- Edge-case testing where applicable
- Synthetic/non-PHI data integrity checks

## Portfolio Boundary

RyVora does **not** claim:

- Production healthcare deployment
- Live payer connectivity
- Production persistence or authentication/authorization
- Live external automation execution
- Autonomous AI actions
- HIPAA certification or regulatory certification
- Use of real patient/PHI data
- Unsupported AI accuracy, savings, confidence, or acceptance metrics

## Future Production Evolution

A production-oriented evolution could introduce:

```text
React UI
   ↓
Authenticated API
   ↓
Domain Services
   ↓
Database / Event Infrastructure
   ↓
EDI / Payer / FHIR Integrations
   ↓
Production Security, Audit & Monitoring
```

## Project Evidence

- [RCM Lifecycle](docs/rcm-lifecycle.md)
- [Architecture](docs/architecture.md)
- [Interoperability](docs/interoperability.md)
- [AI / HITL](docs/ai-hitl.md)
- [Validation](docs/validation.md)
- [Portfolio Boundary](docs/portfolio-boundary.md)

## Status

RyVora is an evolving independent portfolio project. Implemented functionality should be described separately from future production concepts.
