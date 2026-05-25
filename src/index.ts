// @cobuntu/sales-ui — public exports
//
// Shared sales-visibility + host-refund UI consumed by `cobuntu-admin`
// and `cobuntu-community-app`. Single source of truth for the sales
// section + per-sale refund modal that mounts on both event detail
// pages and product detail pages.
//
// Phase B (this commit): scaffold + shells. Phase C and D fill in the
// real component bodies.

// ── Config ───────────────────────────────────────────────────────
export {
    SalesUiConfigProvider,
    useSalesUiConfig,
    type SalesUiConfig,
} from "./config";

// ── Components ───────────────────────────────────────────────────
export { SalesSection, type SalesSectionProps } from "./components/SalesSection";
export { KpiCards, type KpiCardsProps } from "./components/KpiCards";
export { SalesList, type SalesListProps } from "./components/SalesList";
export { SaleDetailDrawer, type SaleDetailDrawerProps } from "./components/SaleDetailDrawer";
export { RefundSaleModal, type RefundSaleModalProps } from "./components/RefundSaleModal";

// ── Types ────────────────────────────────────────────────────────
export type {
    SaleRow,
    SaleBuyer,
    SalesSummary,
    SalePayoutStatus,
    SaleRefundStatus,
    EntityType,
} from "./types";
