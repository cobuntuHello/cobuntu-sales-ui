"use client";

/**
 * SaleDetailDrawer — slide-in panel showing the full sale's payout
 * timeline + fee breakdown + Refund button. Mirrors the existing
 * cobuntu-admin /sales detail drawer.
 */

import React, { useCallback, useEffect, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import type { SaleRow } from "../types";
import { useSalesUiConfig } from "../config";

export interface SaleDetailDrawerProps {
    sale: SaleRow | null;
    open: boolean;
    onClose: () => void;
    onRefundClick?: (sale: SaleRow) => void;
    /** Needed to load + manage a product sale's deliverables (downloads, links,
     *  certificate). Absent for event sales, which have none. */
    communityTag?: string;
}

/** One deliverable in the per-sale summary (GET .../sales/:id/deliverables). */
interface Deliverable {
    id: string;
    name: string;
    kind: "FILE" | "LINK";
    downloadCount: number;
    lastDownloadedAt: string | null;
    maxDownloads: number | null;
    remaining: number | null;
    link: { token: string; openCount: number; lastOpenedAt: string | null; revoked: boolean } | null;
}
interface DeliverablesResponse {
    attachments: Deliverable[];
    hasCertificate: boolean;
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
    const { sale, open, onClose, onRefundClick, communityTag } = props;
    const { locale = "en-US", apiBaseUrl, getAuthHeaders } = useSalesUiConfig();

    // Product-sale deliverables (downloads / per-buyer links / certificate).
    const saleId = sale?.id ?? null;
    const isProductSale = !!sale && !sale.eventId && !!communityTag;
    const [deliverables, setDeliverables] = useState<DeliverablesResponse | null>(null);
    const [delivLoading, setDelivLoading] = useState(false);
    const [busyAttachment, setBusyAttachment] = useState<string | null>(null);
    const [copiedToken, setCopiedToken] = useState<string | null>(null);
    const [resentAttachment, setResentAttachment] = useState<string | null>(null);

    const loadDeliverables = useCallback(async () => {
        if (!isProductSale || !saleId) return;
        setDelivLoading(true);
        try {
            const headers = await getAuthHeaders();
            const res = await fetch(`${apiBaseUrl}/communities/${communityTag}/sales/${saleId}/deliverables`, { headers });
            if (res.ok) setDeliverables(await res.json());
            else setDeliverables(null);
        } catch {
            setDeliverables(null);
        } finally {
            setDelivLoading(false);
        }
    }, [isProductSale, saleId, apiBaseUrl, communityTag, getAuthHeaders]);

    // Load when the drawer opens on a product sale; clear on close/change.
    useEffect(() => {
        if (open && isProductSale) loadDeliverables();
        else { setDeliverables(null); setCopiedToken(null); setResentAttachment(null); }
    }, [open, isProductSale, saleId, loadDeliverables]);

    // Absolute link a buyer can open — apiBaseUrl may be relative ("/api").
    const linkUrlFor = useCallback((token: string) => {
        const base = apiBaseUrl.startsWith("http")
            ? apiBaseUrl
            : (typeof window !== "undefined" ? window.location.origin : "") + apiBaseUrl;
        return `${base}/link/${token}`;
    }, [apiBaseUrl]);

    const postLinkAction = useCallback(async (attachmentId: string, action: "generate" | "revoke" | "resend") => {
        if (!saleId || !communityTag) return;
        setBusyAttachment(attachmentId);
        try {
            const headers = { "Content-Type": "application/json", ...(await getAuthHeaders()) };
            const base = `${apiBaseUrl}/communities/${communityTag}/sales/${saleId}/link-tokens`;
            const url = action === "generate"
                ? base
                : `${base}/${attachmentId}/${action}`; // revoke | resend
            const body = action === "generate" ? JSON.stringify({ attachmentId }) : undefined;
            const res = await fetch(url, { method: "POST", headers, body });
            if (res.ok) {
                if (action === "resend") { setResentAttachment(attachmentId); setTimeout(() => setResentAttachment(null), 2000); }
                // resend may have minted/reissued a token; refresh either way.
                await loadDeliverables();
            }
        } finally {
            setBusyAttachment(null);
        }
    }, [saleId, communityTag, apiBaseUrl, getAuthHeaders, loadDeliverables]);

    const copyLink = useCallback(async (token: string) => {
        try { await navigator.clipboard.writeText(linkUrlFor(token)); setCopiedToken(token); setTimeout(() => setCopiedToken(null), 1500); } catch { /* clipboard denied */ }
    }, [linkUrlFor]);

    if (!sale) return null;

    const totalFees = sale.platformFee + (sale.stripeFees ?? 0) + (sale.stripeTaxFee ?? 0);
    const canRefund = sale.payoutStatus === "ESCROW" || sale.payoutStatus === "HOLD";
    const certificateUrl = communityTag ? `${apiBaseUrl}/communities/${communityTag}/sales/${sale.id}/license-certificate` : null;

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

                    {isProductSale && (
                        <section className="mt-6" data-testid="drawer-deliverables">
                            <h3 className="text-xs uppercase text-zinc-500 mb-2">Deliverables</h3>

                            {delivLoading && <p className="text-xs text-zinc-400">Loading…</p>}

                            {!delivLoading && deliverables && deliverables.attachments.length === 0 && (
                                <p className="text-xs text-zinc-400">No files or links on this product.</p>
                            )}

                            {!delivLoading && deliverables && deliverables.attachments.map((d) => (
                                <div key={d.id} className="py-2 border-b border-zinc-100 last:border-0">
                                    <div className="flex items-center justify-between gap-2">
                                        <p className="text-sm text-zinc-800 truncate">{d.name}</p>
                                        <span className="text-[10px] font-medium uppercase text-zinc-400 shrink-0">{d.kind}</span>
                                    </div>

                                    {d.kind === "FILE" ? (
                                        <p className="text-xs text-zinc-500 mt-0.5">
                                            {d.downloadCount} download{d.downloadCount === 1 ? "" : "s"}
                                            {d.lastDownloadedAt ? ` · last ${formatDate(d.lastDownloadedAt, locale)}` : ""}
                                            {d.maxDownloads != null ? ` · ${d.remaining ?? 0} of ${d.maxDownloads} left` : ""}
                                        </p>
                                    ) : (
                                        <div className="mt-1">
                                            {d.link ? (
                                                <>
                                                    <p className="text-xs text-zinc-500">
                                                        {d.link.revoked
                                                            ? "Link revoked"
                                                            : `${d.link.openCount} open${d.link.openCount === 1 ? "" : "s"}${d.link.lastOpenedAt ? ` · last ${formatDate(d.link.lastOpenedAt, locale)}` : ""}`}
                                                    </p>
                                                    <div className="flex flex-wrap items-center gap-2 mt-1.5">
                                                        {!d.link.revoked && (
                                                            <button type="button" onClick={() => copyLink(d.link!.token)}
                                                                className="px-2 py-1 text-[11px] font-medium text-zinc-700 border border-zinc-200 rounded-md hover:bg-zinc-50 cursor-pointer">
                                                                {copiedToken === d.link.token ? "Copied" : "Copy link"}
                                                            </button>
                                                        )}
                                                        {!d.link.revoked && (
                                                            <button type="button" disabled={busyAttachment === d.id} onClick={() => postLinkAction(d.id, "resend")}
                                                                className="px-2 py-1 text-[11px] font-medium text-zinc-700 border border-zinc-200 rounded-md hover:bg-zinc-50 disabled:opacity-40 cursor-pointer">
                                                                {resentAttachment === d.id ? "Sent ✓" : "Email to buyer"}
                                                            </button>
                                                        )}
                                                        <button type="button" disabled={busyAttachment === d.id} onClick={() => postLinkAction(d.id, "generate")}
                                                            className="px-2 py-1 text-[11px] font-medium text-zinc-700 border border-zinc-200 rounded-md hover:bg-zinc-50 disabled:opacity-40 cursor-pointer">
                                                            {d.link.revoked ? "Reissue link" : "Regenerate"}
                                                        </button>
                                                        {!d.link.revoked && (
                                                            <button type="button" disabled={busyAttachment === d.id} onClick={() => postLinkAction(d.id, "revoke")}
                                                                className="px-2 py-1 text-[11px] font-medium text-red-600 border border-red-100 rounded-md hover:bg-red-50 disabled:opacity-40 cursor-pointer">
                                                                Revoke
                                                            </button>
                                                        )}
                                                    </div>
                                                </>
                                            ) : (
                                                <button type="button" disabled={busyAttachment === d.id} onClick={() => postLinkAction(d.id, "generate")}
                                                    className="px-2 py-1 text-[11px] font-medium text-zinc-700 border border-zinc-200 rounded-md hover:bg-zinc-50 disabled:opacity-40 cursor-pointer">
                                                    Generate per-buyer link
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </div>
                            ))}

                            {!delivLoading && deliverables?.hasCertificate && certificateUrl && (
                                <a href={certificateUrl} target="_blank" rel="noopener noreferrer"
                                    data-testid="drawer-certificate-link"
                                    className="inline-flex items-center gap-1.5 mt-3 px-2.5 py-1.5 text-[11px] font-medium text-zinc-700 border border-zinc-200 rounded-md hover:bg-zinc-50 cursor-pointer">
                                    Download license certificate
                                </a>
                            )}
                        </section>
                    )}

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
