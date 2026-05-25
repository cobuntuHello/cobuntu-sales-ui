import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import { KpiCards, SalesUiConfigProvider, type SaleRow } from "../index";

function makeSale(overrides: Partial<SaleRow> = {}): SaleRow {
    return {
        id: "s1",
        createdAt: "2026-05-20T12:00:00Z",
        eventId: null,
        productSnapshot: null,
        buyer: { id: "b", name: "Buyer", usertag: "buyer" },
        buyerEmail: "b@example.com",
        grossAmount: 5000,
        ownerNetPayout: 4500,
        platformFee: 300,
        stripeFees: 150,
        stripeTaxFee: 50,
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

describe("KpiCards", () => {
    it("renders skeletons when loading", () => {
        render(wrap(<KpiCards sales={[]} currency="EUR" loading />));
        expect(screen.getByTestId("kpi-cards")).toBeInTheDocument();
        expect(screen.queryByTestId("kpi-sales-count")).toBeNull();
    });

    it("renders 4 metrics from a sales array", () => {
        const sales = [makeSale(), makeSale({ id: "s2", grossAmount: 3000, ownerNetPayout: 2700, platformFee: 200, stripeFees: 80, stripeTaxFee: 20 })];
        render(wrap(<KpiCards sales={sales} currency="EUR" />));
        expect(screen.getByTestId("kpi-sales-count")).toHaveTextContent("2");
        // Total revenue: 5000 + 3000 = 8000 cents = €80.00
        expect(screen.getByTestId("kpi-revenue")).toHaveTextContent("€80.00");
        // Fees: (300+150+50) + (200+80+20) = 800 cents = €8.00
        expect(screen.getByTestId("kpi-fees")).toHaveTextContent("€8.00");
        // Net: 4500 + 2700 = 7200 cents = €72.00
        expect(screen.getByTestId("kpi-net")).toHaveTextContent("€72.00");
    });

    it("uses countSubtitle when provided", () => {
        render(wrap(<KpiCards sales={[]} currency="EUR" countSubtitle="of 50 capacity" />));
        expect(screen.getByText("of 50 capacity")).toBeInTheDocument();
    });
});
