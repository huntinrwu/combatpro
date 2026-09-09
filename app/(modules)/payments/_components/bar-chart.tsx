import { fmtMoney } from "@/lib/db/types";

// Small pure-SVG grouped bar chart with y-axis + gridlines + net line overlay.
// Kept dep-free — swap for recharts if we need interactive tooltips or brushing.

export type BarChartPoint = {
  label: string;
  revenue: number;
  expense: number;
};

// Rounded "nice" number for the y-axis top — e.g. 3872 → 4000, 47 → 50.
function niceCeiling(value: number): number {
  if (value <= 0) return 100;
  const magnitude = Math.pow(10, Math.floor(Math.log10(value)));
  const scaled = value / magnitude;
  let niceScaled: number;
  if (scaled <= 1) niceScaled = 1;
  else if (scaled <= 2) niceScaled = 2;
  else if (scaled <= 5) niceScaled = 5;
  else niceScaled = 10;
  return niceScaled * magnitude;
}

function shortMoney(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `$${(n / 1_000).toFixed(1)}k`;
  return `$${Math.round(n)}`;
}

export function CashFlowBarChart({
  points,
  height = 220,
}: {
  points: BarChartPoint[];
  height?: number;
}) {
  const hasData = points.some((p) => p.revenue > 0 || p.expense > 0);
  if (points.length === 0 || !hasData) {
    return (
      <div className="flex h-40 flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-border/60 bg-muted/20 text-sm text-muted-foreground">
        <span>No cash flow in this range.</span>
        <span className="text-xs text-muted-foreground/70">
          Add revenue or expenses on an event to populate this chart.
        </span>
      </div>
    );
  }

  const rawMax = Math.max(...points.map((p) => Math.max(p.revenue, p.expense)));
  const max = niceCeiling(rawMax);
  const yAxisWidth = 44;
  const bottomAxisHeight = 20;
  const chartHeight = height - bottomAxisHeight;
  const chartWidth = Math.max(320, points.length * 60);
  const totalWidth = chartWidth + yAxisWidth;
  const groupWidth = chartWidth / points.length;
  const barPad = 10;
  const barWidth = (groupWidth - barPad * 2) / 2 - 2;

  const gridSteps = 4;
  const gridLines = Array.from({ length: gridSteps + 1 }, (_, i) => {
    const value = (max * i) / gridSteps;
    const y = chartHeight - (value / max) * chartHeight;
    return { value, y };
  });

  // Net line polyline over the bars (net = revenue - expense per bucket).
  const netPoints = points
    .map((p, i) => {
      const x = yAxisWidth + i * groupWidth + groupWidth / 2;
      const net = p.revenue - p.expense;
      const clamped = Math.max(-max, Math.min(max, net));
      const y = chartHeight - ((clamped + max) / (2 * max)) * chartHeight;
      return `${x},${y}`;
    })
    .join(" ");
  const zeroY = chartHeight - ((0 + max) / (2 * max)) * chartHeight;

  return (
    <div className="w-full overflow-x-auto">
      <svg
        viewBox={`0 0 ${totalWidth} ${height}`}
        className="min-w-full"
        role="img"
        aria-label="Cash flow"
      >
        {/* gridlines + y-axis labels */}
        {gridLines.map((g) => (
          <g key={g.value}>
            <line
              x1={yAxisWidth}
              y1={g.y}
              x2={totalWidth}
              y2={g.y}
              className="stroke-border/60"
              strokeWidth={1}
              strokeDasharray={g.value === 0 ? undefined : "3 3"}
            />
            <text
              x={yAxisWidth - 6}
              y={g.y + 3}
              textAnchor="end"
              className="fill-muted-foreground text-[10px]"
            >
              {shortMoney(g.value)}
            </text>
          </g>
        ))}

        {/* net-line zero reference */}
        <line
          x1={yAxisWidth}
          y1={zeroY}
          x2={totalWidth}
          y2={zeroY}
          className="stroke-foreground/30"
          strokeWidth={1}
        />

        {/* bars */}
        {points.map((p, i) => {
          const x0 = yAxisWidth + i * groupWidth + barPad;
          const rH = (p.revenue / max) * chartHeight;
          const eH = (p.expense / max) * chartHeight;
          return (
            <g key={`${p.label}-${i}`}>
              <rect
                x={x0}
                y={chartHeight - rH}
                width={barWidth}
                height={rH}
                className="fill-emerald-500/70"
              >
                <title>
                  {p.label}: +{fmtMoney(p.revenue)}
                </title>
              </rect>
              <rect
                x={x0 + barWidth + 2}
                y={chartHeight - eH}
                width={barWidth}
                height={eH}
                className="fill-red-500/70"
              >
                <title>
                  {p.label}: −{fmtMoney(p.expense)}
                </title>
              </rect>
              <text
                x={x0 + barWidth + 1}
                y={height - 4}
                textAnchor="middle"
                className="fill-muted-foreground text-[10px]"
              >
                {p.label}
              </text>
            </g>
          );
        })}

        {/* net line */}
        <polyline
          points={netPoints}
          fill="none"
          className="stroke-foreground"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {points.map((p, i) => {
          const x = yAxisWidth + i * groupWidth + groupWidth / 2;
          const net = p.revenue - p.expense;
          const clamped = Math.max(-max, Math.min(max, net));
          const y = chartHeight - ((clamped + max) / (2 * max)) * chartHeight;
          return (
            <circle
              key={`net-${i}`}
              cx={x}
              cy={y}
              r={2.5}
              className={
                net >= 0
                  ? "fill-emerald-600 dark:fill-emerald-400"
                  : "fill-red-600 dark:fill-red-400"
              }
            >
              <title>Net: {net < 0 ? "−" : ""}{fmtMoney(Math.abs(net))}</title>
            </circle>
          );
        })}
      </svg>
    </div>
  );
}

export function HBarBreakdown({
  rows,
  color = "expense",
}: {
  rows: { label: string; amount: number }[];
  color?: "expense" | "revenue";
}) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">Nothing to break down yet.</p>;
  }
  const total = rows.reduce((s, r) => s + r.amount, 0);
  const max = Math.max(1, ...rows.map((r) => r.amount));
  const barClass =
    color === "revenue" ? "bg-emerald-500/70" : "bg-red-500/70";
  const textClass =
    color === "revenue"
      ? "text-emerald-700 dark:text-emerald-300"
      : "text-red-700 dark:text-red-300";
  const sign = color === "revenue" ? "+" : "−";

  return (
    <ul className="space-y-2 text-sm">
      {rows.map((r) => {
        const pct = total > 0 ? (r.amount / total) * 100 : 0;
        return (
          <li key={r.label}>
            <div className="mb-0.5 flex items-baseline justify-between gap-2">
              <span className="truncate">{r.label}</span>
              <span className={`font-mono text-xs tabular-nums ${textClass}`}>
                {sign}
                {fmtMoney(r.amount)}
                <span className="ml-1 text-muted-foreground">
                  ({pct.toFixed(0)}%)
                </span>
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className={`h-full ${barClass}`}
                style={{ width: `${(r.amount / max) * 100}%` }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
