INSERT INTO customers (id, email, full_name) VALUES
  ('00000000-0000-0000-0000-000000000001', 'maya.chen@example.test', 'Maya Chen'),
  ('00000000-0000-0000-0000-000000000002', 'owen.brooks@example.test', 'Owen Brooks');

INSERT INTO products (id, name, brand, pet_type, category, autoship_eligible) VALUES
  ('10000000-0000-0000-0000-000000000001', 'Chicken & Brown Rice Recipe', 'Blue Buffalo', 'dog', 'Dry Food', true),
  ('10000000-0000-0000-0000-000000000002', 'Indoor Health Formula', 'Purina ONE', 'cat', 'Dry Food', true),
  ('10000000-0000-0000-0000-000000000003', 'Peanut Butter Training Treats', 'Chewy Chews', 'dog', 'Treats', true);

INSERT INTO variants (id, product_id, sku, flavor, size, price_cents, autoship_eligible) VALUES
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'BB-CHICKEN-15', 'Chicken', '15 lb', 4299, true),
  ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'BB-CHICKEN-30', 'Chicken', '30 lb', 6999, true),
  ('20000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000002', 'PO-SALMON-7', 'Salmon', '7 lb', 2699, true),
  ('20000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000002', 'PO-TURKEY-16', 'Turkey', '16 lb', 4599, true),
  ('20000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000003', 'CC-PB-8OZ', 'Peanut Butter', '8 oz', 999, true),
  ('20000000-0000-0000-0000-000000000006', '10000000-0000-0000-0000-000000000003', 'CC-PB-16OZ', 'Peanut Butter', '16 oz', 1699, true);

INSERT INTO inventory (variant_id, available_quantity, reserved_quantity) VALUES
  ('20000000-0000-0000-0000-000000000001', 120, 0),
  ('20000000-0000-0000-0000-000000000002', 84, 0),
  ('20000000-0000-0000-0000-000000000003', 200, 0),
  ('20000000-0000-0000-0000-000000000004', 156, 0),
  ('20000000-0000-0000-0000-000000000005', 320, 0),
  ('20000000-0000-0000-0000-000000000006', 275, 0);

INSERT INTO promotions (id, name, first_order_percent_bps, first_order_cap_cents, recurring_percent_bps, priority) VALUES
  ('30000000-0000-0000-0000-000000000001', 'Chewy Autoship Welcome + Ongoing Savings', 3500, 2000, 500, 100);

INSERT INTO subscriptions (id, customer_id, variant_id, status, cadence_days, next_ship_at, shipping_zip) VALUES
  ('40000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'active', 30, now() + INTERVAL '14 days', '94107');
