CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE subscription_status AS ENUM ('active', 'paused', 'canceled', 'resubscribed');
CREATE TYPE order_status AS ENUM ('pending', 'confirmed', 'canceled');

CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  brand TEXT NOT NULL,
  pet_type TEXT NOT NULL CHECK (pet_type IN ('dog', 'cat', 'other')),
  category TEXT NOT NULL,
  autoship_eligible BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  sku TEXT NOT NULL UNIQUE,
  flavor TEXT NOT NULL,
  size TEXT NOT NULL,
  price_cents INTEGER NOT NULL CHECK (price_cents >= 0),
  autoship_eligible BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (product_id, flavor, size)
);

CREATE TABLE promotions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  first_order_percent_bps INTEGER NOT NULL CHECK (first_order_percent_bps BETWEEN 0 AND 10000),
  first_order_cap_cents INTEGER NOT NULL CHECK (first_order_cap_cents >= 0),
  recurring_percent_bps INTEGER NOT NULL CHECK (recurring_percent_bps BETWEEN 0 AND 10000),
  priority INTEGER NOT NULL DEFAULT 100,
  active BOOLEAN NOT NULL DEFAULT true,
  starts_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ends_at TIMESTAMPTZ,
  CHECK (ends_at IS NULL OR ends_at > starts_at)
);

CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id),
  variant_id UUID NOT NULL REFERENCES variants(id),
  status subscription_status NOT NULL DEFAULT 'active',
  cadence_days INTEGER NOT NULL DEFAULT 30 CHECK (cadence_days > 0),
  next_ship_at TIMESTAMPTZ NOT NULL,
  shipping_zip TEXT NOT NULL CHECK (shipping_zip ~ '^[0-9]{5}(-[0-9]{4})?$'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id),
  subscription_id UUID REFERENCES subscriptions(id),
  idempotency_key TEXT NOT NULL UNIQUE,
  status order_status NOT NULL DEFAULT 'pending',
  subtotal_cents INTEGER NOT NULL CHECK (subtotal_cents >= 0),
  discount_cents INTEGER NOT NULL DEFAULT 0 CHECK (discount_cents >= 0),
  tax_cents INTEGER NOT NULL DEFAULT 0 CHECK (tax_cents >= 0),
  total_cents INTEGER NOT NULL CHECK (total_cents >= 0),
  shipping_zip TEXT NOT NULL CHECK (shipping_zip ~ '^[0-9]{5}(-[0-9]{4})?$'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (total_cents = subtotal_cents - discount_cents + tax_cents)
);

CREATE TABLE offer_redemptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id),
  promotion_id UUID NOT NULL REFERENCES promotions(id),
  order_id UUID NOT NULL UNIQUE REFERENCES orders(id),
  idempotency_key TEXT NOT NULL UNIQUE,
  redemption_kind TEXT NOT NULL CHECK (redemption_kind IN ('first_order', 'recurring')),
  discount_cents INTEGER NOT NULL CHECK (discount_cents >= 0),
  redeemed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (customer_id, promotion_id)
);

CREATE TABLE inventory (
  variant_id UUID PRIMARY KEY REFERENCES variants(id) ON DELETE CASCADE,
  available_quantity INTEGER NOT NULL CHECK (available_quantity >= 0),
  reserved_quantity INTEGER NOT NULL DEFAULT 0 CHECK (reserved_quantity >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (reserved_quantity <= available_quantity)
);

CREATE TABLE inventory_reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  variant_id UUID NOT NULL REFERENCES variants(id),
  order_id UUID REFERENCES orders(id),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  status TEXT NOT NULL CHECK (status IN ('active', 'released', 'expired')),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL REFERENCES subscriptions(id),
  type TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE policy_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_file TEXT NOT NULL UNIQUE,
  version TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  indexed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE policy_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES policy_documents(id) ON DELETE CASCADE,
  section TEXT NOT NULL,
  content TEXT NOT NULL,
  embedding vector(1536) NOT NULL,
  chunk_index INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (document_id, chunk_index)
);

CREATE TABLE agent_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), customer_id UUID NOT NULL REFERENCES customers(id), question TEXT NOT NULL,
  status TEXT NOT NULL, step_count INTEGER NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE agent_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), agent_run_id UUID NOT NULL REFERENCES agent_runs(id) ON DELETE CASCADE,
  tool_name TEXT NOT NULL, input_json JSONB NOT NULL, output_json JSONB NOT NULL, status TEXT NOT NULL,
  confirmation_token TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX variants_product_id_idx ON variants(product_id);
CREATE INDEX subscriptions_customer_id_idx ON subscriptions(customer_id);
CREATE INDEX orders_customer_id_idx ON orders(customer_id);
CREATE INDEX offer_redemptions_customer_id_idx ON offer_redemptions(customer_id);
CREATE INDEX inventory_reservations_expiry_idx ON inventory_reservations(status, expires_at);
CREATE INDEX policy_chunks_embedding_idx ON policy_chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
