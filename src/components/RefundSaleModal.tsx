"use client";

/**
 * RefundSaleModal — the per-sale refund confirmation dialog.
 * Phase B: stub. Phase C wires up the form (required reason field +
 * eligibility status display + confirm button) and the POST to
 * `/api/communities/:tag/sales/:saleId/refund` (Phase A endpoint).
 */

import React from "react";
import type { SaleRow } from "../types";

export interface RefundSaleModalProps {
    sale: SaleRow | null;
    communityTag: string;
    open: boolean;
    onClose: () => void;
    onRefunded?: (saleId: string) => void;
}

export function RefundSaleModal(_props: RefundSaleModalProps): React.ReactElement | null {
    return null;
}
