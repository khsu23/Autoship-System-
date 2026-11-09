import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createPromotionRouter, InMemoryRedemptionRepository } from './redeem.js';

describe('POST /api/promotions/redeem', () => {
  it('allows only one simultaneous first-time redemption for a customer and promotion', async () => {
    const repository = new InMemoryRedemptionRepository();
    const app = express();
    app.use(express.json());
    app.use('/api/promotions', createPromotionRouter(repository));

    const firstRequest = request(app).post('/api/promotions/redeem').send({
      customerId: '11111111-1111-4111-8111-111111111111',
      promotionId: '22222222-2222-4222-8222-222222222222',
      orderId: '33333333-3333-4333-8333-333333333333',
      discountCents: 1750,
      idempotencyKey: 'redeem-concurrent-a',
    });
    const secondRequest = request(app).post('/api/promotions/redeem').send({
      customerId: '11111111-1111-4111-8111-111111111111',
      promotionId: '22222222-2222-4222-8222-222222222222',
      orderId: '44444444-4444-4444-8444-444444444444',
      discountCents: 1750,
      idempotencyKey: 'redeem-concurrent-b',
    });

    const [first, second] = await Promise.all([firstRequest, secondRequest]);
    expect([first.status, second.status].sort()).toEqual([201, 409]);
    expect(await repository.count()).toBe(1);
  });

  it('returns the original redemption when the same idempotency key is retried', async () => {
    const repository = new InMemoryRedemptionRepository();
    const app = express();
    app.use(express.json());
    app.use('/api/promotions', createPromotionRouter(repository));
    const payload = {
      customerId: '55555555-5555-4555-8555-555555555555',
      promotionId: '22222222-2222-4222-8222-222222222222',
      orderId: '66666666-6666-4666-8666-666666666666',
      discountCents: 2000,
      idempotencyKey: 'redeem-retry-1',
    };

    const first = await request(app).post('/api/promotions/redeem').send(payload);
    const retry = await request(app).post('/api/promotions/redeem').send(payload);

    expect(first.status).toBe(201);
    expect(retry.status).toBe(200);
    expect(retry.body).toMatchObject({ redemption: first.body.redemption, idempotentReplay: true });
    expect(await repository.count()).toBe(1);
  });
});
