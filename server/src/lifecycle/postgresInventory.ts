import type { Pool } from 'pg';

/** PostgreSQL implementation used when the database-backed checkout repository is wired. */
export class PostgresInventoryService {
  constructor(private readonly pool: Pool) {}
  async reserveStock(variantId: string, quantity: number, orderId: string): Promise<{ id: string; expiresAt: Date }> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const stock = await client.query('UPDATE inventory SET available_quantity = available_quantity - $2, reserved_quantity = reserved_quantity + $2, updated_at = now() WHERE variant_id = $1 AND available_quantity >= $2 RETURNING variant_id', [variantId, quantity]);
      if (stock.rowCount !== 1) throw new Error('This item is out of stock.');
      const reservation = await client.query("INSERT INTO inventory_reservations (variant_id, order_id, quantity, status, expires_at) VALUES ($1, $2, $3, 'active', now() + interval '10 minutes') RETURNING id, expires_at", [variantId, orderId, quantity]);
      await client.query('COMMIT'); return { id: reservation.rows[0].id, expiresAt: reservation.rows[0].expires_at };
    } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
  }
  async releaseExpiredReservations(): Promise<void> { await this.pool.query("WITH expired AS (UPDATE inventory_reservations SET status = 'expired' WHERE status = 'active' AND expires_at <= now() RETURNING variant_id, quantity) UPDATE inventory AS i SET available_quantity = i.available_quantity + expired.quantity, reserved_quantity = i.reserved_quantity - expired.quantity, updated_at = now() FROM expired WHERE i.variant_id = expired.variant_id"); }
}
