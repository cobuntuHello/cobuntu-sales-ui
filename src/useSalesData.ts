"use client";

/**
 * useSalesData — fetches the sales feed from
 * GET /api/communities/:tag/sales then filters client-side by entity
 * type + id.
 *
 * The endpoint returns ALL sales for the community (events + products
 * + memberships); we filter locally so the same endpoint serves both
 * event-detail and product-detail mounts. Mirrors the existing
 * cobuntu-admin TicketSalesSection fetch pattern.
 *
 * Refunded sales (refundStatus === "FULL") are filtered out of the
 * list shown to hosts — the host UI is for active, refundable sales.
 * Refund-history surfacing is a separate future surface (not in scope
 * for this umbrella).
 */

import { useEffect, useState } from "react";
import { useSalesUiConfig } from "./config";
import type { EntityType, SaleRow, SalesSummary } from "./types";

interface UseSalesDataParams {
    communityTag: string;
    entityType: EntityType;
    entityId: string;
    timeRange?: string;
}

interface SalesDataState {
    sales: SaleRow[];
    summary: SalesSummary | null;
    loading: boolean;
    error: string | null;
    /** Refetches the sales feed. Parent calls this after a refund
     *  succeeds so the just-refunded sale drops out + the KPI cards
     *  refresh. */
    refetch: () => void;
}

export function useSalesData(params: UseSalesDataParams): SalesDataState {
    const { communityTag, entityType, entityId, timeRange = "1y" } = params;
    const { apiBaseUrl, getAuthHeaders } = useSalesUiConfig();
    const [sales, setSales] = useState<SaleRow[]>([]);
    const [summary, setSummary] = useState<SalesSummary | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [tick, setTick] = useState(0);

    useEffect(() => {
        let cancelled = false;
        async function load() {
            setLoading(true);
            setError(null);
            try {
                const auth = await getAuthHeaders();
                const res = await fetch(
                    `${apiBaseUrl}/communities/${communityTag}/sales?timeRange=${encodeURIComponent(timeRange)}`,
                    { headers: auth },
                );
                if (!res.ok) {
                    throw new Error(`Sales feed responded ${res.status}`);
                }
                const data = await res.json();
                const all: SaleRow[] = data.sales || [];
                const filtered = all.filter((s) => {
                    if (s.refundStatus === "FULL") return false;
                    if (entityType === "event") return s.eventId === entityId;
                    return s.productSnapshot?.id === entityId;
                });
                if (cancelled) return;
                setSales(filtered);
                setSummary(data.summary ?? null);
            } catch (err: any) {
                if (cancelled) return;
                setError(err?.message ?? "Failed to load sales");
            } finally {
                if (!cancelled) setLoading(false);
            }
        }
        void load();
        return () => { cancelled = true; };
    }, [apiBaseUrl, communityTag, entityType, entityId, timeRange, tick]);

    return {
        sales,
        summary,
        loading,
        error,
        refetch: () => setTick((t) => t + 1),
    };
}
