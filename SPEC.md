# Chewy Autoship Promo Desk

## Goal

Build a focused, demo-ready Autoship Promo Desk for Chewy. It helps a shopper or support agent quote an Autoship offer, safely check out a pet-product subscription, and manage future deliveries. The product must make the system design visible: promotions, subscription lifecycle, agentic AI, and grounded policy answers.

## Users

- **Pet parent:** chooses recurring food, treats, litter, or other eligible pet essentials and manages delivery cadence.
- **Chewy support agent:** explains eligibility and resolves subscription requests with an auditable AI assistant.
- **Promo operations admin:** understands offer uptake and policy/index freshness from the desk.

## Screens

1. **Promo Desk overview**
   - Program metrics, active Autoships, paused subscriptions, projected renewals, and offer conversion.
   - Promo eligibility simulator for customer, flavor/product, and size/variant.
2. **Product / Autoship offer card**
   - Chewy-style product choice (for example dog food flavor and bag size).
   - “35% off first Autoship order, up to $20; 5% on future eligible Autoship orders.”
   - Clear ineligible-product explanation (for example limited-edition or excluded SKU).
3. **Checkout**
   - Address validation result, ZIP-code-based US tax estimate, inventory reservation state, discount breakdown, and idempotent checkout feedback.
4. **Manage Autoship**
   - Subscription details and status: `active`, `paused`, `canceled`.
   - Skip next shipment, delay next shipment, change cadence/variant, resume, and cancel.
5. **AI operations panel**
   - Chat with tool-call trace, policy citations, and confirmation gate before changes.
6. **RAG ingestion status**
   - Policy document → structure-aware chunks → embeddings → pgvector index → cited answer.

## Core Features

### 1. Promotion engine

- New customer’s first eligible Autoship order gets **35% off, capped at $20.00**.
- Eligible future Autoship renewals receive **5% off**.
- Eligibility is evaluated by product/variant, flavor, size, promotion dates, customer history, and exclusion rules.
- Monetary calculations use integer cents; one deterministic promotion wins when offers overlap.

Technical challenges:

1. Prevent two simultaneous checkouts from redeeming the first-order offer twice using a transaction plus a unique redemption constraint.
2. Apply percentage discounts and caps precisely in cents with an explicit promotion-priority policy.

### 2. Checkout and subscription lifecycle

- Validate shipping address through an adapter (mock provider first).
- Estimate US sales tax based on ZIP code.
- Atomically reserve inventory, create an order, and start an Autoship subscription.
- Release expired inventory reservations.
- Support `active`, `paused`, and `canceled` subscriptions and skip/delay actions.
- Require an idempotency key for checkout and other write endpoints.

Technical challenges:

1. Prevent overselling with an atomic inventory decrement and reservation expiration job.
2. Make retries safe so a repeated request cannot charge, reserve, or create a subscription twice.

## AI Features

### 1. Agentic Autoship assistant

The assistant can answer support/shopper questions and call controlled tools:

- `check_eligibility(customer_id, variant_id)`
- `get_order(order_id | customer_id)`
- `get_subscription(subscription_id)`
- `prepare_skip_shipment(subscription_id)`
- `prepare_delay_shipment(subscription_id, date)`
- `search_policy(query)`

Read-only tools can run immediately. Any tool that changes state only prepares a proposed action; the UI must obtain explicit user confirmation before execution. Every run logs steps, tool inputs/results, actor, and outcome.

Technical challenges:

1. Validate tool parameters and authorization, then require a confirmation token for mutation tools.
2. Bound the agent loop (maximum steps/time), persist tool traces, and force policy-backed answers instead of ungrounded claims.

### 2. RAG ingestion pipeline

- Ingest Chewy Autoship policy and support documents.
- Parse headings, lists, tables, exceptions, and source locations into structure-aware chunks.
- Store embeddings and chunk metadata in PostgreSQL with pgvector.
- Retrieve relevant chunks, answer with document/version/section citations, and show citations in the UI.
- Re-index only changed documents using content hashes and document versions.

Technical challenges:

1. Preserve exceptions and table context when chunking so policy meaning is not separated from its conditions.
2. Keep the index current and auditable with document hashes, versions, and incremental re-ingestion.

## Data Tables

| Table | Key fields / purpose |
| --- | --- |
| `customers` | `id`, name, email, first_autoship_order_at |
| `products` | `id`, Chewy category, name, brand, eligibility flags |
| `variants` | `id`, `product_id`, flavor, size, SKU, price_cents, active |
| `promotions` | rule type, percent_bps, cap_cents, priority, eligibility, effective dates |
| `offer_redemptions` | `customer_id`, `promotion_id`, `order_id`, redeemed_at; unique first-redemption guard |
| `subscriptions` | customer, variant, cadence, next_ship_at, status, shipping address snapshot |
| `orders` | customer, subscription, totals in cents, tax_cents, status, idempotency_key |
| `order_items` | order, variant, quantity, unit_price_cents, discount_cents |
| `inventory` | variant, available_quantity, reserved_quantity |
| `inventory_reservations` | variant, order/idempotency key, quantity, expires_at, state |
| `policy_documents` | source URI, title, version, content_hash, ingestion status |
| `policy_chunks` | document, version, text, section metadata, embedding (pgvector) |
| `agent_runs` | actor, prompt, status, step count, trace JSON |
| `agent_actions` | agent run, proposed/executed tool, confirmation token, input/result JSON |

## API Surface

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `POST` | `/api/promotions/quote` | Return eligibility, selected promotion, and cents-based calculation. |
| `POST` | `/api/checkout/preview` | Validate address, resolve ZIP tax, quote reservation and order total. |
| `POST` | `/api/checkout` | Idempotently reserve stock, create order/subscription, and redeem offer. |
| `GET` | `/api/subscriptions/:id` | Get subscription and next shipment state. |
| `POST` | `/api/subscriptions/:id/actions/prepare` | Validate and prepare skip, delay, pause, resume, edit, or cancel. |
| `POST` | `/api/subscriptions/:id/actions/confirm` | Execute a previously confirmed action exactly once. |
| `POST` | `/api/assistant/messages` | Start a bounded assistant run and return tool trace/citations. |
| `POST` | `/api/assistant/actions/:id/confirm` | Confirm a mutation proposed by the assistant. |
| `POST` | `/api/rag/ingest` | Ingest or incrementally update a policy document. |

## Acceptance Criteria

- The demo visibly supports the two core and two AI features above.
- A first-order promotion cannot be redeemed twice for one customer under concurrent requests.
- Checkout retries with the same idempotency key return the original outcome.
- A subscription mutation from the AI assistant cannot execute before user confirmation.
- Policy answers display at least one relevant source citation.
