/**
 * Shared types for sales-ui components. Mirrors the shape returned by
 * GET /api/communities/:tag/sales — see
 * services/finances/src/modules/sales/CommunityAnalyticsController.ts
 * (`getCommunitySalesController`) for the canonical producer.
 *
 * Phase B scope: types only. Phase C and D consume them in the
 * components. The shape is duplicated (not imported from the backend)
 * because the sales-ui pkg has no dependency on the backend monorepo
 * — Vercel builds clone this repo standalone.
 */

// Payout reform: HOLD replaces the retired BLOCKED state. A HOLD sale is
// ELIGIBLE money the daily sweep is accumulating below the payout threshold —
// it is still in Cobuntu's balance (nothing paid out), so it stays refundable.
export type SalePayoutStatus = "ESCROW" | "ELIGIBLE" | "PAID" | "HOLD";
export type SaleRefundStatus = "NONE" | "PARTIAL" | "FULL" | "PENDING" | "DISPUTED" | "DISPUTE_WON" | "DISPUTE_LOST";

export interface SaleBuyer {
    id: string;
    name: string | null;
    usertag: string | null;
}

export interface SaleRow {
    id: string;
    createdAt: string;                  // ISO timestamp
    eventId: string | null;
    productSnapshot: { id: string; name: string } | null;
    buyer: SaleBuyer;
    buyerEmail: string | null;
    grossAmount: number;                // smallest unit (cents)
    ownerNetPayout: number;             // smallest unit
    platformFee: number;
    stripeFees: number | null;
    stripeTaxFee: number | null;
    refundStatus: SaleRefundStatus | null;
    payoutStatus: SalePayoutStatus;
    currency: string;                   // upper-case ISO ("EUR")
    eligibleForPayoutAt: string | null;
    scheduledPayoutAt: string | null;
    paidOutAt: string | null;
    transaction: { id: string; status: string | null; totalAmount: number | null; currency: string | null };
    // Populated only when refundStatus !== 'NONE'. Powers the admin
    // event manage page's "Refunded" tab: who got refunded, when, why,
    // for how much, and a link to the Stripe credit-note PDF. Batched
    // server-side so a list of N sales costs 2 extra queries total
    // (refunds + credit-note invoices), not 2N.
    refund?: {
        id: string;
        createdAt: string;
        amount: number;
        reason: string | null;
        /**
         * Populated when the refund was issued past the standard
         * window under the event's extended-mode refund policy
         * (feat/configurable-event-refund-policy, 2026-06-18). NULL
         * on every standard ESCROW refund. Surfaces in the admin
         * Refunded-tab + the credit-note PDF.
         */
        bypassReason?: string | null;
    } | null;
    creditNote?: {
        id: string;
        stripeInvoicePdf: string | null;
        stripeHostedUrl: string | null;
    } | null;
}

export interface SalesSummary {
    totalRevenue: number;
    totalSales: number;
    totalPayouts: number;
    pendingPayouts: number;
    platformFeesPaid: number | null;
}

export type EntityType = "event" | "product";
