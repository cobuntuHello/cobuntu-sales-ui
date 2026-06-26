"use client";

/**
 * SalesList — the sales table with one row per sale. Each row has:
 *   - Buyer (name + email)
 *   - Amount (gross, currency-formatted)
 *   - Status (payout state)
 *   - Date
 *   - Actions (Refund button — disabled past escrow with a tooltip
 *     explaining the policy)
 *
 * Row click opens the detail drawer; the action button is stop-
 * propagation so refunding doesn't also open the drawer.
 */

import React from "react";
import type { SaleRow } from "../types";
import { useSalesUiConfig } from "../config";

export interface SalesListProps {
    sales: SaleRow[];
    loading?: boolean;
    onRefundClick?: (sale: SaleRow) => void;
    onRowClick?: (sale: SaleRow) => void;
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

function formatDate(iso: string, locale: string): string {
    try {
        return new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric" }).format(new Date(iso));
    } catch {
        return iso;
    }
}

export function SalesList(props: SalesListProps): React.ReactElement {
    const { sales, loading, onRefundClick, onRowClick } = props;
    const { locale = "en-US" } = useSalesUiConfig();

    if (loading) {
        return (
            <div data-testid="sales-list" className="mt-6 overflow-hidden rounded-xl border border-zinc-200 bg-white">
                <div className="p-8 text-center text-sm text-zinc-400">Loading sales…</div>
            </div>
        );
    }

    if (sales.length === 0) {
        return (
            <div data-testid="sales-list" className="mt-6 overflow-hidden rounded-xl border border-zinc-200 bg-white">
                <div className="p-8 text-center text-sm text-zinc-500">No sales yet.</div>
            </div>
        );
    }

    return (
        <div data-testid="sales-list" className="mt-6 overflow-hidden rounded-xl border border-zinc-200 bg-white">
            <table className="w-full text-left text-sm">
                <thead className="bg-zinc-50 text-xs uppercase text-zinc-500">
                    <tr>
                        <th className="px-4 py-3 font-medium">Buyer</th>
                        <th className="px-4 py-3 font-medium">Amount</th>
                        <th className="px-4 py-3 font-medium">Status</th>
                        <th className="px-4 py-3 font-medium">Date</th>
                        <th className="px-4 py-3 font-medium text-right">Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {sales.map((sale) => {
                        const canRefund = sale.payoutStatus === "ESCROW" || sale.payoutStatus === "HOLD";
                        return (
                            <tr
                                key={sale.id}
                                data-testid={`sales-row-${sale.id}`}
                                className={`border-t border-zinc-100 ${onRowClick ? "cursor-pointer hover:bg-zinc-50" : ""}`}
                                onClick={() => onRowClick?.(sale)}
                            >
                                <td className="px-4 py-3">
                                    <div className="font-medium text-zinc-900">{sale.buyer?.name || "—"}</div>
                                    {sale.buyerEmail && (
                                        <div className="text-xs text-zinc-500">{sale.buyerEmail}</div>
                                    )}
                                </td>
                                <td className="px-4 py-3 tabular-nums">
                                    {formatCurrency(sale.grossAmount, sale.currency, locale)}
                                </td>
                                <td className="px-4 py-3 text-xs text-zinc-500">{sale.payoutStatus}</td>
                                <td className="px-4 py-3 text-xs text-zinc-500">{formatDate(sale.createdAt, locale)}</td>
                                <td className="px-4 py-3 text-right">
                                    <button
                                        type="button"
                                        disabled={!canRefund || !onRefundClick}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            if (canRefund) onRefundClick?.(sale);
                                        }}
                                        title={canRefund ? "Refund this sale" : "Refund window has passed — contact Cobuntu support to escalate."}
                                        data-testid={`refund-button-${sale.id}`}
                                        className={`px-3 py-1.5 text-xs font-medium rounded-lg border ${canRefund ? "border-zinc-200 text-zinc-700 hover:bg-zinc-50 cursor-pointer" : "border-zinc-100 text-zinc-300 cursor-not-allowed"}`}
                                    >
                                        Refund
                                    </button>
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}
