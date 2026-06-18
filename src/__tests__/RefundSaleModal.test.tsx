/**
 * Tests for RefundSaleModal — Phase C of host-refunds-and-sales-visibility.
 *
 * Mocks fetch globally to verify the POST body / URL / auth headers
 * + asserts the UI states (eligibility lock, reason validation,
 * confirm enablement, error rendering).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { RefundSaleModal, SalesUiConfigProvider, type SaleRow } from "../index";

function makeSale(overrides: Partial<SaleRow> = {}): SaleRow {
    return {
        id: "sale-123",
        createdAt: "2026-05-20T12:00:00Z",
        eventId: null,
        productSnapshot: { id: "prod-1", name: "Test product" },
        buyer: { id: "buyer-1", name: "Test Buyer", usertag: "testbuyer" },
        buyerEmail: "buyer@example.com",
        grossAmount: 5000,
        ownerNetPayout: 4500,
        platformFee: 500,
        stripeFees: 0,
        stripeTaxFee: 0,
        refundStatus: "NONE",
        payoutStatus: "ESCROW",
        currency: "EUR",
        eligibleForPayoutAt: null,
        scheduledPayoutAt: null,
        paidOutAt: null,
        transaction: { id: "txn-1", status: "COMPLETED", totalAmount: 5000, currency: "EUR" },
        ...overrides,
    };
}

function renderModal(sale: SaleRow | null, props: Partial<React.ComponentProps<typeof RefundSaleModal>> = {}) {
    const onClose = vi.fn();
    const onRefunded = vi.fn();
    const utils = render(
        <SalesUiConfigProvider
            config={{
                apiBaseUrl: "https://api.test",
                getAuthHeaders: () => ({ Authorization: "Bearer test-token" }),
                locale: "en-US",
            }}
        >
            <RefundSaleModal
                sale={sale}
                communityTag="pbn"
                open={true}
                onClose={onClose}
                onRefunded={onRefunded}
                {...props}
            />
        </SalesUiConfigProvider>,
    );
    return { ...utils, onClose, onRefunded };
}

beforeEach(() => {
    vi.restoreAllMocks();
});

describe("RefundSaleModal — render", () => {
    it("renders nothing when sale is null", () => {
        const { container } = renderModal(null);
        expect(container.querySelector("[data-testid=refund-modal-content]")).toBeNull();
    });

    it("renders buyer + amount + eligibility for an ESCROW NONE sale", () => {
        renderModal(makeSale());
        expect(screen.getByTestId("refund-modal-buyer")).toHaveTextContent("Test Buyer <buyer@example.com>");
        expect(screen.getByTestId("refund-modal-amount")).toHaveTextContent("€50.00");
        expect(screen.getByTestId("refund-modal-eligibility")).toHaveTextContent("Eligible for refund");
    });

    it("locks the form + shows Stripe-dashboard handoff message when payoutStatus = PAID", () => {
        // Post feat/refund-policy-controller-delegate (2026-06-18): PAID
        // sales surface the Stripe dashboard handoff copy instead of the
        // generic "refund window has passed" message — money is no
        // longer in Cobuntu's custody, so refunds aren't possible
        // through this surface.
        renderModal(makeSale({ payoutStatus: "PAID" }));
        expect(screen.getByTestId("refund-modal-eligibility")).toHaveTextContent(/Stripe dashboard/i);
        expect(screen.getByTestId("refund-modal-reason")).toBeDisabled();
        expect(screen.getByTestId("refund-modal-confirm")).toBeDisabled();
    });

    it("ELIGIBLE payoutStatus surfaces the bypass banner + a second reason field (extended policy)", () => {
        // Post feat/configurable-event-refund-policy (2026-06-18): when
        // the host's event has refundPolicy.mode = 'extended', the
        // attendees row enables Refund for ELIGIBLE sales. The modal
        // then asks for an additional bypassReason explaining the
        // off-window action.
        renderModal(makeSale({ payoutStatus: "ELIGIBLE" }));
        expect(screen.getByTestId("refund-modal-eligibility")).toHaveTextContent(/eligible for refund/i);
        expect(screen.getByTestId("refund-modal-bypass-banner")).toBeInTheDocument();
        expect(screen.getByTestId("refund-modal-bypass-reason")).toBeInTheDocument();
        // Standard reason is still required.
        expect(screen.getByTestId("refund-modal-reason")).not.toBeDisabled();
        // Submit blocked until BOTH reasons are filled.
        expect(screen.getByTestId("refund-modal-confirm")).toBeDisabled();
    });

    it("locks the form when already fully refunded", () => {
        renderModal(makeSale({ refundStatus: "FULL" }));
        expect(screen.getByTestId("refund-modal-eligibility")).toHaveTextContent(/already been fully refunded/i);
        expect(screen.getByTestId("refund-modal-confirm")).toBeDisabled();
    });

    it("locks the form when sale is under dispute", () => {
        renderModal(makeSale({ refundStatus: "DISPUTED" }));
        expect(screen.getByTestId("refund-modal-eligibility")).toHaveTextContent(/under dispute/i);
        expect(screen.getByTestId("refund-modal-confirm")).toBeDisabled();
    });
});

describe("RefundSaleModal — reason validation", () => {
    it("disables confirm when the reason field is empty", () => {
        renderModal(makeSale());
        expect(screen.getByTestId("refund-modal-confirm")).toBeDisabled();
    });

    it("disables confirm when the reason is whitespace-only", async () => {
        const user = userEvent.setup();
        renderModal(makeSale());
        await user.type(screen.getByTestId("refund-modal-reason"), "    ");
        expect(screen.getByTestId("refund-modal-confirm")).toBeDisabled();
    });

    it("enables confirm once a non-empty reason is entered", async () => {
        const user = userEvent.setup();
        renderModal(makeSale());
        await user.type(screen.getByTestId("refund-modal-reason"), "Buyer complaint about damage");
        expect(screen.getByTestId("refund-modal-confirm")).toBeEnabled();
    });

    it("shows the live character counter", () => {
        renderModal(makeSale());
        const textarea = screen.getByTestId("refund-modal-reason") as HTMLTextAreaElement;
        fireEvent.change(textarea, { target: { value: "Hello" } });
        expect(screen.getByTestId("refund-modal-reason-counter")).toHaveTextContent("5/500");
    });
});

describe("RefundSaleModal — submission", () => {
    it("POSTs to the right URL with reason + auth headers on confirm", async () => {
        const fetchMock: any = vi.fn(() => Promise.resolve(new Response(JSON.stringify({
            refund: { id: "r1", saleId: "sale-123", amount: 5000, status: "COMPLETED", refundType: "HOST_CANCELLATION", reason: "test" },
        }), { status: 200 })));
        vi.stubGlobal("fetch", fetchMock);

        const user = userEvent.setup();
        const { onRefunded, onClose } = renderModal(makeSale());
        await user.type(screen.getByTestId("refund-modal-reason"), "Buyer cancelled at the door");
        await user.click(screen.getByTestId("refund-modal-confirm"));

        await waitFor(() => expect(fetchMock).toHaveBeenCalled());
        const call = fetchMock.mock.calls[0] as [string, RequestInit];
        expect(call[0]).toBe("https://api.test/communities/pbn/sales/sale-123/refund");
        expect(call[1].method).toBe("POST");
        expect(call[1].headers).toMatchObject({
            "Content-Type": "application/json",
            Authorization: "Bearer test-token",
        });
        const body = JSON.parse(call[1].body as string);
        expect(body).toEqual({ reason: "Buyer cancelled at the door" });

        await waitFor(() => expect(onRefunded).toHaveBeenCalledWith("sale-123"));
        await waitFor(() => expect(onClose).toHaveBeenCalled());
    });

    it("renders the server error message on 409 POLICY_BLOCKED", async () => {
        // Post-controller-delegate: the BE returns POLICY_BLOCKED for
        // an ELIGIBLE sale on a default-mode event. The FE renders the
        // server's prose verbatim + stamps the code on the DOM for
        // styling / instrumentation.
        const fetchMock = vi.fn(() => Promise.resolve(new Response(JSON.stringify({
            error: "This sale is past the default refund window. Enable extended host refunds in the event settings to refund this sale.",
            code: "POLICY_BLOCKED",
        }), { status: 409 })));
        vi.stubGlobal("fetch", fetchMock);

        const user = userEvent.setup();
        const { onRefunded, onClose } = renderModal(makeSale());
        await user.type(screen.getByTestId("refund-modal-reason"), "Reason");
        await user.click(screen.getByTestId("refund-modal-confirm"));

        const errorEl = await screen.findByTestId("refund-modal-error");
        expect(errorEl).toHaveTextContent(/extended host refunds/i);
        expect(errorEl.getAttribute("data-error-code")).toBe("POLICY_BLOCKED");
        expect(onRefunded).not.toHaveBeenCalled();
        expect(onClose).not.toHaveBeenCalled();
    });

    it("POSTs bypassReason in the body when refunding an ELIGIBLE sale", async () => {
        const fetchMock: any = vi.fn(() => Promise.resolve(new Response(JSON.stringify({
            refund: { id: "r2", saleId: "sale-123", amount: 5000, status: "COMPLETED", refundType: "HOST_CANCELLATION", reason: "test", bypassReason: "no-show" },
        }), { status: 200 })));
        vi.stubGlobal("fetch", fetchMock);

        const user = userEvent.setup();
        renderModal(makeSale({ payoutStatus: "ELIGIBLE" }));
        await user.type(screen.getByTestId("refund-modal-reason"), "Buyer didn't show");
        await user.type(screen.getByTestId("refund-modal-bypass-reason"), "Day-after goodwill refund");
        await user.click(screen.getByTestId("refund-modal-confirm"));

        await waitFor(() => expect(fetchMock).toHaveBeenCalled());
        const call = fetchMock.mock.calls[0] as [string, RequestInit];
        const body = JSON.parse(call[1].body as string);
        expect(body).toEqual({
            reason: "Buyer didn't show",
            bypassReason: "Day-after goodwill refund",
        });
    });

    it("does NOT send bypassReason in the body for a standard ESCROW refund", async () => {
        const fetchMock: any = vi.fn(() => Promise.resolve(new Response("{}", { status: 200 })));
        vi.stubGlobal("fetch", fetchMock);

        const user = userEvent.setup();
        renderModal(makeSale({ payoutStatus: "ESCROW" }));
        await user.type(screen.getByTestId("refund-modal-reason"), "Standard refund");
        await user.click(screen.getByTestId("refund-modal-confirm"));

        await waitFor(() => expect(fetchMock).toHaveBeenCalled());
        const call = fetchMock.mock.calls[0] as [string, RequestInit];
        const body = JSON.parse(call[1].body as string);
        expect(body).toEqual({ reason: "Standard refund" });
        expect(body.bypassReason).toBeUndefined();
    });

    it("falls back to status-derived message when the server returns no JSON body", async () => {
        const fetchMock = vi.fn(() => Promise.resolve(new Response("", { status: 403 })));
        vi.stubGlobal("fetch", fetchMock);

        const user = userEvent.setup();
        renderModal(makeSale());
        await user.type(screen.getByTestId("refund-modal-reason"), "Reason");
        await user.click(screen.getByTestId("refund-modal-confirm"));

        const errorEl = await screen.findByTestId("refund-modal-error");
        expect(errorEl).toHaveTextContent(/do not have permission/i);
    });

    it("renders a generic message on network failure", async () => {
        const fetchMock = vi.fn(() => Promise.reject(new Error("offline")));
        vi.stubGlobal("fetch", fetchMock);

        const user = userEvent.setup();
        renderModal(makeSale());
        await user.type(screen.getByTestId("refund-modal-reason"), "Reason");
        await user.click(screen.getByTestId("refund-modal-confirm"));

        const errorEl = await screen.findByTestId("refund-modal-error");
        expect(errorEl).toHaveTextContent(/offline/i);
    });

    it("clears the form when reopened for a different sale", async () => {
        const user = userEvent.setup();
        const { rerender } = renderModal(makeSale({ id: "sale-A" }));
        await user.type(screen.getByTestId("refund-modal-reason"), "First reason");
        expect(screen.getByTestId("refund-modal-reason")).toHaveValue("First reason");

        rerender(
            <SalesUiConfigProvider
                config={{
                    apiBaseUrl: "https://api.test",
                    getAuthHeaders: () => ({ Authorization: "Bearer test-token" }),
                }}
            >
                <RefundSaleModal
                    sale={makeSale({ id: "sale-B" })}
                    communityTag="pbn"
                    open={true}
                    onClose={() => {}}
                />
            </SalesUiConfigProvider>,
        );
        expect(screen.getByTestId("refund-modal-reason")).toHaveValue("");
    });
});
