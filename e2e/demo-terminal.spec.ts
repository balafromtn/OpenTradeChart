import { expect, test } from "./support/fixtures.ts";
import { waitForTerminal } from "./support/app.ts";

test.describe("OpenTradeChart Terminal Core", () => {
  test("renders terminal navigation, chart toolbars, drawing tools, and bottom panel tabs", async ({ page, hl }) => {
    await hl.open();
    await waitForTerminal(page);

    // Verify main chart area is mounted
    const chartCanvas = page.locator("canvas").first();
    await expect(chartCanvas).toBeVisible();

    // Verify timeframe selectors
    for (const tf of ["1m", "5m", "15m", "1h", "1d"]) {
      await expect(page.getByRole("button", { name: tf, exact: true })).toBeVisible();
    }

    // Verify Drawing Tool rail
    await expect(page.getByRole("button", { name: "Lines", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Fibonacci", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Shapes", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Trade", exact: true })).toBeVisible();

    // Verify Top Toolbar buttons
    await expect(page.getByRole("button", { name: "Indicators" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Data" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Python" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Strategy", exact: true })).toBeVisible();

    // Test opening Data manager modal
    await page.getByRole("button", { name: "Data" }).click();
    await expect(page.getByRole("heading", { name: "Custom Data Manager" })).toBeVisible();
    // Close modal
    await page.getByRole("button", { name: "Close dialog" }).click();

    // Verify Strategy Tab in bottom panel
    const strategyTab = page.getByRole("tab", { name: /Strategy & Backtest/i }).or(page.getByRole("button", { name: /Strategy & Backtest/i }));
    await expect(strategyTab).toBeVisible();
    await strategyTab.click();

    // Check Strategy UI controls
    await expect(page.getByRole("button", { name: /Run Backtest/i })).toBeVisible();
  });
});
