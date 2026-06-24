"use client";

import { useState } from "react";

interface MonthlyStat {
  month: string;
  sales: number;
  purchases: number;
}

interface DashboardChartsProps {
  data: MonthlyStat[];
}

export default function DashboardCharts({ data }: DashboardChartsProps) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  // If no data, show a placeholder box
  if (data.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-6 shadow-sm flex flex-col justify-center items-center min-h-[300px]">
        <span className="text-sm font-semibold uppercase tracking-wider text-muted-foreground/60 mb-2">Monthly Overview</span>
        <span className="text-xs text-muted-foreground">No transaction data available yet to display trends.</span>
      </div>
    );
  }

  // Calculate scales
  const chartHeight = 180;
  const paddingLeft = 45;
  const paddingRight = 15;
  const paddingTop = 25;
  const paddingBottom = 30;
  
  const totalWidth = 500;
  const totalHeight = chartHeight + paddingTop + paddingBottom;
  const plotWidth = totalWidth - paddingLeft - paddingRight;

  const maxVal = Math.max(
    ...data.map((d) => Math.max(d.sales, d.purchases)),
    10000 // default min height to prevent divide-by-zero or flat bars
  );

  // Round maxVal to nice increment
  const magnitude = Math.pow(10, Math.floor(Math.log10(maxVal)));
  const yMax = Math.ceil(maxVal / magnitude) * magnitude;

  // Grid line values
  const yTicks = [0, yMax * 0.25, yMax * 0.5, yMax * 0.75, yMax];

  const colWidth = plotWidth / data.length;
  const barWidth = Math.min(18, colWidth * 0.25);

  return (
    <div className="rounded-lg border border-border bg-card p-6 shadow-sm space-y-4 relative">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground/75">
            MONTHLY ANALYSIS
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">Comparison of Sales and Purchase Vouchers</p>
        </div>
        <div className="flex gap-4 text-xs font-semibold">
          <div className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded bg-primary shrink-0 block" />
            <span className="text-muted-foreground">Sales</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded bg-warning shrink-0 block" />
            <span className="text-muted-foreground">Purchases</span>
          </div>
        </div>
      </div>

      <div className="relative w-full h-[250px]">
        <svg
          viewBox={`0 0 ${totalWidth} ${totalHeight}`}
          className="w-full h-full text-muted-foreground font-mono"
        >
          {/* Y Axis Grid Lines & Labels */}
          {yTicks.map((tick, idx) => {
            const y = paddingTop + chartHeight - (tick / yMax) * chartHeight;
            return (
              <g key={idx} className="opacity-40">
                <line
                  x1={paddingLeft}
                  y1={y}
                  x2={totalWidth - paddingRight}
                  y2={y}
                  stroke="currentColor"
                  strokeWidth="0.5"
                  strokeDasharray="4 4"
                />
                <text
                  x={paddingLeft - 8}
                  y={y + 3}
                  textAnchor="end"
                  className="fill-muted-foreground text-xs"
                >
                  ₹{(tick >= 100000 ? `${(tick / 100000).toFixed(1)}L` : tick >= 1000 ? `${(tick / 1000).toFixed(0)}k` : tick.toFixed(0))}
                </text>
              </g>
            );
          })}

          {/* Bars Rendering */}
          {data.map((item, idx) => {
            const xCenter = paddingLeft + idx * colWidth + colWidth / 2;
            const salesHeight = (item.sales / yMax) * chartHeight;
            const purchaseHeight = (item.purchases / yMax) * chartHeight;

            const salesY = paddingTop + chartHeight - salesHeight;
            const purchaseY = paddingTop + chartHeight - purchaseHeight;

            const salesX = xCenter - barWidth - 2;
            const purchaseX = xCenter + 2;

            return (
              <g key={idx}>
                {/* Sales Bar */}
                <rect
                  x={salesX}
                  y={salesY}
                  width={barWidth}
                  height={Math.max(2, salesHeight)}
                  rx="2"
                  className="fill-primary transition-all duration-300 hover:brightness-110 cursor-pointer"
                  onMouseEnter={() => setHoveredIdx(idx)}
                  onMouseLeave={() => setHoveredIdx(null)}
                />

                {/* Purchase Bar */}
                <rect
                  x={purchaseX}
                  y={purchaseY}
                  width={barWidth}
                  height={Math.max(2, purchaseHeight)}
                  rx="2"
                  className="fill-warning transition-all duration-300 hover:brightness-110 cursor-pointer"
                  onMouseEnter={() => setHoveredIdx(idx)}
                  onMouseLeave={() => setHoveredIdx(null)}
                />

                {/* X Axis Month Label */}
                <text
                  x={xCenter}
                  y={paddingTop + chartHeight + 15}
                  textAnchor="middle"
                  className="fill-muted-foreground text-xs font-semibold"
                >
                  {item.month}
                </text>

                {/* Hotspot transparent overlay for better mobile/hover selection */}
                <rect
                  x={paddingLeft + idx * colWidth}
                  y={paddingTop}
                  width={colWidth}
                  height={chartHeight}
                  fill="transparent"
                  className="cursor-pointer"
                  onMouseEnter={() => setHoveredIdx(idx)}
                  onMouseLeave={() => setHoveredIdx(null)}
                />
              </g>
            );
          })}

          {/* Bottom Baseline */}
          <line
            x1={paddingLeft}
            y1={paddingTop + chartHeight}
            x2={totalWidth - paddingRight}
            y2={paddingTop + chartHeight}
            stroke="currentColor"
            strokeWidth="1"
            className="opacity-50"
          />
        </svg>

        {/* Hover Tooltip Overlay */}
        {hoveredIdx !== null && (
          <div
            className="absolute bg-card border border-border rounded-lg shadow-lg p-2.5 text-xs space-y-1.5 z-10 font-sans text-foreground animate-fade-in"
            style={{
              left: `${Math.max(
                10,
                Math.min(
                  (hoveredIdx * colWidth) + paddingLeft + (colWidth / 2) - 60,
                  totalWidth - 130
                )
              )}px`,
              top: `10px`,
              width: "120px",
            }}
          >
            <div className="font-bold border-b border-border/50 pb-1 text-center uppercase tracking-wider text-muted-foreground text-xs">
              {data[hoveredIdx].month}
            </div>
            <div className="flex justify-between font-semibold">
              <span className="text-primary">Sales:</span>
              <span className="font-mono">₹{data[hoveredIdx].sales.toLocaleString("en-IN", { maximumFractionDigits: 0 })}</span>
            </div>
            <div className="flex justify-between font-semibold">
              <span className="text-warning">Purchase:</span>
              <span className="font-mono">₹{data[hoveredIdx].purchases.toLocaleString("en-IN", { maximumFractionDigits: 0 })}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
