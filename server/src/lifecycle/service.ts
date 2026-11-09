export type Address = Readonly<{ name: string; line1: string; city: string; state: string; zip: string }>;
export type VerifiedAddress = Address & Readonly<{ verified: true }>;
export type SubscriptionStatus = 'active' | 'paused' | 'canceled' | 'resubscribed';
export type SubscriptionAction = 'skip' | 'delay' | 'pause' | 'resume' | 'cancel' | 'resubscribe';

export interface AddressValidator { validate(address: Address): Promise<VerifiedAddress>; }
export class MockAddressValidator implements AddressValidator {
  async validate(address: Address): Promise<VerifiedAddress> {
    if (!address.name.trim() || !address.line1.trim() || !address.city.trim() || !/^[A-Z]{2}$/.test(address.state) || !/^\d{5}(-\d{4})?$/.test(address.zip)) {
      throw new Error('Address could not be verified. Provide name, street, city, two-letter state, and ZIP code.');
    }
    return { ...address, line1: address.line1.replace(/\s*#\s*([A-Za-z0-9-]+)/, ' Apt $1'), state: address.state.toUpperCase(), verified: true };
  }
}

type Reservation = { id: string; variantId: string; quantity: number; expiresAt: Date; status: 'active' | 'released' | 'expired' };
type Order = { id: string; customerId: string; variantId: string; quantity: number; address: VerifiedAddress; subscriptionId: string; reservationId: string };
export type Subscription = { id: string; customerId: string; variantId: string; status: SubscriptionStatus; nextShipDate: string; cadence: string; address: VerifiedAddress; skipped: boolean };
export type CheckoutInput = Readonly<{ customerId: string; variantId: string; quantity: number; address: Address; idempotencyKey: string }>;
export type CheckoutResult = Readonly<{ order: Order; subscription: Subscription; idempotentReplay: boolean }>;

const allowedTransitions: Record<SubscriptionStatus, readonly SubscriptionAction[]> = {
  active: ['skip', 'delay', 'pause', 'cancel'], paused: ['resume', 'cancel'], canceled: ['resubscribe'], resubscribed: ['skip', 'delay', 'pause', 'cancel'],
};

export class InMemoryAutoshipStore {
  private readonly inventory = new Map<string, number>();
  private readonly reservations = new Map<string, Reservation>();
  private readonly checkoutsByKey = new Map<string, CheckoutResult>();
  private readonly actionsByKey = new Map<string, Subscription>();
  private readonly subscriptions = new Map<string, Subscription>();
  private readonly notifications: string[] = [];
  private id = 1;

  constructor(stock: Record<string, number> = { 'bb-chicken-15': 12, 'bb-chicken-30': 8, 'bb-salmon-15': 6, 'bb-salmon-30': 0 }) {
    Object.entries(stock).forEach(([variantId, quantity]) => this.inventory.set(variantId, quantity));
    this.subscriptions.set('AS-20481', { id: 'AS-20481', customerId: 'maya-chen', variantId: 'bb-chicken-15', status: 'active', nextShipDate: 'Saturday, Nov 22', cadence: 'Every 4 weeks', address: { name: 'Maya Chen', line1: '215 King Street Apt 4', city: 'San Francisco', state: 'CA', zip: '94107', verified: true }, skipped: false });
  }

  async reserveStock(variantId: string, quantity: number): Promise<Reservation> {
    this.expireReservations();
    if (!Number.isInteger(quantity) || quantity <= 0) throw new Error('Reservation quantity must be a positive integer.');
    const available = this.inventory.get(variantId) ?? 0;
    if (available < quantity) throw new Error('This item is out of stock.');
    this.inventory.set(variantId, available - quantity); // Atomic in a single event-loop operation; production uses UPDATE ... WHERE.
    const reservation: Reservation = { id: `RES-${this.id++}`, variantId, quantity, expiresAt: new Date(Date.now() + 10 * 60 * 1000), status: 'active' };
    this.reservations.set(reservation.id, reservation);
    return reservation;
  }

  async releaseReservation(reservationId: string): Promise<void> {
    const reservation = this.reservations.get(reservationId);
    if (!reservation || reservation.status !== 'active') return;
    reservation.status = 'released';
    this.inventory.set(reservation.variantId, (this.inventory.get(reservation.variantId) ?? 0) + reservation.quantity);
  }

  async checkout(input: CheckoutInput): Promise<CheckoutResult> {
    const replay = this.checkoutsByKey.get(input.idempotencyKey);
    if (replay) return replay;
    const address = await new MockAddressValidator().validate(input.address);
    let reservation: Reservation | undefined;
    try {
      reservation = await this.reserveStock(input.variantId, input.quantity);
      const subscription: Subscription = { id: `AS-${this.id++}`, customerId: input.customerId, variantId: input.variantId, status: 'active', nextShipDate: 'Saturday, Nov 22', cadence: 'Every 4 weeks', address, skipped: false };
      const order: Order = { id: `ORD-${this.id++}`, customerId: input.customerId, variantId: input.variantId, quantity: input.quantity, address, subscriptionId: subscription.id, reservationId: reservation.id };
      const result: CheckoutResult = { order, subscription, idempotentReplay: false };
      this.subscriptions.set(subscription.id, subscription); this.checkoutsByKey.set(input.idempotencyKey, result);
      return result;
    } catch (error) {
      if (reservation) await this.releaseReservation(reservation.id);
      throw error;
    }
  }

  async transition(subscriptionId: string, action: SubscriptionAction, idempotencyKey: string, delayTo?: string): Promise<Subscription> {
    const replay = this.actionsByKey.get(idempotencyKey); if (replay) return replay;
    const subscription = this.subscriptions.get(subscriptionId); if (!subscription) throw new Error('Subscription not found.');
    if (!allowedTransitions[subscription.status].includes(action)) throw new Error(`Cannot ${action} an ${subscription.status} subscription`);
    if (action === 'cancel') subscription.status = 'canceled';
    if (action === 'pause') subscription.status = 'paused';
    if (action === 'resume') subscription.status = 'active';
    if (action === 'resubscribe') subscription.status = 'resubscribed';
    if (action === 'skip') { subscription.skipped = true; subscription.nextShipDate = 'Saturday, Dec 20'; }
    if (action === 'delay') { subscription.nextShipDate = delayTo ?? 'Saturday, Dec 6'; }
    this.actionsByKey.set(idempotencyKey, { ...subscription });
    return { ...subscription };
  }

  async processShipDay(subscriptionId: string): Promise<void> {
    const subscription = this.subscriptions.get(subscriptionId); if (!subscription) throw new Error('Subscription not found.');
    if ((this.inventory.get(subscription.variantId) ?? 0) <= 0) { subscription.nextShipDate = 'Saturday, Dec 6'; this.notifications.push(`OUT_OF_STOCK_DELAY:${subscriptionId}`); }
  }
  getSubscription(subscriptionId: string): Subscription | undefined { const subscription = this.subscriptions.get(subscriptionId); return subscription && { ...subscription }; }
  availableStock(variantId: string): number { this.expireReservations(); return this.inventory.get(variantId) ?? 0; }
  reservationCount(): number { return [...this.reservations.values()].filter((reservation) => reservation.status === 'active').length; }
  notificationCount(): number { return this.notifications.length; }
  private expireReservations(): void { for (const reservation of this.reservations.values()) if (reservation.status === 'active' && reservation.expiresAt.getTime() <= Date.now()) { reservation.status = 'expired'; this.inventory.set(reservation.variantId, (this.inventory.get(reservation.variantId) ?? 0) + reservation.quantity); } }
}
