/**
 * Phase B smoke test: confirms the scaffold renders without throwing
 * and the exports compose into a tree the consuming apps can mount
 * today, even though the bodies land in Phase C and D.
 */

import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import React from "react";
import { SalesSection, SalesUiConfigProvider } from "../index";

describe("@cobuntu/sales-ui scaffold", () => {
    it("renders SalesSection inside the SalesUiConfigProvider without throwing", () => {
        const { getByTestId } = render(
            <SalesUiConfigProvider
                config={{
                    apiBaseUrl: "https://api.cobuntu.com",
                    getAuthHeaders: () => ({ Authorization: "Bearer test" }),
                }}
            >
                <SalesSection
                    communityTag="pbn"
                    entityType="event"
                    entityId="event-id-1"
                />
            </SalesUiConfigProvider>,
        );

        const section = getByTestId("sales-section");
        expect(section).toBeInTheDocument();
        expect(section.getAttribute("data-entity-type")).toBe("event");
        expect(section.getAttribute("data-entity-id")).toBe("event-id-1");
        expect(section.getAttribute("data-community-tag")).toBe("pbn");
    });

    it("renders SalesSection for entityType=product too", () => {
        const { getByTestId } = render(
            <SalesUiConfigProvider
                config={{
                    apiBaseUrl: "/api",
                    getAuthHeaders: () => ({}),
                }}
            >
                <SalesSection
                    communityTag="pbn"
                    entityType="product"
                    entityId="prod-id-1"
                />
            </SalesUiConfigProvider>,
        );

        expect(getByTestId("sales-section").getAttribute("data-entity-type")).toBe("product");
    });
});
