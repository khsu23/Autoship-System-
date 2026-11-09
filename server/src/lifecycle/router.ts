import { Router, type Response } from 'express';
import { z } from 'zod';
import { InMemoryAutoshipStore, type SubscriptionAction } from './service.js';

const checkoutSchema = z.object({ customerId: z.string().min(1), variantId: z.string().min(1), quantity: z.number().int().positive(), idempotencyKey: z.string().min(1), address: z.object({ name: z.string(), line1: z.string(), city: z.string(), state: z.string(), zip: z.string() }).strict() }).strict();
const actionSchema = z.object({ idempotencyKey: z.string().min(1), delayTo: z.string().min(1).optional() }).strict();
const variants = [
  { id: 'bb-chicken-15', flavor: 'Chicken & Brown Rice', size: '15 lb bag', priceCents: 4299, promoEligible: true },
  { id: 'bb-chicken-30', flavor: 'Chicken & Brown Rice', size: '30 lb bag', priceCents: 6999, promoEligible: true },
  { id: 'bb-salmon-15', flavor: 'Salmon & Sweet Potato', size: '15 lb bag', priceCents: 4599, promoEligible: true },
  { id: 'bb-salmon-30', flavor: 'Salmon & Sweet Potato', size: '30 lb bag', priceCents: 7599, promoEligible: false },
];

export function createLifecycleRouter(store: InMemoryAutoshipStore): Router {
  const router = Router();
  router.get('/catalog/product', (_request, response) => response.json({ product: { name: 'Blue Buffalo Life Protection Formula', brand: 'Blue Buffalo', rating: '4.8', reviewCount: '2,143', description: 'Natural adult dry dog food with real meat first.' }, variants }));
  router.get('/checkout-preview/:variantId', (request, response) => { const variant = variants.find((item) => item.id === request.params.variantId); if (!variant) { response.status(404).json({ message: 'Variant not found.' }); return; } const discountCents = variant.promoEligible ? Math.min(Math.floor(variant.priceCents * 3500 / 10_000), 2000) : 0; response.json({ variant, discountCents, subtotalCents: variant.priceCents, totalCents: variant.priceCents - discountCents, address: { name: 'Maya Chen', line1: '215 King Street Apt 4', city: 'San Francisco', state: 'CA', zip: '94107' } }); });
  router.get('/subscriptions/:id', (request, response) => { const subscription = store.getSubscription(request.params.id); if (!subscription) { response.status(404).json({ message: 'Subscription not found.' }); return; } response.json({ ...subscription, outOfStock: store.availableStock(subscription.variantId) === 0, variant: variants.find((variant) => variant.id === subscription.variantId) }); });
  router.post('/checkout', async (request, response) => {
    try { const result = await store.checkout(checkoutSchema.parse(request.body)); response.status(result.idempotentReplay ? 200 : 201).json(result); } catch (error) { sendError(response, error); }
  });
  router.post('/subscriptions/:id/:action', async (request, response) => {
    try { const action = parseAction(request.params.action); const input = actionSchema.parse(request.body); const subscription = await store.transition(request.params.id, action, input.idempotencyKey, input.delayTo); response.json({ subscription, idempotentReplay: false }); } catch (error) { sendError(response, error); }
  });
  return router;
}

function parseAction(value: string): SubscriptionAction { if (value === 'skip' || value === 'delay' || value === 'pause' || value === 'resume' || value === 'cancel' || value === 'resubscribe') return value; throw new Error('Unsupported subscription action.'); }
function sendError(response: Response, error: unknown): void { const message = error instanceof Error ? error.message : 'Unexpected server error.'; const status = message.includes('not found') ? 404 : message.includes('Cannot') || message.includes('out of stock') ? 409 : 400; response.status(status).json({ message }); }
