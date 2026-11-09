# Five-minute demo: Maya’s Chewy Autoship story

## 0:00–0:35 — Set the scene

“Maya buys Blue Buffalo dog food every month. Chewy wants to give her a clear first-order Autoship offer while ensuring that the promotion cannot be abused or double-redeemed.” Open the Product screen.

## 0:35–1:20 — Product and promotion

Choose Chicken & Brown Rice and switch from the 15 lb to 30 lb bag. Point out the one-time price, Autoship price, and welcome-offer text. Explain that 35% is calculated in integer cents and the 30 lb bag stops at the $20 cap. Change to the ineligible Salmon 30 lb option to show the eligibility feedback.

## 1:20–2:00 — Checkout

Click **Start Autoship**. Show Maya’s address, the green **Address verified** badge, item detail, offer deduction, and total before tax. Explain that checkout uses an idempotency key and an atomic inventory reservation that expires in ten minutes.

## 2:00–2:45 — Manage Autoship

Open **Manage Autoship**. Show the next ship date, four-week cadence, delivery address, and out-of-stock notice. Click **Skip next shipment**, then show that cancel opens a separate confirmation dialog rather than changing the subscription immediately.

## 2:45–3:35 — Policy RAG

In **Policy help**, ask: “Do I still get 35% off if I cancel and come back?” Show the answer and the `cancel-and-resubscribe.md — Re-subscribing` citation. Explain that documents are split by heading, versioned and hashed; `npm run ingest` only re-embeds changed policy files.

## 3:35–4:35 — Agentic assistant

In **Autoship assistant**, ask the same discount question and point out the `search_policy` tool trace and citation. Then ask **“Skip my next order.”** The assistant proposes, but does not execute, a pending `skip_next_order` action. Click **Confirm** and explain that a confirmation token binds the action to Maya and expires after five minutes.

## 4:35–5:00 — Evidence

Run `npm run eval` and point to the pass-rate table. Mention the evaluation suite covers policy facts, expected tools, unsafe cross-customer requests, and questions that must return “I can't find that in the policy.”
