export type Variant = Readonly<{
  id: string;
  flavor: string;
  size: string;
  priceCents: number;
  autoshipEligible: boolean;
}>;

export type CustomerHistory = Readonly<{
  hasRedeemedFirstAutoshipOffer: boolean;
  hasCanceledAutoship?: boolean;
}>;

export type Promotion = Readonly<{
  id: string;
  priority: number;
  startsAt: Date;
  endsAt: Date | null;
  eligibleFlavors: readonly string[];
  eligibleSizes: readonly string[];
  firstOrderPercentBps: number;
  firstOrderCapCents: number;
  recurringPercentBps: number;
}>;

export type PriceReason = 'first_autoship_offer' | 'recurring_autoship_offer' | 'no_eligible_promotion';

export type PriceCalculation = Readonly<{
  subtotalCents: number;
  discountCents: number;
  totalCents: number;
  appliedPromotionId: string | null;
  reason: PriceReason;
}>;

function assertNonNegativeInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative safe integer`);
  }
}

function isEligibleForVariant(promotion: Promotion, variant: Variant): boolean {
  return promotion.eligibleFlavors.includes(variant.flavor) && promotion.eligibleSizes.includes(variant.size);
}

function isActiveAt(promotion: Promotion, now: Date): boolean {
  return promotion.startsAt.getTime() <= now.getTime()
    && (promotion.endsAt === null || now.getTime() <= promotion.endsAt.getTime());
}

function calculatePercentDiscount(subtotalCents: number, percentBps: number): number {
  assertNonNegativeInteger(percentBps, 'percentBps');
  if (percentBps > 10_000) {
    throw new Error('percentBps cannot exceed 10000');
  }

  // Basis points and cents make this integer-only; fractional cents round down.
  return Math.floor((subtotalCents * percentBps) / 10_000);
}

/**
 * Quotes one Autoship item. Promotions are sorted by descending priority, then
 * promotion ID for deterministic ties; exactly one promotion can be selected.
 */
export function calculatePrice(
  variant: Variant,
  customerHistory: CustomerHistory,
  promotions: readonly Promotion[],
  now: Date,
): PriceCalculation {
  assertNonNegativeInteger(variant.priceCents, 'variant.priceCents');

  if (!variant.autoshipEligible) {
    return noPromotion(variant.priceCents);
  }

  const applicablePromotions = promotions
    .filter((promotion) => isActiveAt(promotion, now) && isEligibleForVariant(promotion, variant))
    .sort((left, right) => right.priority - left.priority || left.id.localeCompare(right.id));
  const promotion = applicablePromotions[0];

  if (promotion === undefined) {
    return noPromotion(variant.priceCents);
  }

  if (!customerHistory.hasRedeemedFirstAutoshipOffer) {
    assertNonNegativeInteger(promotion.firstOrderCapCents, 'firstOrderCapCents');
    const percentageDiscount = calculatePercentDiscount(variant.priceCents, promotion.firstOrderPercentBps);
    const discountCents = Math.min(percentageDiscount, promotion.firstOrderCapCents);
    return pricedResult(variant.priceCents, discountCents, promotion.id, 'first_autoship_offer');
  }

  const discountCents = calculatePercentDiscount(variant.priceCents, promotion.recurringPercentBps);
  return pricedResult(variant.priceCents, discountCents, promotion.id, 'recurring_autoship_offer');
}

function noPromotion(subtotalCents: number): PriceCalculation {
  return pricedResult(subtotalCents, 0, null, 'no_eligible_promotion');
}

function pricedResult(
  subtotalCents: number,
  discountCents: number,
  appliedPromotionId: string | null,
  reason: PriceReason,
): PriceCalculation {
  return {
    subtotalCents,
    discountCents,
    totalCents: subtotalCents - discountCents,
    appliedPromotionId,
    reason,
  };
}
