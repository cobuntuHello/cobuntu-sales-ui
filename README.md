# @cobuntu/sales-ui

Shared sales-visibility + host-refund UI for Cobuntu. Provides the
`SalesSection` (KPI cards · sales list · CSV export · sale-detail
drawer · per-sale refund modal) used by both the event-management and
product-management host surfaces.

Consumed by:
- [`cobuntu-admin`](https://github.com/cobuntuHello/cobuntu-admin) —
  community-leader pages at `/[communityTag]/events/[eventId]` and
  `/[communityTag]/marketplace/[productId]`.
- [`cobuntu-community-app`](https://github.com/cobuntuHello/cobuntu-community-app) —
  host self-service `/manage/[slug]` routes (where applicable).

See the umbrella plan doc in cobuntu-backend-monorepo:
`docs/features/host-refunds-and-sales-visibility.md`

## Status

This is **Phase B of the umbrella feature** — scaffold only. The
component bodies (KpiCards, SalesList, SaleDetailDrawer,
RefundSaleModal) land in Phase C and Phase D. Today they are
intentionally empty shells so consuming apps can mount the section in
their host pages immediately and the later phases fill in the content
without further wiring.

## Install

```jsonc
{
  "dependencies": {
    "@cobuntu/sales-ui": "git+https://github.com/cobuntuHello/cobuntu-sales-ui.git#<commit-sha>"
  }
}
```

Always pin to a specific commit SHA (not `#main`) so Vercel builds are
deterministic.

## Usage

```tsx
import { SalesSection, SalesUiConfigProvider } from "@cobuntu/sales-ui";

export function EventDetailPage({ params }) {
  return (
    <SalesUiConfigProvider
      config={{
        apiBaseUrl: process.env.NEXT_PUBLIC_API_BASE_URL!,
        getAuthHeaders: async () => ({ Authorization: `Bearer ${await getToken()}` }),
      }}
    >
      <SalesSection
        communityTag={params.communityTag}
        entityType="event"
        entityId={params.eventId}
      />
    </SalesUiConfigProvider>
  );
}
```

Same shape for product pages with `entityType="product"` and
`entityId={params.productId}`.
