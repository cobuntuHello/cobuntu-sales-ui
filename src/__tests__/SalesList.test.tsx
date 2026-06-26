import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import { SalesList, SalesUiConfigProvider, type SaleRow } from "../index";

function makeSale(overrides: Partial<SaleRow> = {}): SaleRow {
    return {
        id: "s1",
        createdAt: "2026-05-20T12:00:00Z",
        eventId: null,
        productSnapshot: null,
        buyer: { id: "b", name: "Test Buyer", usertag: "tb" },
        buyerEmail: "tb@example.com",
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
        transaction: { id: "t", status: null, totalAmount: null, currency: null },
        ...overrides,
    };
}

function wrap(children: React.ReactNode) {
    return (
        <SalesUiConfigProvider config={{ apiBaseUrl: "/api", getAuthHeaders: () => ({}), locale: "en-US" }}>
            {children}
        </SalesUiConfigProvider>
    );
}

describe("SalesList", () => {
    it("renders empty-state when no sales", () => {
        render(wrap(<SalesList sales={[]} />));
        expect(screen.getByText("No sales yet.")).toBeInTheDocument();
    });

    it("renders one row per sale with formatted amount", () => {
        render(wrap(<SalesList sales={[makeSale(), makeSale({ id: "s2", grossAmount: 1000 })]} />));
        expect(screen.getByTestId("sales-row-s1")).toBeInTheDocument();
        expect(screen.getByTestId("sales-row-s2")).toBeInTheDocument();
        // 5000 cents → €50.00
        expect(screen.getByTestId("sales-row-s1")).toHaveTextContent("€50.00");
    });

    it("Refund button is enabled on ESCROW sales", () => {
        const onRefundClick = vi.fn();
        render(wrap(<SalesList sales={[makeSale()]} onRefundClick={onRefundClick} />));
        const btn = screen.getByTestId("refund-button-s1");
        expect(btn).toBeEnabled();
        fireEvent.click(btn);
        expect(onRefundClick).toHaveBeenCalledWith(expect.objectContaining({ id: "s1" }));
    });

    it("Refund button is enabled on HOLD sales (money still in Cobuntu's balance)", () => {
        const onRefundClick = vi.fn();
        render(wrap(<SalesList sales={[makeSale({ payoutStatus: "HOLD" })]} onRefundClick={onRefundClick} />));
        const btn = screen.getByTestId("refund-button-s1");
        expect(btn).toBeEnabled();
        fireEvent.click(btn);
        expect(onRefundClick).toHaveBeenCalledWith(expect.objectContaining({ id: "s1" }));
    });

    it("Refund button is disabled once paid out (payoutStatus = PAID)", () => {
        const onRefundClick = vi.fn();
        render(wrap(<SalesList sales={[makeSale({ payoutStatus: "PAID" })]} onRefundClick={onRefundClick} />));
        expect(screen.getByTestId("refund-button-s1")).toBeDisabled();
    });

    it("row click fires onRowClick", () => {
        const onRowClick = vi.fn();
        render(wrap(<SalesList sales={[makeSale()]} onRowClick={onRowClick} />));
        fireEvent.click(screen.getByTestId("sales-row-s1"));
        expect(onRowClick).toHaveBeenCalledWith(expect.objectContaining({ id: "s1" }));
    });

    it("Refund button click does NOT also fire onRowClick (stopPropagation)", () => {
        const onRowClick = vi.fn();
        const onRefundClick = vi.fn();
        render(wrap(<SalesList sales={[makeSale()]} onRowClick={onRowClick} onRefundClick={onRefundClick} />));
        fireEvent.click(screen.getByTestId("refund-button-s1"));
        expect(onRefundClick).toHaveBeenCalled();
        expect(onRowClick).not.toHaveBeenCalled();
    });
});
