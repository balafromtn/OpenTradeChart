import { useMemo, useState } from "react";
import type { BacktestEquityPoint } from "../../services/strategy/types.ts";

interface EquityCurveChartProps {
  points: BacktestEquityPoint[];
  initialCapital: number;
  height?: number;
}

export function EquityCurveChart({
  points,
  initialCapital,
  height = 160,
}: EquityCurveChartProps) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const { pathD, ddPathD, minEquity, maxEquity, minDrawdown } = useMemo(() => {
    if (!points || points.length < 2) {
      return { pathD: "", ddPathD: "", minEquity: 0, maxEquity: 0, minDrawdown: 0 };
    }

    const equities = points.map((p) => p.equity);
    const drawdowns = points.map((p) => p.drawdown);

    let minEq = Math.min(...equities, initialCapital);
    let maxEq = Math.max(...equities, initialCapital);
    if (minEq === maxEq) {
      minEq -= 100;
      maxEq += 100;
    }
    // Add 5% padding
    const eqRange = maxEq - minEq;
    minEq -= eqRange * 0.05;
    maxEq += eqRange * 0.05;

    const minDd = Math.min(...drawdowns, 0);

    const width = 800; // virtual SVG width
    const svgHeight = height;

    const getX = (idx: number) => (idx / (points.length - 1)) * width;
    const getY = (val: number) => svgHeight - ((val - minEq) / (maxEq - minEq)) * svgHeight;

    let d = `M ${getX(0)} ${getY(points[0]!.equity)}`;
    for (let i = 1; i < points.length; i++) {
      d += ` L ${getX(i)} ${getY(points[i]!.equity)}`;
    }

    // Drawdown path (scaled in lower 40px)
    const ddHeight = 35;
    const getDdY = (ddVal: number) => {
      if (minDd === 0) return svgHeight;
      const normalized = Math.abs(ddVal) / Math.abs(minDd || 1);
      return svgHeight - normalized * (ddHeight - 5);
    };

    let ddD = `M ${getX(0)} ${getDdY(points[0]!.drawdown)}`;
    for (let i = 1; i < points.length; i++) {
      ddD += ` L ${getX(i)} ${getDdY(points[i]!.drawdown)}`;
    }

    return { pathD: d, ddPathD: ddD, minEquity: minEq, maxEquity: maxEq, minDrawdown: minDd };
  }, [points, initialCapital, height]);

  if (!points || points.length < 2) {
    return (
      <div className="flex h-32 items-center justify-center text-xs text-muted-foreground border border-dashed border-border rounded">
        No equity curve data available.
      </div>
    );
  }

  const hoverPoint = hoverIndex !== null ? points[hoverIndex] : null;
  const lastPoint = points[points.length - 1];
  const isNetProfit = lastPoint ? lastPoint.equity >= initialCapital : true;
  const strokeColor = isNetProfit ? "#10b981" : "#ef4444";
  const areaColor = isNetProfit ? "rgba(16, 185, 129, 0.15)" : "rgba(239, 68, 68, 0.15)";

  return (
    <div className="relative w-full rounded border border-border bg-card p-3 space-y-2">
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-3">
          <span className="font-semibold text-foreground">Equity Curve</span>
          <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <span className="inline-block w-2.5 h-0.5 bg-emerald-500 rounded"></span> Equity
          </span>
          <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <span className="inline-block w-2.5 h-0.5 bg-rose-500/70 rounded"></span> Drawdown %
          </span>
        </div>

        {hoverPoint ? (
          <div className="flex items-center gap-3 font-mono text-[11px]">
            <span>
              Eq: <span className="font-bold text-foreground">${hoverPoint.equity.toLocaleString()}</span>
            </span>
            <span className="text-destructive font-medium">DD: {hoverPoint.drawdown}%</span>
            <span className="text-muted-foreground text-[10px]">
              {new Date(hoverPoint.time * 1000).toLocaleDateString()}
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-2 font-mono text-[11px] text-muted-foreground">
            <span>Peak: ${maxEquity.toFixed(0)}</span>
            <span>•</span>
            <span>Max DD: {minDrawdown.toFixed(1)}%</span>
          </div>
        )}
      </div>

      <div
        className="relative w-full overflow-hidden"
        style={{ height }}
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const x = e.clientX - rect.left;
          const ratio = Math.max(0, Math.min(1, x / rect.width));
          const idx = Math.round(ratio * (points.length - 1));
          setHoverIndex(idx);
        }}
        onMouseLeave={() => setHoverIndex(null)}
      >
        <svg
          viewBox={`0 0 800 ${height}`}
          className="w-full h-full overflow-visible"
          preserveAspectRatio="none"
        >
          {/* Baseline of initial capital */}
          <line
            x1="0"
            y1={height - ((initialCapital - minEquity) / (maxEquity - minEquity)) * height}
            x2="800"
            y2={height - ((initialCapital - minEquity) / (maxEquity - minEquity)) * height}
            stroke="currentColor"
            strokeDasharray="3 3"
            className="text-border"
            strokeWidth="1"
          />

          {/* Area fill */}
          <path
            d={`${pathD} L 800 ${height} L 0 ${height} Z`}
            fill={areaColor}
          />

          {/* Equity Line */}
          <path
            d={pathD}
            fill="none"
            stroke={strokeColor}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Drawdown curve at the bottom */}
          <path
            d={ddPathD}
            fill="none"
            stroke="#f43f5e"
            strokeWidth="1.2"
            strokeDasharray="2 2"
            opacity="0.8"
          />

          {/* Hover indicator cursor */}
          {hoverIndex !== null && (
            <line
              x1={(hoverIndex / (points.length - 1)) * 800}
              y1="0"
              x2={(hoverIndex / (points.length - 1)) * 800}
              y2={height}
              stroke="currentColor"
              strokeDasharray="2 2"
              className="text-primary"
              strokeWidth="1"
            />
          )}
        </svg>
      </div>
    </div>
  );
}
