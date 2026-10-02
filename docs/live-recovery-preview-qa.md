# CourtIQ live recovery preview QA

Production database prerequisites completed before public feature activation:

- Ownership safeguards applied and verified.
- Reliable session/development migration applied and verified.
- Existing sessions preserved as legacy sessions.
- Ten controlled database smoke tests passed:
  - direct tracked-session mutation blocked
  - direct active-session shot insert blocked
  - same-ID retry idempotent
  - free throw and field-goal persistence
  - command ledger versioning
  - workout persistence
  - stale-version conflict rejection
  - cross-account read isolation
  - cross-account RPC isolation
  - cascading managed-player cleanup
- Production feature flag remains unchanged.
- Preview environment is intended to run with `NEXT_PUBLIC_TRACKER_RECOVERY_ENABLED=true`.

Remaining gate: authenticated browser recovery flow on a Preview deployment before production activation.
