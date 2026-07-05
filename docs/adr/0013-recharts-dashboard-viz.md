# Recharts for Dashboard visualization

## Status

Accepted

## Context

The new **Dashboard** screen needs a per-day time bar chart and a by-Client distribution donut, plus tooltips and a legend, over a selectable date range. The web app has no charting dependency today. Stack is React 19.1, Vite 6, Tailwind v4.

Recharts 3.9.x (published mid-2026) declares React 16.8–19 in `peerDependencies` and no longer needs the `react-is` override that plagued the 2.x line on React 19.

## Decision

Adopt **Recharts 3.9.x** for Dashboard charts.

- Use its declarative `<BarChart>` / `<PieChart>` components fed by the pre-aggregated buckets from the `GET /api/dashboard` summary endpoint.
- Chart colors and axis/label contrast draw from the design tokens (ADR-0012).

## Considered options

- **Hand-rolled SVG/CSS charts** — rejected: reinvents axes, scales, tooltips, donut arc math, and accessibility for two standard chart types; more code to maintain than the dependency saves.
- **Chart.js (`react-chartjs-2`)** — viable, canvas-based; rejected in favor of Recharts' React-native, declarative component model and easier tokenized styling via SVG.
- **visx / Nivo** — visx is lower-level (more assembly required); Nivo is heavier than needed for two charts. Rejected for scope.

## Consequences

- New runtime dependency (`recharts`) in `apps/web`; no `react-is` override required on React 19 with 3.x.
- Aggregation stays server-side (small payloads); Recharts renders presentational buckets only.
- If bundle size later matters, the two charts are isolated enough to swap for a lighter lib without touching the aggregation contract.
