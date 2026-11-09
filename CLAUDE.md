# Engineering Rules — Chewy Autoship Promo Desk

## Stack

- Frontend: React, TypeScript, Vite.
- Backend: Express, TypeScript.
- Data: PostgreSQL with pgvector.
- Validation: Zod at every API boundary and tool boundary.
- Testing: Vitest for unit/integration tests.
- Local infrastructure: Docker Compose for PostgreSQL/pgvector.

## Working Rules

- Before coding, communicate a plan in five lines or fewer.
- Change only files required by the current task; preserve unrelated work.
- Prefer small, vertical slices over broad scaffolding.
- Keep frontend and backend types explicit; never use `any` without a documented reason.
- Keep all customer-facing copy specific to Chewy Autoship and pet-product examples.

## Money, Pricing, and State

- Store and calculate money in integer cents only. Never use floating-point currency values.
- Write tests before implementing or changing discount logic.
- Promotion selection must be deterministic and documented by priority.
- Use database transactions for redemption, order creation, and inventory reservation.
- Enforce first-order redemption with a database-level unique constraint, not application logic alone.
- All retryable writes require an idempotency key and must return the original completed result.
- Inventory reservations must expire and release safely.

## API and Security

- Validate every API request, response boundary, environment value, and AI tool input with Zod.
- Return safe, actionable error messages; never expose stack traces or secrets.
- Authorize customer and support-agent access before returning or changing data.
- Log mutation intent and outcome with correlation IDs; do not log sensitive payment or address details in plain text.
- Do not integrate a real payment processor, send customer communications, or call external Chewy systems in this project.

## AI Rules

- Read-only assistant tools may execute after authorization and schema validation.
- Any action that changes data must be proposed first and require explicit user confirmation before execution.
- Confirmation tokens must bind actor, tool name, validated arguments, and expiry.
- Cap agent steps and time; persist each tool call and result in an auditable trace.
- Policy answers must cite retrieved source document/version/section. If no support is retrieved, say so rather than inventing policy.
- RAG ingestion must retain document version, content hash, source location, and chunk metadata.

## Test Expectations

- Unit test pricing caps, rounding, eligibility, promotion precedence, and first-order redemption behavior.
- Integration test idempotent checkout, concurrent redemption conflict, and inventory reservation expiry.
- Test that assistant mutation tools reject missing/expired confirmation tokens.
- Test that RAG responses include citations for retrieved policy content.
