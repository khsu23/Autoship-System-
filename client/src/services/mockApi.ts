import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

export type Variant = { id: string; flavor: string; size: string; priceCents: number; promoEligible: boolean };
type ProductPayload = { product: { name: string; brand: string; rating: string; reviewCount: string; description: string }; variants: Variant[] };
type CheckoutPayload = { variant: Variant; discountCents: number; subtotalCents: number; totalCents: number; address: { name: string; line1: string; city: string; state: string; zip: string } };
type SubscriptionPayload = { id: string; variant: Variant; status: string; cadence: string; nextShipDate: string; address: string; outOfStock: boolean };
export const toMoney = (cents: number) => `$${(cents / 100).toFixed(2)}`;

export const mockApi = createApi({
  reducerPath: 'mockApi', baseQuery: fetchBaseQuery({ baseUrl: '/api/' }),
  endpoints: (builder) => ({
    getProduct: builder.query<ProductPayload, void>({ query: () => 'catalog/product' }),
    getCheckout: builder.query<CheckoutPayload, string>({ query: (variantId) => `checkout-preview/${variantId}` }),
    getSubscription: builder.query<SubscriptionPayload, string>({ query: (id) => `subscriptions/${id}` }),
    checkout: builder.mutation({ query: (body) => ({ url: 'checkout', method: 'POST', body }) }),
    subscriptionAction: builder.mutation({ query: ({ id, action, ...body }) => ({ url: `subscriptions/${id}/${action}`, method: 'POST', body }) }),
    askPolicy: builder.mutation({ query: (body) => ({ url: 'policy/ask', method: 'POST', body }) }),
    askAssistant: builder.mutation({ query: (body) => ({ url: 'assistant/messages', method: 'POST', body }) }),
    confirmAssistantAction: builder.mutation({ query: (body) => ({ url: 'assistant/actions/confirm', method: 'POST', body }) }),
  }),
});
export const { useGetProductQuery, useGetCheckoutQuery, useGetSubscriptionQuery, useCheckoutMutation, useSubscriptionActionMutation, useAskPolicyMutation, useAskAssistantMutation, useConfirmAssistantActionMutation } = mockApi;
