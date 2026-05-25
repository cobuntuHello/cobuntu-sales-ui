"use client";

/**
 * Provider that lets the consuming app inject the API root + auth +
 * navigation hooks the sales-ui components depend on, instead of
 * baking app-specific URLs / fetchers / link handlers into the
 * components themselves.
 *
 * Mirrors the pattern used by `@cobuntu/product-management-ui` and
 * `@cobuntu/event-management-ui` so the three packages compose
 * cleanly when an admin page mounts all three (e.g. the product
 * detail page mounts ProductManagementConfigProvider AND
 * SalesUiConfigProvider).
 */

import React, { createContext, useContext, useMemo } from "react";

export interface SalesUiConfig {
    /**
     * Absolute base URL for the finances service (e.g.
     * "https://api.cobuntu.com" or "/api" if the consumer proxies).
     * Used to build endpoints like `${apiBaseUrl}/communities/:tag/sales`.
     */
    apiBaseUrl: string;
    /**
     * Returns the auth headers (typically `Authorization: Bearer ...`)
     * the consumer wants the components to send on every request.
     * Async so the consumer can refresh tokens lazily if needed.
     */
    getAuthHeaders: () => Promise<Record<string, string>> | Record<string, string>;
    /**
     * Locale for currency + date formatting in KPI cards + tables.
     * Defaults to "en-US" when unset.
     */
    locale?: string;
}

const SalesUiContext = createContext<SalesUiConfig | null>(null);

export function SalesUiConfigProvider({
    config,
    children,
}: {
    config: SalesUiConfig;
    children: React.ReactNode;
}): React.ReactElement {
    const value = useMemo(() => config, [config]);
    return <SalesUiContext.Provider value={value}>{children}</SalesUiContext.Provider>;
}

export function useSalesUiConfig(): SalesUiConfig {
    const ctx = useContext(SalesUiContext);
    if (!ctx) {
        throw new Error(
            "useSalesUiConfig: missing <SalesUiConfigProvider config={...}> in the tree. " +
            "Wrap your sales section with the provider before rendering any sales-ui component.",
        );
    }
    return ctx;
}

/**
 * Helper for components that need to build a JSON request to the
 * finances service. Consolidates the Content-Type + auth header
 * merging in one place.
 */
export async function useResolveJsonHeaders(): Promise<Record<string, string>> {
    const { getAuthHeaders } = useSalesUiConfig();
    const auth = await getAuthHeaders();
    return { "Content-Type": "application/json", ...auth };
}
