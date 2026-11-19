import type { OpenTradeChartAdapter } from "./types.ts";

/**
 * The adapter the terminal is currently running against.
 *
 * Held at module scope rather than in React context because the data layer is
 * reached from outside React too — the zustand stores and the demo feed both
 * call it. `<OpenTradeChartProvider>` sets this on mount, so applications never
 * touch the registry directly.
 *
 * One consequence worth knowing: a page runs one adapter at a time. Two
 * terminals side by side share it.
 */

let current: OpenTradeChartAdapter | null = null;
const listeners = new Set<(adapter: OpenTradeChartAdapter) => void>();

/** Install the adapter. Returns a function restoring the previous one. */
export function setAdapter(adapter: OpenTradeChartAdapter): () => void {
  const previous = current;
  current = adapter;
  for (const listener of [...listeners]) {
    try {
      listener(adapter);
    } catch (err) {
      console.error("[opentradechart] adapter listener threw", err);
    }
  }
  return () => {
    if (current === adapter) current = previous;
  };
}

/**
 * The active adapter.
 *
 * Throws when nothing is installed, because the alternative — silently
 * resolving to empty data — turns a wiring mistake into a blank chart with no
 * explanation.
 */
export function getAdapter(): OpenTradeChartAdapter {
  if (!current) {
    throw new Error(
      "[opentradechart] No adapter installed. Wrap the terminal in <OpenTradeChartProvider adapter={...}>, " +
        "or call setAdapter() before rendering. createDemoAdapter() runs against bundled data.",
    );
  }
  return current;
}

/** Whether an adapter is installed, for code that must not throw. */
export function hasAdapter(): boolean {
  return current !== null;
}

/** Notified whenever the adapter is replaced. */
export function onAdapterChange(listener: (adapter: OpenTradeChartAdapter) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Test seam. */
export function __clearAdapter(): void {
  current = null;
  listeners.clear();
}
