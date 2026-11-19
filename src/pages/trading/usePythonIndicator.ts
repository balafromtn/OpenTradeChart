import { useEffect, useRef } from "react";
import type { CandlestickData, IChartApi, ISeriesApi, Time } from "lightweight-charts";
import { LineStyle } from "lightweight-charts";
import { usePythonIndicatorStore } from "../../services/python-indicator/store.ts";

export function usePythonIndicator(
  chartRef: React.RefObject<IChartApi | null>,
  candleSeriesRef: React.RefObject<ISeriesApi<"Candlestick"> | null>,
  chartData: CandlestickData<Time>[],
): void {
  const { enabled, plots, runScript } = usePythonIndicatorStore();
  const seriesMapRef = useRef<Map<string, ISeriesApi<any>>>(new Map());
  const lastChartDataLenRef = useRef<number>(0);

  // Auto-run when enabled and candles are available if no plots exist yet
  useEffect(() => {
    if (!enabled || chartData.length === 0) return;

    if (plots.length === 0 || Math.abs(chartData.length - lastChartDataLenRef.current) > 5) {
      lastChartDataLenRef.current = chartData.length;
      const candles = chartData.map((c) => ({
        time: Number(c.time),
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
        volume: typeof (c as any).volume === "number" ? (c as any).volume : 0,
      }));
      runScript(candles).catch(() => {});
    }
  }, [enabled, chartData, plots.length, runScript]);

  // Render or clear plots on the chart
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart || !candleSeriesRef.current) return;

    // Remove existing Python indicator series
    for (const [_key, series] of seriesMapRef.current) {
      try {
        chart.removeSeries(series);
      } catch {
        // Series already removed
      }
    }
    seriesMapRef.current.clear();

    if (!enabled || plots.length === 0 || chartData.length === 0) {
      return;
    }

    let hasSubpane = false;

    // Create series for each plot
    plots.forEach((plot, index) => {
      if (!plot.data || plot.data.length === 0) return;

      const isSubpane = plot.pane === "below";
      if (isSubpane) hasSubpane = true;
      const priceScaleId = isSubpane ? "python_indicator_subpane" : "right";
      const key = `py_${plot.name}_${index}`;

      const lineStyle =
        plot.lineStyle === "dashed"
          ? LineStyle.Dashed
          : plot.lineStyle === "dotted"
            ? LineStyle.Dotted
            : LineStyle.Solid;

      if (plot.type === "histogram") {
        const s = chart.addHistogramSeries({
          priceScaleId,
          color: plot.color || "#3b82f6",
        });
        s.setData(
          plot.data.map((p) => ({
            time: p.time as Time,
            value: p.value,
            color: p.color || plot.color,
          })),
        );
        seriesMapRef.current.set(key, s);
      } else if (plot.type === "area") {
        const baseColor = plot.color || "#38bdf8";
        const s = chart.addAreaSeries({
          priceScaleId,
          lineColor: baseColor,
          topColor: `${baseColor}40`,
          bottomColor: `${baseColor}05`,
          lineWidth: (plot.lineWidth || 2) as any,
          lineStyle,
        });
        s.setData(plot.data.map((p) => ({ time: p.time as Time, value: p.value })));
        seriesMapRef.current.set(key, s);
      } else {
        // Default: Line series
        const s = chart.addLineSeries({
          priceScaleId,
          color: plot.color || "#38bdf8",
          lineWidth: (plot.lineWidth || 2) as any,
          lineStyle,
        });
        s.setData(plot.data.map((p) => ({ time: p.time as Time, value: p.value })));
        seriesMapRef.current.set(key, s);
      }
    });

    if (hasSubpane) {
      try {
        chart.priceScale("python_indicator_subpane").applyOptions({
          scaleMargins: { top: 0.75, bottom: 0 },
        });
      } catch {
        // Price scale options applied
      }
    }

    return () => {
      for (const [_key, series] of seriesMapRef.current) {
        try {
          chart.removeSeries(series);
        } catch {
          // cleanup
        }
      }
      seriesMapRef.current.clear();
    };
  }, [enabled, plots, chartRef, candleSeriesRef, chartData]);
}
