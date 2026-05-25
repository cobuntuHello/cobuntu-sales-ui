"use client";

/**
 * SaleDetailDrawer — slide-in panel showing the full sale's payout
 * timeline + fee breakdown + refund button.
 * Phase B: stub. Phase D ships the full content.
 */

import React from "react";
import type { SaleRow } from "../types";

export interface SaleDetailDrawerProps {
    sale: SaleRow | null;
    open: boolean;
    onClose: () => void;
    onRefundClick?: (sale: SaleRow) => void;
}

export function SaleDetailDrawer(_props: SaleDetailDrawerProps): React.ReactElement | null {
    return null;
}
