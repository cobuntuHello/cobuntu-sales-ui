"use client";

/**
 * RefundSaleModal — the per-sale refund confirmation dialog used by
 * both event-management and product-management sales sections.
 *
 * Phase C of host-refunds-and-sales-visibility. Wires up:
 *   - eligibility display (in-window / past-escrow / already-refunded)
 *   - required reason field with 500-char limit
 *   - confirm → POST /api/communities/:tag/sales/:saleId/refund
 *   - granular error messages (409 PAST_ESCROW, 409 ALREADY_REFUNDED,
 *     400 validation, generic 5xx)
 *
 * The modal is intentionally controlled (open + onClose passed in by
 * the parent) so the parent owns the "which sale is being refunded"
 * state and can sequence modals + drawers without internal state
 * leaking between renders.
 */

import React, { useState, useEffect } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import type { SaleRow } from "../types";
import { useSalesUiConfig } from "../config";

export interface RefundSaleModalProps {
    sale: SaleRow | null;
    communityTag: string;
    open: boolean;
    onClose: () => void;
    /** Called with the saleId after a successful refund. The parent
     * should refresh its sales list / KPI cards in response. */
    onRefunded?: (saleId: string) => void;
}

type SubmitState =
    | { kind: "idle" }
    | { kind: "submitting" }
    | { kind: "error"; message: string; code?: string };

const MAX_REASON_LEN = 500;

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

function buyerLabel(sale: SaleRow): string {
    const name = sale.buyer?.name?.trim();
    if (name) return sale.buyerEmail ? `${name} <${sale.buyerEmail}>` : name;
    return sale.buyerEmail ?? sale.buyer?.usertag ?? "Unknown buyer";
}

interface EligibilityState {
    eligible: boolean;
    reason?: string;
}

function computeEligibility(sale: SaleRow | null): EligibilityState {
    if (!sale) return { eligible: false, reason: "No sale selected" };
    if (sale.refundStatus === "FULL") {
        return { eligible: false, reason: "This sale has already been fully refunded." };
    }
    if (sale.refundStatus === "DISPUTED") {
        return { eligible: false, reason: "This sale is under dispute. Refunds are blocked while a dispute is open." };
    }
    if (sale.payoutStatus !== "ESCROW") {
        return {
            eligible: false,
            reason: "Refund window has passed. The funds are no longer in escrow; contact Cobuntu support to escalate.",
        };
    }
    return { eligible: true };
}

export function RefundSaleModal(props: RefundSaleModalProps): React.ReactElement | null {
    const { sale, communityTag, open, onClose, onRefunded } = props;
    const config = useSalesUiConfig();

    const [reason, setReason] = useState("");
    const [submitState, setSubmitState] = useState<SubmitState>({ kind: "idle" });

    // Reset form when the modal opens for a different sale.
    useEffect(() => {
        if (open) {
            setReason("");
            setSubmitState({ kind: "idle" });
        }
    }, [open, sale?.id]);

    if (!sale) return null;

    const eligibility = computeEligibility(sale);
    const trimmedReason = reason.trim();
    const reasonValid = trimmedReason.length > 0 && trimmedReason.length <= MAX_REASON_LEN;
    const canSubmit = eligibility.eligible && reasonValid && submitState.kind !== "submitting";

    async function handleConfirm(): Promise<void> {
        if (!canSubmit || !sale) return;
        setSubmitState({ kind: "submitting" });

        try {
            const auth = await config.getAuthHeaders();
            const res = await fetch(
                `${config.apiBaseUrl}/communities/${communityTag}/sales/${sale.id}/refund`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json", ...auth },
                    body: JSON.stringify({ reason: trimmedReason }),
                },
            );

            if (res.ok) {
                onRefunded?.(sale.id);
                onClose();
                return;
            }

            // Granular error surfacing for known 4xx codes.
            let body: { error?: string; code?: string } = {};
            try { body = await res.json(); } catch { /* response had no JSON body */ }
            const message = body.error
                ?? (res.status === 401 ? "Not authorized."
                  : res.status === 403 ? "You do not have permission to refund this sale."
                  : res.status === 404 ? "Sale not found."
                  : res.status === 409 ? "This sale cannot be refunded right now."
                  : "Refund failed. Please try again.");
            setSubmitState({ kind: "error", message, code: body.code });
        } catch (err: any) {
            setSubmitState({
                kind: "error",
                message: err?.message || "Network error. Please try again.",
            });
        }
    }

    const grossDisplay = formatCurrency(sale.grossAmount, sale.currency, config.locale ?? "en-US");

    return (
        <Dialog.Root open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
            <Dialog.Portal>
                <Dialog.Overlay data-testid="refund-modal-overlay" />
                <Dialog.Content data-testid="refund-modal-content">
                    <Dialog.Title>Refund this sale?</Dialog.Title>
                    <Dialog.Description>
                        The buyer will be refunded the full amount and notified by email.
                        This action cannot be undone.
                    </Dialog.Description>

                    <dl data-testid="refund-modal-summary">
                        <div>
                            <dt>Buyer</dt>
                            <dd data-testid="refund-modal-buyer">{buyerLabel(sale)}</dd>
                        </div>
                        <div>
                            <dt>Amount</dt>
                            <dd data-testid="refund-modal-amount">{grossDisplay}</dd>
                        </div>
                        <div>
                            <dt>Status</dt>
                            <dd data-testid="refund-modal-eligibility">
                                {eligibility.eligible ? "Eligible for refund" : eligibility.reason}
                            </dd>
                        </div>
                    </dl>

                    <label htmlFor="refund-reason">
                        Reason <span aria-hidden="true">*</span>
                        <textarea
                            id="refund-reason"
                            data-testid="refund-modal-reason"
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            disabled={!eligibility.eligible || submitState.kind === "submitting"}
                            maxLength={MAX_REASON_LEN}
                            placeholder="e.g. Buyer reported product damaged on arrival"
                            required
                        />
                        <span data-testid="refund-modal-reason-counter" aria-live="polite">
                            {trimmedReason.length}/{MAX_REASON_LEN}
                        </span>
                    </label>

                    {submitState.kind === "error" ? (
                        <div role="alert" data-testid="refund-modal-error" data-error-code={submitState.code ?? ""}>
                            {submitState.message}
                        </div>
                    ) : null}

                    <div data-testid="refund-modal-actions">
                        <button
                            type="button"
                            data-testid="refund-modal-cancel"
                            onClick={onClose}
                            disabled={submitState.kind === "submitting"}
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            data-testid="refund-modal-confirm"
                            onClick={handleConfirm}
                            disabled={!canSubmit}
                        >
                            {submitState.kind === "submitting" ? "Refunding…" : "Issue refund"}
                        </button>
                    </div>
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    );
}
