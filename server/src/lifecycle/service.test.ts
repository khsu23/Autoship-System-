import { describe, expect, it } from 'vitest';
import { InMemoryAutoshipStore } from './service.js';

const address = { name: 'Maya Chen', line1: '215 King Street #4', city: 'San Francisco', state: 'CA', zip: '94107' };

describe('Autoship checkout and lifecycle', () => {
  it('allows only one parallel reservation of the last item', async () => {
    const store = new InMemoryAutoshipStore({ 'bb-chicken-15': 1 });
    const [left, right] = await Promise.allSettled([
      store.reserveStock('bb-chicken-15', 1),
      store.reserveStock('bb-chicken-15', 1),
    ]);
    expect([left.status, right.status].filter((status) => status === 'fulfilled')).toHaveLength(1);
    expect([left.status, right.status].filter((status) => status === 'rejected')).toHaveLength(1);
    expect(store.availableStock('bb-chicken-15')).toBe(0);
  });

  it('rejects an invalid subscription state transition with a clear error', async () => {
    const store = new InMemoryAutoshipStore();
    await expect(store.transition('AS-20481', 'resubscribe', 'invalid-transition')).rejects.toThrow('Cannot resubscribe an active subscription');
  });

  it('returns the original checkout when its idempotency key is retried', async () => {
    const store = new InMemoryAutoshipStore({ 'bb-chicken-15': 2 });
    const input = { customerId: 'maya-chen', variantId: 'bb-chicken-15', quantity: 1, address, idempotencyKey: 'checkout-maya-001' };
    const first = await store.checkout(input);
    const retry = await store.checkout(input);
    expect(retry).toEqual(first);
    expect(store.reservationCount()).toBe(1);
    expect(store.availableStock('bb-chicken-15')).toBe(1);
    expect(first.subscription.address.line1).toBe('215 King Street Apt 4');
  });
});
