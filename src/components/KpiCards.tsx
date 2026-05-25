"use client";

/**
 * KpiCards — 4-tile grid of headline metrics for a sales section.
 * Phase B: stub. Phase D will render Sales count · Revenue · Fees ·
 * Net earnings cards with proper currency formatting (mirrors the
 * existing TicketSalesSection 4-card layout).
 */

import React from "react";
import type { SalesSummary } from "../types";

export interface KpiCardsProps {
    summary: SalesSummary | null;
    currency: string;
    loading?: boolean;
}

export function KpiCards(_props: KpiCardsProps): React.ReactElement {
    return <div data-testid="kpi-cards" aria-hidden="true" />;
}
