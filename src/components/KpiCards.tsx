"use client";

/**
 * KpiCards — 4-tile grid of headline metrics. Mirrors the existing
 * admin event-detail TicketSalesSection card layout so a host who's
 * already used the events surface sees the same shape on products.
 */

import React from "react";
import type { SaleRow } from "../types";
import { useSalesUiConfig } from "../config";

export interface KpiCardsProps {
    sales: SaleRow[];
    currency: string;
    loading?: boolean;
    /** Optional secondary text for the "Sales count" card. For events
     *  the consumer can pass e.g. "of 50 capacity" — for products,
     *  typically "active sales". */
    countSubtitle?: string;
}

function formatCurrency(amountCents: number, currency: string, locale: string): string {
    try {
        return new Intl.NumberFormat(locale, {
            style: "currency",
            currency: currency.toUpperCase(),
        }).format(amountCents / 100);
    } catch {
        return `${(amountCents / 100).toFixed(2)} ${currency.toUpperCase()}`;
    }
}

export function KpiCards(props: KpiCardsProps): React.ReactElement {
    const { sales, currency, loading, countSubtitle } = props;
    const { locale = "en-US" } = useSalesUiConfig();

    if (loading) {
        return (
            <div data-testid="kpi-cards" className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[0, 1, 2, 3].map((i) => (
                    <div key={i} className="rounded-xl border border-zinc-200 bg-white p-5">
                        <div className="h-3 w-16 bg-zinc-100 rounded animate-pulse mb-3" />
                        <div className="h-7 w-24 bg-zinc-100 rounded animate-pulse mb-2" />
                        <div className="h-3 w-20 bg-zinc-50 rounded animate-pulse" />
                    </div>
                ))}
            </div>
        );
    }

    const salesCount = sales.length;
    const totalRevenue = sales.reduce((sum, s) => sum + s.grossAmount, 0);
    const totalFees = sales.reduce(
        (sum, s) => sum + s.platformFee + (s.stripeFees ?? 0) + (s.stripeTaxFee ?? 0),
        0,
    );
    const netEarnings = sales.reduce((sum, s) => sum + s.ownerNetPayout, 0);

    return (
        <div data-testid="kpi-cards" className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-xl border border-zinc-200 bg-white p-5">
                <p className="text-xs text-zinc-500">Sales</p>
                <p data-testid="kpi-sales-count" className="text-2xl font-semibold text-zinc-900 mt-1 tabular-nums">{salesCount}</p>
                <p className="text-xs text-zinc-400 mt-1">{countSubtitle ?? "active sales"}</p>
            </div>
            <div className="rounded-xl border border-zinc-200 bg-white p-5">
                <p className="text-xs text-zinc-500">Revenue</p>
                <p data-testid="kpi-revenue" className="text-2xl font-semibold text-zinc-900 mt-1 tabular-nums">{formatCurrency(totalRevenue, currency, locale)}</p>
                <p className="text-xs text-zinc-400 mt-1">{salesCount} transactions, gross</p>
            </div>
            <div className="rounded-xl border border-zinc-200 bg-white p-5">
                <p className="text-xs text-zinc-500">Fees paid</p>
                <p data-testid="kpi-fees" className="text-2xl font-semibold text-zinc-900 mt-1 tabular-nums">{formatCurrency(totalFees, currency, locale)}</p>
                <p className="text-xs text-zinc-400 mt-1">Platform + Stripe</p>
            </div>
            <div className="rounded-xl border border-zinc-200 bg-white p-5">
                <p className="text-xs text-zinc-500">Net earnings</p>
                <p data-testid="kpi-net" className="text-2xl font-semibold text-emerald-600 mt-1 tabular-nums">{formatCurrency(netEarnings, currency, locale)}</p>
                <p className="text-xs text-zinc-400 mt-1">After all fees</p>
            </div>
        </div>
    );
}
