"use client";

/**
 * SalesSection — the top-level component the host page mounts.
 *
 * Phase B (this PR): structural shell only. The KpiCards, SalesList,
 * SaleDetailDrawer, and RefundSaleModal renders are no-ops; the real
 * implementations land in Phase C and Phase D.
 *
 * The shell exists in Phase B so the consuming admin pages (event
 * detail page + product detail page) can mount it immediately and the
 * later phases just fill in the children without further wiring.
 */

import React from "react";
import type { EntityType } from "../types";

export interface SalesSectionProps {
    /** The seller community's URL tag (e.g. "pbn"). */
    communityTag: string;
    /** Which kind of entity this section is showing sales for. */
    entityType: EntityType;
    /** The entity's id (eventId for "event", productId for "product"). */
    entityId: string;
    /**
     * Optional: cap the time range queried from the API. Defaults to
     * "1y" matching the existing TicketSalesSection behaviour. Phase C
     * may surface a UI control to change it.
     */
    timeRange?: string;
}

export function SalesSection(props: SalesSectionProps): React.ReactElement {
    return (
        <section
            data-testid="sales-section"
            data-entity-type={props.entityType}
            data-entity-id={props.entityId}
            data-community-tag={props.communityTag}
        >
            {/* Phase B scaffold. KpiCards + SalesList + SaleDetailDrawer
                + RefundSaleModal land in Phase C and Phase D. */}
        </section>
    );
}
