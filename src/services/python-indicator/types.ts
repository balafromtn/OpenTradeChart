export interface PythonPlotPoint {
  time: number;
  value: number;
  color?: string;
}

export type PythonPlotType = "line" | "histogram" | "area";
export type PythonPlotPane = "overlay" | "below";
export type PythonLineStyle = "solid" | "dashed" | "dotted";

export interface PythonPlotConfig {
  name: string;
  type?: PythonPlotType;
  color?: string;
  lineWidth?: number;
  lineStyle?: PythonLineStyle;
  pane?: PythonPlotPane;
  data: PythonPlotPoint[];
}

export interface PythonIndicatorResult {
  success: boolean;
  plots: PythonPlotConfig[];
  logs?: string[];
  error?: string;
  executionTimeMs?: number;
  runner?: "local-python" | "pyodide" | "js-fallback";
}

export interface PythonScriptTemplate {
  id: string;
  name: string;
  description: string;
  pane: PythonPlotPane;
  script: string;
}
