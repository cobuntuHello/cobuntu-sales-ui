"use client";

/**
 * RefundSaleModal — the per-sale refund confirmation dialog used by
 * both event-management and product-management sales sections.
 *
 * Wires up:
 *   - eligibility display (in-window / past-escrow / already-refunded)
 *   - required reason field with 500-char limit
 *   - required bypassReason field + yellow warning banner when the
 *     sale is past ESCROW (i.e. host is refunding under their event's
 *     extended-mode refund policy)
 *   - confirm → POST /api/communities/:tag/sales/:saleId/refund
 *   - granular error messages (409 PAID_OUT, 409 POLICY_BLOCKED, 409
 *     ALREADY_REFUNDED, 400 BYPASS_REASON_REQUIRED, generic 5xx)
 *
 * The modal is intentionally controlled (open + onClose passed in by
 * the parent) so the parent owns the "which sale is being refunded"
 * state and can sequence modals + drawers without internal state
 * leaking between renders.
 *
 * Eligibility model (post feat/configurable-event-refund-policy):
 *   - payoutStatus = ESCROW   → standard refund, no bypassReason
 *   - payoutStatus = ELIGIBLE → bypass refund, bypassReason required.
 *                               Banner explains the buyer self-service
 *                               window has passed and the next payout
 *                               cycle is on the line.
 *   - payoutStatus = PAID     → blocked. The parent shouldn't open the
 *                               modal for these (the row renders a
 *                               disabled "Paid out — refund from Stripe"
 *                               pill instead). Defence-in-depth here.
 *   - payoutStatus = BLOCKED  → blocked. Support-only territory.
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
    /** True iff payoutStatus is ELIGIBLE — host is bypassing the
     *  default refund window via their event's extended-mode policy. */
    isBypass: boolean;
    /** Surfaces when eligible=false; ignored when eligible=true. */
    reason?: string;
}

function computeEligibility(sale: SaleRow | null): EligibilityState {
    if (!sale) return { eligible: false, isBypass: false, reason: "No sale selected" };
    if (sale.refundStatus === "FULL") {
        return { eligible: false, isBypass: false, reason: "This sale has already been fully refunded." };
    }
    if (sale.refundStatus === "DISPUTED") {
        return { eligible: false, isBypass: false, reason: "This sale is under dispute. Refunds are blocked while a dispute is open." };
    }
    if (sale.payoutStatus === "PAID") {
        return {
            eligible: false,
            isBypass: false,
            reason: "Already paid out to your community's Stripe account. Issue the refund from your Stripe dashboard.",
        };
    }
    // payoutStatus = ESCROW, HOLD, or ELIGIBLE — all still hold the money in
    // Cobuntu's balance (nothing paid out), so a plain refund is always safe.
    // ESCROW is within the refund window (no bypass). HOLD + ELIGIBLE are
    // past the window, so they refund as a bypass: ELIGIBLE only succeeds when
    // the event's refundPolicy.mode = 'extended' (the BE otherwise returns 409
    // POLICY_BLOCKED). We let the buyer through here (no FE-side policy
    // knowledge needed) so the parent can pre-open the modal for any allowed
    // combination.
    const isBypass = sale.payoutStatus !== "ESCROW";
    return { eligible: true, isBypass };
}

export function RefundSaleModal(props: RefundSaleModalProps): React.ReactElement | null {
    const { sale, communityTag, open, onClose, onRefunded } = props;
    const config = useSalesUiConfig();

    const [reason, setReason] = useState("");
    const [bypassReason, setBypassReason] = useState("");
    const [submitState, setSubmitState] = useState<SubmitState>({ kind: "idle" });

    // Reset form when the modal opens for a different sale.
    useEffect(() => {
        if (open) {
            setReason("");
            setBypassReason("");
            setSubmitState({ kind: "idle" });
        }
    }, [open, sale?.id]);

    if (!sale) return null;

    const eligibility = computeEligibility(sale);
    const trimmedReason = reason.trim();
    const trimmedBypassReason = bypassReason.trim();
    const reasonValid = trimmedReason.length > 0 && trimmedReason.length <= MAX_REASON_LEN;
    const bypassReasonValid = !eligibility.isBypass
        || (trimmedBypassReason.length > 0 && trimmedBypassReason.length <= MAX_REASON_LEN);
    const canSubmit = eligibility.eligible && reasonValid && bypassReasonValid && submitState.kind !== "submitting";

    async function handleConfirm(): Promise<void> {
        if (!canSubmit || !sale) return;
        setSubmitState({ kind: "submitting" });

        try {
            const auth = await config.getAuthHeaders();
            const body: { reason: string; bypassReason?: string } = { reason: trimmedReason };
            if (eligibility.isBypass) {
                body.bypassReason = trimmedBypassReason;
            }
            const res = await fetch(
                `${config.apiBaseUrl}/communities/${communityTag}/sales/${sale.id}/refund`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json", ...auth },
                    body: JSON.stringify(body),
                },
            );

            if (res.ok) {
                onRefunded?.(sale.id);
                onClose();
                return;
            }

            // Granular error surfacing for known 4xx codes.
            let errBody: { error?: string; code?: string } = {};
            try { errBody = await res.json(); } catch { /* response had no JSON body */ }
            const message = errBody.error
                ?? (res.status === 401 ? "Not authorized."
                  : res.status === 403 ? "You do not have permission to refund this sale."
                  : res.status === 404 ? "Sale not found."
                  : res.status === 409 ? "This sale cannot be refunded right now."
                  : "Refund failed. Please try again.");
            setSubmitState({ kind: "error", message, code: errBody.code });
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

                    {eligibility.isBypass ? (
                        <div role="alert" data-testid="refund-modal-bypass-banner">
                            <strong>Past the standard refund window.</strong>{" "}
                            By refunding, you'll reduce your community's next payout by {grossDisplay}.
                            Refunds aren't available after the bi-weekly payout sends funds to your
                            community's Stripe account — at that point, issue refunds directly from
                            your Stripe dashboard.
                        </div>
                    ) : null}

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

                    {eligibility.isBypass ? (
                        <label htmlFor="refund-bypass-reason">
                            Why are you refunding past the standard window? <span aria-hidden="true">*</span>
                            <textarea
                                id="refund-bypass-reason"
                                data-testid="refund-modal-bypass-reason"
                                value={bypassReason}
                                onChange={(e) => setBypassReason(e.target.value)}
                                disabled={submitState.kind === "submitting"}
                                maxLength={MAX_REASON_LEN}
                                placeholder="e.g. Buyer was a no-show; offered goodwill refund the morning after"
                                required
                            />
                            <span data-testid="refund-modal-bypass-reason-counter" aria-live="polite">
                                {trimmedBypassReason.length}/{MAX_REASON_LEN}
                            </span>
                        </label>
                    ) : null}

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
