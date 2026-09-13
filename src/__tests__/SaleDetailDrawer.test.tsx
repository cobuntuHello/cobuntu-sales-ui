/**
 * SaleDetailDrawer — deliverables section (T-069 / B7 + T-062 / A4 FE):
 * download telemetry, per-buyer link controls, and the certificate link.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { SaleDetailDrawer, SalesUiConfigProvider, type SaleRow } from "../index";

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

const DELIVERABLES = {
    attachments: [
        { id: "f1", name: "guide.pdf", kind: "FILE", downloadCount: 3, lastDownloadedAt: "2026-05-21T10:00:00Z", maxDownloads: 5, remaining: 2, link: null },
        { id: "l1", name: "Bonus pack", kind: "LINK", downloadCount: 0, lastDownloadedAt: null, maxDownloads: null, remaining: null, link: { token: "tok_abc", openCount: 4, lastOpenedAt: "2026-05-22T10:00:00Z", revoked: false } },
    ],
    hasCertificate: true,
};

function renderDrawer(sale: SaleRow | null, communityTag: string | undefined = "pbn") {
    return render(
        <SalesUiConfigProvider config={{ apiBaseUrl: "https://api.test", getAuthHeaders: () => ({ Authorization: "Bearer test-token" }), locale: "en-US" }}>
            <SaleDetailDrawer sale={sale} communityTag={communityTag} open={true} onClose={() => {}} />
        </SalesUiConfigProvider>,
    );
}

beforeEach(() => { vi.restoreAllMocks(); });

describe("SaleDetailDrawer — deliverables", () => {
    it("loads and shows download telemetry + link open-count + certificate", async () => {
        const fetchMock = vi.fn((..._args: any[]) => Promise.resolve(new Response(JSON.stringify(DELIVERABLES), { status: 200 })));
        vi.stubGlobal("fetch", fetchMock);

        renderDrawer(makeSale());

        await waitFor(() => expect(screen.getByTestId("drawer-deliverables")).toBeInTheDocument());
        // GET deliverables from the right URL.
        expect(fetchMock.mock.calls[0][0]).toBe("https://api.test/communities/pbn/sales/sale-123/deliverables");
        // FILE telemetry.
        expect(screen.getByText(/3 downloads/)).toBeInTheDocument();
        expect(screen.getByText(/2 of 5 left/)).toBeInTheDocument();
        // LINK open count + certificate button (header-authed → not a plain anchor).
        expect(screen.getByText(/4 opens/)).toBeInTheDocument();
        expect(screen.getByTestId("drawer-certificate-button")).toBeInTheDocument();
    });

    it("downloads the certificate as an auth'd blob (not a bare anchor that 401s)", async () => {
        const blob = new Blob(["%PDF-1.4"], { type: "application/pdf" });
        const fetchMock = vi.fn((url: string, _init?: RequestInit) =>
            String(url).endsWith("/license-certificate")
                ? Promise.resolve(new Response(blob, { status: 200 }))
                : Promise.resolve(new Response(JSON.stringify(DELIVERABLES), { status: 200 })),
        );
        vi.stubGlobal("fetch", fetchMock);
        (URL as any).createObjectURL = vi.fn(() => "blob:mock");
        (URL as any).revokeObjectURL = vi.fn();
        const user = userEvent.setup();

        renderDrawer(makeSale());
        await waitFor(() => expect(screen.getByTestId("drawer-certificate-button")).toBeInTheDocument());
        await user.click(screen.getByTestId("drawer-certificate-button"));

        await waitFor(() => {
            const call = fetchMock.mock.calls.find(c => String(c[0]).endsWith("/license-certificate"));
            expect(call).toBeTruthy();
            expect((call![1] as RequestInit).headers).toMatchObject({ Authorization: "Bearer test-token" });
        });
    });

    it("regenerates a per-buyer link (POST link-tokens)", async () => {
        const fetchMock = vi.fn((..._args: any[]) => Promise.resolve(new Response(JSON.stringify(DELIVERABLES), { status: 200 })));
        vi.stubGlobal("fetch", fetchMock);
        const user = userEvent.setup();

        renderDrawer(makeSale());
        await waitFor(() => expect(screen.getByTestId("drawer-deliverables")).toBeInTheDocument());

        await user.click(screen.getByRole("button", { name: /Regenerate/i }));
        await waitFor(() => {
            const post = fetchMock.mock.calls.find(c => (c[1] as RequestInit | undefined)?.method === "POST");
            expect(post).toBeTruthy();
        });
        const post = fetchMock.mock.calls.find(c => (c[1] as RequestInit | undefined)?.method === "POST")!;
        expect(post[0]).toBe("https://api.test/communities/pbn/sales/sale-123/link-tokens");
        expect(JSON.parse((post[1] as RequestInit).body as string)).toEqual({ attachmentId: "l1" });
    });

    it("revokes a per-buyer link (POST revoke)", async () => {
        const fetchMock = vi.fn((..._args: any[]) => Promise.resolve(new Response(JSON.stringify(DELIVERABLES), { status: 200 })));
        vi.stubGlobal("fetch", fetchMock);
        const user = userEvent.setup();

        renderDrawer(makeSale());
        await waitFor(() => expect(screen.getByTestId("drawer-deliverables")).toBeInTheDocument());

        await user.click(screen.getByRole("button", { name: /^Revoke$/i }));
        await waitFor(() => {
            const post = fetchMock.mock.calls.find(c => String(c[0]).endsWith("/revoke"));
            expect(post).toBeTruthy();
        });
        const post = fetchMock.mock.calls.find(c => String(c[0]).endsWith("/revoke"))!;
        expect(post[0]).toBe("https://api.test/communities/pbn/sales/sale-123/link-tokens/l1/revoke");
    });

    it("emails the buyer the link (POST resend) and confirms", async () => {
        const fetchMock = vi.fn((..._args: any[]) => Promise.resolve(new Response(JSON.stringify(DELIVERABLES), { status: 200 })));
        vi.stubGlobal("fetch", fetchMock);
        const user = userEvent.setup();

        renderDrawer(makeSale());
        await waitFor(() => expect(screen.getByTestId("drawer-deliverables")).toBeInTheDocument());

        await user.click(screen.getByRole("button", { name: /Email to buyer/i }));
        await waitFor(() => {
            const post = fetchMock.mock.calls.find(c => String(c[0]).endsWith("/resend"));
            expect(post).toBeTruthy();
        });
        const post = fetchMock.mock.calls.find(c => String(c[0]).endsWith("/resend"))!;
        expect(post[0]).toBe("https://api.test/communities/pbn/sales/sale-123/link-tokens/l1/resend");
        expect((post[1] as RequestInit).method).toBe("POST");
        // Confirmation state.
        await waitFor(() => expect(screen.getByRole("button", { name: /Sent/i })).toBeInTheDocument());
    });

    it("does not fetch deliverables for an event sale", async () => {
        const fetchMock = vi.fn((..._args: any[]) => Promise.resolve(new Response("{}", { status: 200 })));
        vi.stubGlobal("fetch", fetchMock);

        renderDrawer(makeSale({ eventId: "evt-1" }));
        // Give any effect a tick.
        await new Promise(r => setTimeout(r, 10));
        expect(screen.queryByTestId("drawer-deliverables")).not.toBeInTheDocument();
        expect(fetchMock).not.toHaveBeenCalled();
    });
});
