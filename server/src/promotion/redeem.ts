import { Router } from 'express';
import type { Pool, PoolClient } from 'pg';
import { z } from 'zod';

export type RedemptionInput = Readonly<{
  customerId: string;
  promotionId: string;
  orderId: string;
  discountCents: number;
  idempotencyKey: string;
}>;

export type Redemption = Readonly<{
  id: string;
  customerId: string;
  promotionId: string;
  orderId: string;
  discountCents: number;
  idempotencyKey: string;
}>;

export type RedeemResult =
  | Readonly<{ kind: 'created'; redemption: Redemption }>
  | Readonly<{ kind: 'idempotent_replay'; redemption: Redemption }>
  | Readonly<{ kind: 'already_redeemed' }>;

export interface RedemptionRepository {
  redeem(input: RedemptionInput): Promise<RedeemResult>;
}

const redemptionSchema = z.object({
  customerId: z.uuid(),
  promotionId: z.uuid(),
  orderId: z.uuid(),
  discountCents: z.number().int().nonnegative(),
  idempotencyKey: z.string().min(1).max(255),
}).strict();

const rowToRedemption = (row: Record<string, unknown>): Redemption => ({
  id: z.string().parse(row.id),
  customerId: z.string().parse(row.customer_id),
  promotionId: z.string().parse(row.promotion_id),
  orderId: z.string().parse(row.order_id),
  discountCents: z.number().int().parse(row.discount_cents),
  idempotencyKey: z.string().parse(row.idempotency_key),
});

const selectByIdempotencyKey = `
  SELECT id, customer_id, promotion_id, order_id, discount_cents, idempotency_key
  FROM offer_redemptions WHERE idempotency_key = $1
`;

export class PostgresRedemptionRepository implements RedemptionRepository {
  constructor(private readonly pool: Pool) {}

  async redeem(input: RedemptionInput): Promise<RedeemResult> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const existing = await client.query(selectByIdempotencyKey, [input.idempotencyKey]);
      if (existing.rowCount === 1) {
        await client.query('COMMIT');
        return { kind: 'idempotent_replay', redemption: rowToRedemption(existing.rows[0]) };
      }

      const inserted = await client.query(
        `INSERT INTO offer_redemptions
          (customer_id, promotion_id, order_id, idempotency_key, redemption_kind, discount_cents)
         VALUES ($1, $2, $3, $4, 'first_order', $5)
         RETURNING id, customer_id, promotion_id, order_id, discount_cents, idempotency_key`,
        [input.customerId, input.promotionId, input.orderId, input.idempotencyKey, input.discountCents],
      );
      await client.query('COMMIT');
      return { kind: 'created', redemption: rowToRedemption(inserted.rows[0]) };
    } catch (error) {
      await safeRollback(client);
      if (!isUniqueViolation(error)) {
        throw error;
      }

      const existing = await this.pool.query(selectByIdempotencyKey, [input.idempotencyKey]);
      if (existing.rowCount === 1) {
        return { kind: 'idempotent_replay', redemption: rowToRedemption(existing.rows[0]) };
      }
      return { kind: 'already_redeemed' };
    } finally {
      client.release();
    }
  }
}

export class InMemoryRedemptionRepository implements RedemptionRepository {
  private readonly byIdempotencyKey = new Map<string, Redemption>();
  private readonly customerPromotionKeys = new Set<string>();
  private nextId = 1;

  async redeem(input: RedemptionInput): Promise<RedeemResult> {
    // Yield once so Promise.all exercises interleaving before unique keys are checked.
    await Promise.resolve();
    const replay = this.byIdempotencyKey.get(input.idempotencyKey);
    if (replay !== undefined) {
      return { kind: 'idempotent_replay', redemption: replay };
    }

    const customerPromotionKey = `${input.customerId}:${input.promotionId}`;
    if (this.customerPromotionKeys.has(customerPromotionKey)) {
      return { kind: 'already_redeemed' };
    }

    const redemption: Redemption = { id: `redemption-${this.nextId++}`, ...input };
    this.customerPromotionKeys.add(customerPromotionKey);
    this.byIdempotencyKey.set(input.idempotencyKey, redemption);
    return { kind: 'created', redemption };
  }

  async count(): Promise<number> {
    return this.byIdempotencyKey.size;
  }
}

export function createPromotionRouter(repository: RedemptionRepository): Router {
  const router = Router();
  router.post('/redeem', async (request, response, next) => {
    try {
      const input = redemptionSchema.parse(request.body);
      const result = await repository.redeem(input);
      if (result.kind === 'already_redeemed') {
        response.status(409).json({ code: 'FIRST_TIME_OFFER_ALREADY_REDEEMED', message: 'This customer has already redeemed this promotion.' });
        return;
      }
      response.status(result.kind === 'created' ? 201 : 200).json({
        redemption: result.redemption,
        idempotentReplay: result.kind === 'idempotent_replay',
      });
    } catch (error) {
      next(error);
    }
  });
  return router;
}

async function safeRollback(client: PoolClient): Promise<void> {
  try {
    await client.query('ROLLBACK');
  } catch {
    // A failed BEGIN must not hide the original database error.
  }
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === '23505';
}
