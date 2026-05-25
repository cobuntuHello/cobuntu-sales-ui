"use client";

/**
 * SalesSection — the top-level component the host page mounts. Phase
 * D ties together:
 *   - useSalesData hook (fetches /api/communities/:tag/sales, filters
 *     by entity type + id, drops refunded rows)
 *   - KpiCards (4-tile summary)
 *   - CSV export
 *   - SalesList (rows with Refund + row-click → drawer)
 *   - SaleDetailDrawer (slide-in fee + timeline + refund button)
 *   - RefundSaleModal (the Phase C dialog)
 *
 * One mount point for both event-management and product-management
 * pages — `entityType` prop switches the wording + the filter.
 */

import React, { useState, useCallback } from "react";
import type { EntityType, SaleRow } from "../types";
import { useSalesData } from "../useSalesData";
import { KpiCards } from "./KpiCards";
import { SalesList } from "./SalesList";
import { SaleDetailDrawer } from "./SaleDetailDrawer";
import { RefundSaleModal } from "./RefundSaleModal";

export interface SalesSectionProps {
    communityTag: string;
    entityType: EntityType;
    entityId: string;
    timeRange?: string;
    /** Optional subtitle for the Sales count card (e.g. event hosts
     *  may want "of 50 capacity"). */
    countSubtitle?: string;
    /** Optional currency override for KPI cards. Defaults to the
     *  first sale's currency, falling back to "EUR" when empty. */
    currency?: string;
    /** Filename for the CSV export. Defaults to a generic name based
     *  on entityType + entityId. */
    csvFilename?: string;
}

function toCsv(rows: SaleRow[]): string {
    const headers = ["Name", "Usertag", "Email", "Amount", "Currency", "Fees", "Net", "Status", "Date"];
    const data = rows.map((s) => [
        s.buyer?.name ?? "",
        s.buyer?.usertag ? `@${s.buyer.usertag}` : "",
        s.buyerEmail ?? "",
        (s.grossAmount / 100).toFixed(2),
        s.currency,
        ((s.platformFee + (s.stripeFees ?? 0) + (s.stripeTaxFee ?? 0)) / 100).toFixed(2),
        (s.ownerNetPayout / 100).toFixed(2),
        s.payoutStatus,
        new Date(s.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }),
    ]);
    return [headers, ...data]
        .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
        .join("\n");
}

export function SalesSection(props: SalesSectionProps): React.ReactElement {
    const {
        communityTag,
        entityType,
        entityId,
        timeRange,
        countSubtitle,
        currency: currencyOverride,
        csvFilename,
    } = props;

    const { sales, loading, error, refetch } = useSalesData({
        communityTag,
        entityType,
        entityId,
        timeRange,
    });
    const [drawerSale, setDrawerSale] = useState<SaleRow | null>(null);
    const [refundSale, setRefundSale] = useState<SaleRow | null>(null);

    const currency = currencyOverride ?? sales[0]?.currency ?? "EUR";

    const handleExport = useCallback(() => {
        if (sales.length === 0) return;
        const csv = toCsv(sales);
        const blob = new Blob([csv], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = csvFilename ?? `${entityType}-${entityId}-sales.csv`;
        a.click();
        URL.revokeObjectURL(url);
    }, [sales, entityType, entityId, csvFilename]);

    return (
        <section
            data-testid="sales-section"
            data-entity-type={entityType}
            data-entity-id={entityId}
            data-community-tag={communityTag}
        >
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-zinc-900">
                    {entityType === "event" ? "Ticket sales" : "Product sales"}
                </h3>
                {sales.length > 0 && (
                    <button
                        type="button"
                        onClick={handleExport}
                        data-testid="sales-export-csv"
                        className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium text-zinc-600 border border-zinc-200 rounded-lg hover:bg-zinc-50 cursor-pointer"
                    >
                        Export CSV
                    </button>
                )}
            </div>

            <KpiCards
                sales={sales}
                currency={currency}
                loading={loading}
                countSubtitle={countSubtitle}
            />

            {error && (
                <div data-testid="sales-error" role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {error}
                </div>
            )}

            <SalesList
                sales={sales}
                loading={loading}
                onRowClick={(s) => setDrawerSale(s)}
                onRefundClick={(s) => setRefundSale(s)}
            />

            <SaleDetailDrawer
                sale={drawerSale}
                open={drawerSale !== null}
                onClose={() => setDrawerSale(null)}
                onRefundClick={(s) => {
                    setDrawerSale(null);
                    setRefundSale(s);
                }}
            />

            <RefundSaleModal
                sale={refundSale}
                communityTag={communityTag}
                open={refundSale !== null}
                onClose={() => setRefundSale(null)}
                onRefunded={() => {
                    setRefundSale(null);
                    refetch();
                }}
            />
        </section>
    );
}
