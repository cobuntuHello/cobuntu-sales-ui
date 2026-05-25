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

export type SalePayoutStatus = "ESCROW" | "ELIGIBLE" | "PAID" | "BLOCKED";
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
}

export interface SalesSummary {
    totalRevenue: number;
    totalSales: number;
    totalPayouts: number;
    pendingPayouts: number;
    platformFeesPaid: number | null;
}

export type EntityType = "event" | "product";
