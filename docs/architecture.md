# RyVora Architecture

## Application flow

```text
Approved synthetic dataset
        ↓
Dataset validation
        ↓
Build-time projection
        ↓
Typed application data
        ↓
Services / data access
        ↓
Business rules and calculations
        ↓
React presentation layer
```

## Architectural principle

The UI should not become the source of business truth.

- Data access belongs at the data/service boundary.
- Business rules and calculations belong in reusable service/business layers.
- React components present validated application state and user interactions.
- Cross-module relationships should be explicit and testable.

## Technology boundary

React and TypeScript provide the application UI and typed contracts. Vite provides development/build tooling. The healthcare functionality comes from the RCM domain model, workflows, business rules, calculations, and interoperability concepts—not from Vite itself.

## Production evolution

The portfolio application can conceptually evolve toward:

```text
Presentation
    ↓
Authenticated API
    ↓
Domain/Application Services
    ↓
Database / Event Infrastructure
    ↓
Interoperability Connectors
    ↓
Payer / EHR / Healthcare Ecosystem
```

This is a target-state concept, not a claim that these production components currently exist in RyVora.
