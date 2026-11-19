import { expect, test } from "./support/fixtures.ts";
import { waitForTerminal } from "./support/app.ts";

test.describe("Strategy Backtesting (OpenAlgo Engine)", () => {
  test("loads Strategy & Backtest panel, runs EMA crossover, displays KPIs, equity curve and trades", async ({ page, hl }) => {
    await hl.open();
    await waitForTerminal(page);

    // Click the Strategy & Backtest tab in the bottom panel
    const strategyTab = page.getByRole("tab", { name: /Strategy & Backtest/i }).or(page.getByRole("button", { name: /Strategy & Backtest/i }));
    await strategyTab.click();

    // Verify Strategy controls are visible
    const runBtn = page.getByRole("button", { name: /Run Backtest/i });
    await expect(runBtn).toBeVisible();

    // Strategy selector dropdown
    const strategySelect = page.locator("select").first();
    await expect(strategySelect).toBeVisible();

    // Run the default strategy (EMA Crossover)
    await runBtn.click();

    // Check KPI summary cards
    await expect(page.getByText(/Net Profit/i).first()).toBeVisible();
    await expect(page.getByText(/Win Rate/i).first()).toBeVisible();
    await expect(page.getByText(/Profit Factor/i).first()).toBeVisible();
    await expect(page.getByText(/Max Drawdown/i).first()).toBeVisible();

    // Verify the Equity Curve SVG rendered
    const equitySvg = page.locator("svg").filter({ hasText: /Equity/i }).or(page.locator("svg path").first());
    await expect(equitySvg).toBeVisible();

    // Click the Trades tab in the strategy panel to view individual trades
    const tradesSubTab = page.getByRole("button", { name: /^Trades\s*\(/i });
    if (await tradesSubTab.isVisible()) {
      await tradesSubTab.click();
      // Verify trade table headers
      await expect(page.getByText(/Entry Time/i)).toBeVisible();
      await expect(page.getByText(/Side/i).first()).toBeVisible();
      await expect(page.getByText(/P&L/i).first()).toBeVisible();
    }
  });

  test("can switch to Supertrend strategy and execute backtest", async ({ page, hl }) => {
    await hl.open();
    await waitForTerminal(page);

    const strategyTab = page.getByRole("tab", { name: /Strategy & Backtest/i }).or(page.getByRole("button", { name: /Strategy & Backtest/i }));
    await strategyTab.click();

    // Select Supertrend from dropdown
    const strategySelect = page.locator("select").first();
    await strategySelect.selectOption("supertrend_trend");

    // Click Parameters button to open settings
    const paramsBtn = page.getByRole("button", { name: /Parameters/i });
    await paramsBtn.click();

    // Verify Supertrend parameters appear
    await expect(page.getByText(/ATR Period/i)).toBeVisible();
    await expect(page.getByText(/ATR Multiplier/i)).toBeVisible();

    // Run backtest
    const runBtn = page.getByRole("button", { name: /Run Backtest/i });
    await runBtn.click();

    // Ensure backtest metrics calculate
    await expect(page.getByText(/Win Rate/i).first()).toBeVisible();
  });
});
