import { describe, expect, it } from 'vitest';
import { calculatePrice, type CustomerHistory, type Promotion, type Variant } from './calculatePrice.js';

const now = new Date('2026-11-09T12:00:00.000Z');
const variant: Variant = { id: 'variant-chicken-15', flavor: 'Chicken', size: '15 lb', priceCents: 5000, autoshipEligible: true };
const newCustomer: CustomerHistory = { hasRedeemedFirstAutoshipOffer: false };
const returningCustomer: CustomerHistory = { hasRedeemedFirstAutoshipOffer: true };

function welcomePromotion(overrides: Partial<Promotion> = {}): Promotion {
  return {
    id: 'welcome-autoship',
    priority: 100,
    startsAt: new Date('2026-01-01T00:00:00.000Z'),
    endsAt: new Date('2026-12-31T23:59:59.999Z'),
    eligibleFlavors: ['Chicken'],
    eligibleSizes: ['15 lb'],
    firstOrderPercentBps: 3500,
    firstOrderCapCents: 2000,
    recurringPercentBps: 500,
    ...overrides,
  };
}

describe('calculatePrice', () => {
  it('applies 35% to a first Autoship order when the discount is below the cap', () => {
    expect(calculatePrice(variant, newCustomer, [welcomePromotion()], now)).toMatchObject({
      subtotalCents: 5000, discountCents: 1750, totalCents: 3250, appliedPromotionId: 'welcome-autoship', reason: 'first_autoship_offer',
    });
  });

  it('caps the first Autoship discount at 2000 cents for a $70 item', () => {
    const seventyDollarVariant = { ...variant, priceCents: 7000 };
    expect(calculatePrice(seventyDollarVariant, newCustomer, [welcomePromotion()], now)).toMatchObject({
      subtotalCents: 7000, discountCents: 2000, totalCents: 5000, appliedPromotionId: 'welcome-autoship',
    });
  });

  it('applies only the 5% Autoship discount after the first offer was redeemed', () => {
    expect(calculatePrice(variant, returningCustomer, [welcomePromotion()], now)).toMatchObject({
      discountCents: 250, totalCents: 4750, appliedPromotionId: 'welcome-autoship', reason: 'recurring_autoship_offer',
    });
  });

  it('does not restore the first-order offer after a customer cancels and re-subscribes', () => {
    const canceledThenResubscribed: CustomerHistory = { hasRedeemedFirstAutoshipOffer: true, hasCanceledAutoship: true };
    expect(calculatePrice(variant, canceledThenResubscribed, [welcomePromotion()], now)).toMatchObject({
      discountCents: 250, reason: 'recurring_autoship_offer',
    });
  });

  it('does not apply a promotion to an ineligible flavor or size', () => {
    const ineligibleVariant = { ...variant, flavor: 'Beef', size: '30 lb' };
    expect(calculatePrice(ineligibleVariant, newCustomer, [welcomePromotion()], now)).toEqual({
      subtotalCents: 5000, discountCents: 0, totalCents: 5000, appliedPromotionId: null, reason: 'no_eligible_promotion',
    });
  });

  it('does not apply an expired promotion', () => {
    const expired = welcomePromotion({ endsAt: new Date('2026-11-08T23:59:59.999Z') });
    expect(calculatePrice(variant, newCustomer, [expired], now)).toEqual({
      subtotalCents: 5000, discountCents: 0, totalCents: 5000, appliedPromotionId: null, reason: 'no_eligible_promotion',
    });
  });

  it('uses the highest priority eligible promotion when offers overlap and never stacks them', () => {
    const lowerPriority = welcomePromotion({ id: 'lower-priority', priority: 10, firstOrderPercentBps: 5000, firstOrderCapCents: 5000 });
    const higherPriority = welcomePromotion({ id: 'higher-priority', priority: 20, firstOrderPercentBps: 1000, firstOrderCapCents: 5000 });
    expect(calculatePrice(variant, newCustomer, [lowerPriority, higherPriority], now)).toMatchObject({
      discountCents: 500, totalCents: 4500, appliedPromotionId: 'higher-priority',
    });
  });
});
