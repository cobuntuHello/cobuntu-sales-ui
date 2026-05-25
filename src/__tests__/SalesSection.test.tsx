import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { SalesSection, SalesUiConfigProvider } from "../index";

const salesFixture = {
    sales: [
        {
            id: "s-1",
            createdAt: "2026-05-20T12:00:00Z",
            eventId: "event-A",
            productSnapshot: null,
            buyer: { id: "b1", name: "Alice", usertag: "alice" },
            buyerEmail: "alice@example.com",
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
            transaction: { id: "t1", status: null, totalAmount: null, currency: null },
        },
        {
            // belongs to a DIFFERENT event — should be filtered out
            id: "s-other-event",
            createdAt: "2026-05-21T12:00:00Z",
            eventId: "event-B",
            productSnapshot: null,
            buyer: { id: "b2", name: "Bob", usertag: "bob" },
            buyerEmail: "bob@example.com",
            grossAmount: 2000,
            ownerNetPayout: 1800,
            platformFee: 200,
            stripeFees: 0,
            stripeTaxFee: 0,
            refundStatus: "NONE",
            payoutStatus: "ESCROW",
            currency: "EUR",
            eligibleForPayoutAt: null,
            scheduledPayoutAt: null,
            paidOutAt: null,
            transaction: { id: "t2", status: null, totalAmount: null, currency: null },
        },
        {
            // refunded — should also be filtered out
            id: "s-refunded",
            createdAt: "2026-05-22T12:00:00Z",
            eventId: "event-A",
            productSnapshot: null,
            buyer: { id: "b3", name: "Carol", usertag: "carol" },
            buyerEmail: "carol@example.com",
            grossAmount: 3000,
            ownerNetPayout: 2700,
            platformFee: 300,
            stripeFees: 0,
            stripeTaxFee: 0,
            refundStatus: "FULL",
            payoutStatus: "BLOCKED",
            currency: "EUR",
            eligibleForPayoutAt: null,
            scheduledPayoutAt: null,
            paidOutAt: null,
            transaction: { id: "t3", status: null, totalAmount: null, currency: null },
        },
    ],
    summary: { totalRevenue: 5000, totalSales: 1, totalPayouts: 0, pendingPayouts: 5000, platformFeesPaid: null },
};

function wrap(children: React.ReactNode) {
    return (
        <SalesUiConfigProvider config={{ apiBaseUrl: "/api", getAuthHeaders: () => ({ Authorization: "Bearer t" }), locale: "en-US" }}>
            {children}
        </SalesUiConfigProvider>
    );
}

beforeEach(() => {
    vi.restoreAllMocks();
});

describe("SalesSection", () => {
    it("filters by event id and drops refunded sales", async () => {
        vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(new Response(JSON.stringify(salesFixture), { status: 200 }))));

        render(wrap(
            <SalesSection communityTag="pbn" entityType="event" entityId="event-A" />,
        ));

        await waitFor(() => expect(screen.getByTestId("kpi-sales-count")).toHaveTextContent("1"));
        expect(screen.getByTestId("sales-row-s-1")).toBeInTheDocument();
        expect(screen.queryByTestId("sales-row-s-other-event")).toBeNull();
        expect(screen.queryByTestId("sales-row-s-refunded")).toBeNull();
    });

    it("title switches to 'Product sales' for entityType=product", async () => {
        const productFixture = {
            sales: [
                {
                    ...salesFixture.sales[0],
                    id: "p-1",
                    eventId: null,
                    productSnapshot: { id: "prod-A", name: "Test product" },
                },
            ],
            summary: null,
        };
        vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(new Response(JSON.stringify(productFixture), { status: 200 }))));

        render(wrap(<SalesSection communityTag="pbn" entityType="product" entityId="prod-A" />));
        await waitFor(() => expect(screen.getByText("Product sales")).toBeInTheDocument());
    });

    it("surfaces an error banner when the fetch fails", async () => {
        vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(new Response("", { status: 500 }))));

        render(wrap(<SalesSection communityTag="pbn" entityType="event" entityId="event-A" />));
        await waitFor(() => expect(screen.getByTestId("sales-error")).toBeInTheDocument());
    });
});
