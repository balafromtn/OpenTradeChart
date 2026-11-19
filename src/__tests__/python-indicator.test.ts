import { describe, it, expect, beforeEach } from "vitest";
import { usePythonIndicatorStore } from "../services/python-indicator/store.ts";
import { PYTHON_TEMPLATES } from "../services/python-indicator/templates.ts";
import type { Candle } from "../services/schemas.ts";

describe("Python Indicator System", () => {
  const mockCandles: Candle[] = Array.from({ length: 60 }, (_, i) => ({
    time: 1700000000 + i * 60,
    open: 100 + i * 0.5,
    high: 102 + i * 0.5,
    low: 99 + i * 0.5,
    close: 101 + i * 0.5,
    volume: 1000 + i * 10,
  }));

  beforeEach(() => {
    usePythonIndicatorStore.setState({
      script: PYTHON_TEMPLATES[0]!.script,
      enabled: false,
      selectedTemplateId: PYTHON_TEMPLATES[0]!.id,
      plots: [],
      logs: [],
      status: "idle",
      error: null,
      executionTimeMs: 0,
      runner: null,
    });
  });

  it("loads templates correctly", () => {
    const store = usePythonIndicatorStore.getState();
    expect(PYTHON_TEMPLATES.length).toBeGreaterThan(3);

    const rsiTemplate = PYTHON_TEMPLATES.find((t) => t.id === "rsi_oscillator");
    expect(rsiTemplate).toBeDefined();

    store.loadTemplate("rsi_oscillator");

    const updated = usePythonIndicatorStore.getState();
    expect(updated.selectedTemplateId).toBe("rsi_oscillator");
    expect(updated.script).toContain("RSI");
  });

  it("toggles enabled state properly", () => {
    const store = usePythonIndicatorStore.getState();
    expect(store.enabled).toBe(false);

    store.toggleEnabled();
    expect(usePythonIndicatorStore.getState().enabled).toBe(true);

    store.toggleEnabled();
    expect(usePythonIndicatorStore.getState().enabled).toBe(false);
  });

  it("updates script code and preserves it", () => {
    const store = usePythonIndicatorStore.getState();
    const customCode = "output = [{'time': 12345, 'value': 42.0}]";

    store.setScript(customCode);
    expect(usePythonIndicatorStore.getState().script).toBe(customCode);
  });

  it("clears plots correctly", () => {
    usePythonIndicatorStore.setState({
      plots: [
        {
          name: "Test Plot",
          type: "line",
          data: [{ time: mockCandles[0]!.time, value: 50 }],
        },
      ],
      status: "success",
    });

    usePythonIndicatorStore.getState().clearPlots();
    expect(usePythonIndicatorStore.getState().plots).toHaveLength(0);
    expect(usePythonIndicatorStore.getState().status).toBe("idle");
  });
});
