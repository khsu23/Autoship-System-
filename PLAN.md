# Implementation Plan — Chewy Autoship Promo Desk

> Mark an item complete only after its tests or manual acceptance check pass.

## 1. Foundation — completed in Task 1

- [x] Create the React + TypeScript + Vite frontend and Express + TypeScript API structure.
- [x] Add Docker Compose with PostgreSQL and pgvector.
- [x] Create the initial database schema and seed Chewy product/promotion data.
- [ ] Run `docker compose up -d` and query the seeded product, variant, promotion, and inventory rows.
- [ ] Add environment validation, shared TypeScript/Zod types, and Vitest configuration.

## 2. Data model enhancements

- [x] Create the initial tables for customers, products, variants, promotions, subscriptions, orders, redemptions, and inventory.
- [x] Seed Chewy-style dog food, cat food, treats, flavors/sizes, inventory, customer, subscription, and welcome promotion data.
- [ ] Create migrations for policy documents/chunks and agent runs/actions.
- [ ] Add a repeatable migration runner before feature work begins.

## 3. Promotion engine

- [x] Write unit tests for 35%-off first Autoship, $20 cap, 5% recurring discount, exclusions, expiry, and priority.
- [x] Implement cents-only promotion quote calculation.
- [x] Add transactional first-order redemption with database uniqueness, idempotency, and concurrency tests.
- [ ] Implement `POST /api/promotions/quote` with Zod validation.
- [x] Build the product/offer card and quote simulator UI with mock RTK Query data.

## 4. Checkout and lifecycle

- [ ] Implement mock address validation and ZIP-based tax adapter.
- [ ] Implement atomic inventory reservation plus reservation expiration/release.
- [ ] Write integration tests for oversell prevention and checkout idempotency.
- [ ] Implement checkout preview and submit APIs using idempotency keys.
- [ ] Create order, first subscription, and redemption in one transaction.
- [x] Build the mock checkout UI with price, discount, tax, and address-validation feedback.
- [ ] Implement subscription status, skip, delay, edit, pause/resume, and cancel flows.
- [x] Build the mock Manage Autoship UI with action controls, cancellation confirmation, and stock notice.

## 5. Agentic assistant

- [x] Define Zod schemas and customer-scoped assistant request/action validation.
- [x] Implement policy, eligibility, and pending mutation assistant tools.
- [x] Implement expiring confirmation tokens for skip, delay, and cancel actions.
- [x] Add bounded assistant trace logging and database schema for agent runs/actions.
- [x] Test policy-cited answers and that a skip only executes after confirmation.
- [x] Build the assistant chat panel showing tools, citations, and confirmation controls.

## 6. RAG pipeline

- [x] Create a policy parser that preserves headings, exceptions, source file, section, and version.
- [x] Implement chunking, OpenAI embeddings, pgvector storage, and document hash/version tracking.
- [x] Implement incremental ingestion that re-embeds only changed policy documents and removes deleted files.
- [x] Implement retrieval and verified file/section citation formatting for policy answers.
- [x] Add parser/hash tests; end-to-end ingestion requires local PostgreSQL and an API key.
- [x] Build a client policy search box with answer, citation, and unavailable-index states.

## 7. Demo polish and verification

- [ ] Add the overview metrics and the end-to-end workflow/architecture view.
- [ ] Verify all money output stays in cents until formatting at the UI edge.
- [ ] Verify all write routes use Zod, authorization, transaction/idempotency, and audit logging.
- [x] Run unit tests and the 20-case assistant evaluation suite.
- [ ] Run the app locally and manually demonstrate: first offer → checkout → subscription → AI-confirmed skip → cited policy answer.
- [x] Add README architecture/implementation notes and a five-minute Maya demo script; record local Docker/API-key limitations.
