"use client";

/**
 * SalesList — the sales table with buyer / amount / date / actions.
 * Phase B: stub. Phase C renders rows with a Refund button column;
 * Phase D extends with sale-detail-drawer trigger + CSV export.
 */

import React from "react";
import type { SaleRow } from "../types";

export interface SalesListProps {
    sales: SaleRow[];
    loading?: boolean;
    onRefundClick?: (sale: SaleRow) => void;
    onRowClick?: (sale: SaleRow) => void;
}

export function SalesList(_props: SalesListProps): React.ReactElement {
    return <div data-testid="sales-list" aria-hidden="true" />;
}
