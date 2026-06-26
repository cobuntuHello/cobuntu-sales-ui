"use client";

/**
 * SaleDetailDrawer — slide-in panel showing the full sale's payout
 * timeline + fee breakdown + Refund button. Mirrors the existing
 * cobuntu-admin /sales detail drawer.
 */

import React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import type { SaleRow } from "../types";
import { useSalesUiConfig } from "../config";

export interface SaleDetailDrawerProps {
    sale: SaleRow | null;
    open: boolean;
    onClose: () => void;
    onRefundClick?: (sale: SaleRow) => void;
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

function formatDate(iso: string | null, locale: string): string {
    if (!iso) return "—";
    try {
        return new Intl.DateTimeFormat(locale, {
            day: "numeric", month: "short", year: "numeric",
            hour: "2-digit", minute: "2-digit",
        }).format(new Date(iso));
    } catch {
        return iso;
    }
}

export function SaleDetailDrawer(props: SaleDetailDrawerProps): React.ReactElement | null {
    const { sale, open, onClose, onRefundClick } = props;
    const { locale = "en-US" } = useSalesUiConfig();

    if (!sale) return null;

    const totalFees = sale.platformFee + (sale.stripeFees ?? 0) + (sale.stripeTaxFee ?? 0);
    const canRefund = sale.payoutStatus === "ESCROW" || sale.payoutStatus === "HOLD";

    return (
        <Dialog.Root open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
            <Dialog.Portal>
                <Dialog.Overlay data-testid="sale-detail-overlay" className="fixed inset-0 bg-zinc-900/40" />
                <Dialog.Content data-testid="sale-detail-drawer" className="fixed inset-y-0 right-0 w-full max-w-md bg-white shadow-xl p-6 overflow-y-auto">
                    <Dialog.Title className="text-base font-semibold text-zinc-900">Sale detail</Dialog.Title>
                    <Dialog.Description className="text-xs text-zinc-500 mt-1">
                        {sale.eventId ? "Event ticket" : "Product"} · {formatDate(sale.createdAt, locale)}
                    </Dialog.Description>

                    <section className="mt-6">
                        <h3 className="text-xs uppercase text-zinc-500 mb-2">Buyer</h3>
                        <p data-testid="drawer-buyer-name" className="font-medium text-zinc-900">{sale.buyer?.name || "—"}</p>
                        {sale.buyerEmail && <p className="text-xs text-zinc-500">{sale.buyerEmail}</p>}
                    </section>

                    <section className="mt-6">
                        <h3 className="text-xs uppercase text-zinc-500 mb-2">Fee breakdown</h3>
                        <dl className="text-sm">
                            <div className="flex justify-between py-1"><dt className="text-zinc-500">Gross</dt><dd data-testid="drawer-gross" className="tabular-nums">{formatCurrency(sale.grossAmount, sale.currency, locale)}</dd></div>
                            <div className="flex justify-between py-1"><dt className="text-zinc-500">Platform fee</dt><dd className="tabular-nums">{formatCurrency(sale.platformFee, sale.currency, locale)}</dd></div>
                            <div className="flex justify-between py-1"><dt className="text-zinc-500">Stripe fee</dt><dd className="tabular-nums">{formatCurrency(sale.stripeFees ?? 0, sale.currency, locale)}</dd></div>
                            <div className="flex justify-between py-1"><dt className="text-zinc-500">Stripe tax</dt><dd className="tabular-nums">{formatCurrency(sale.stripeTaxFee ?? 0, sale.currency, locale)}</dd></div>
                            <div className="flex justify-between py-1 border-t border-zinc-100 mt-2 pt-2"><dt className="text-zinc-700">Total fees</dt><dd className="tabular-nums font-medium">{formatCurrency(totalFees, sale.currency, locale)}</dd></div>
                            <div className="flex justify-between py-1"><dt className="text-zinc-700">Net to you</dt><dd data-testid="drawer-net" className="tabular-nums font-semibold text-emerald-600">{formatCurrency(sale.ownerNetPayout, sale.currency, locale)}</dd></div>
                        </dl>
                    </section>

                    <section className="mt-6">
                        <h3 className="text-xs uppercase text-zinc-500 mb-2">Payout timeline</h3>
                        <dl className="text-sm">
                            <div className="flex justify-between py-1"><dt className="text-zinc-500">Status</dt><dd data-testid="drawer-payout-status">{sale.payoutStatus}</dd></div>
                            <div className="flex justify-between py-1"><dt className="text-zinc-500">Eligible for payout</dt><dd>{formatDate(sale.eligibleForPayoutAt, locale)}</dd></div>
                            <div className="flex justify-between py-1"><dt className="text-zinc-500">Scheduled payout</dt><dd>{formatDate(sale.scheduledPayoutAt, locale)}</dd></div>
                            <div className="flex justify-between py-1"><dt className="text-zinc-500">Paid out</dt><dd>{formatDate(sale.paidOutAt, locale)}</dd></div>
                        </dl>
                    </section>

                    <div className="mt-8 flex items-center justify-end gap-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-3 py-1.5 text-xs font-medium text-zinc-600 border border-zinc-200 rounded-lg hover:bg-zinc-50 cursor-pointer"
                        >
                            Close
                        </button>
                        {onRefundClick && (
                            <button
                                type="button"
                                disabled={!canRefund}
                                onClick={() => onRefundClick(sale)}
                                title={canRefund ? "Refund this sale" : "Refund window has passed — contact Cobuntu support to escalate."}
                                data-testid="drawer-refund-button"
                                className={`px-3 py-1.5 text-xs font-medium rounded-lg border ${canRefund ? "border-zinc-200 text-zinc-700 hover:bg-zinc-50 cursor-pointer" : "border-zinc-100 text-zinc-300 cursor-not-allowed"}`}
                            >
                                Refund
                            </button>
                        )}
                    </div>
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    );
}
