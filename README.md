<div align="center">

# 📈 OpenTradeChart

**A professional, open-source web trading terminal with advanced charting, drawing tools, paper trading, custom CSV data imports, and strategy backtesting.**

Interactive Candlestick Charts · Technical Indicators · Full Drawing Suite · Paper Trading Engine · Custom CSV Data Importer with IndexedDB Persistence · OpenAlgo Strategy Backtesting · Python Indicator & Strategy Engine

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](NOTICE)
[![Node](https://img.shields.io/badge/node-%E2%89%A520-brightgreen.svg)](https://nodejs.org)

</div>

---

## Table of Contents

- [Overview](#overview)
- [Key Features](#key-features)
  - [1. Advanced Charting](#1-advanced-charting)
  - [2. Drawing Tools Suite](#2-drawing-tools-suite)
  - [3. Indicators & Custom Python Scripts](#3-indicators--custom-python-scripts)
  - [4. Built-in Paper Trading Engine](#4-built-in-paper-trading-engine)
  - [5. Custom CSV Import & Persistent Storage (IndexedDB)](#5-custom-csv-import--persistent-storage-indexeddb)
  - [6. OpenAlgo Strategy Backtesting Engine](#6-openalgo-strategy-backtesting-engine)
- [Adapters & Data Sources](#adapters--data-sources)
- [Project Architecture](#project-architecture)
- [Quick Start](#quick-start)
- [Available Scripts](#available-scripts)
- [Testing & Quality Gates](#testing--quality-gates)
- [Attribution & License](#attribution--license)

---

## Overview

**OpenTradeChart** is a self-contained, high-performance web trading terminal built with React, TypeScript, Tailwind CSS, and TradingView's Lightweight Charts™. It delivers a complete trading workspace directly in the browser: real-time candlestick charts, technical drawings, order placement, position management, custom CSV data importing, and strategy backtesting with no external backend required.

---

## Key Features

### 1. Advanced Charting
* **TradingView Lightweight Charts™ v4**: Smooth GPU-accelerated rendering of candlesticks, volume histograms, and technical overlays.
* **Multi-Timeframe Support**: Instant switching across 1m, 5m, 15m, 30m, 1h, 4h, 1d, and 1w.
* **Chart Plugins**: Crosshair highlight, session highlighting, session breaks, bands indicator, OHLCV tooltip, and multi-touch delta measurement.
* **Preferences & Templates**: Customizable color palettes, grid lines, crosshair modes, and chart templates persisted in local storage.

### 2. Drawing Tools Suite
* **Lines & Channels**: Trend line, ray, extended line, horizontal line, vertical line, and parallel channels.
* **Fibonacci Tools**: Fibonacci retracement and extension.
* **Geometric Shapes**: Rectangle, ellipse, triangle, and arrow markers.
* **Risk/Reward Position Tools**: Long and short position projection tools calculating risk, return, and position size relative to account equity.
* **Annotations**: Interactive text labels, draggable anchors, and measurement rulers.

### 3. Indicators & Custom Python Scripts
* **Built-in Indicators**: SMA, EMA, RSI, MACD, Bollinger Bands, ATR, Stochastic, and VWAP.
* **Custom Python Indicators**: Write and evaluate custom Python scripts using pandas and numpy, with results streamed directly to the chart pane.

### 4. Built-in Paper Trading Engine
* **Instant In-Browser Execution**: Seeded with a \$100,000 paper trading account.
* **Order Types**: Market, limit, and stop orders with integrated Take-Profit (TP) and Stop-Loss (SL).
* **Live Mark-to-Market**: Real-time position tracking, unrealized/realized P&L calculation, and trade history ledger.

### 5. Custom CSV Import & Persistent Storage (IndexedDB)
* **Import Any Instrument**: Upload historical candle data in standard CSV format for Gold (XAUUSD), Forex pairs, equities, indices, or crypto.
* **Automated Multi-Timeframe Resampling**: Generates 1m, 5m, 15m, 30m, 1h, 4h, 1d, and 1w intervals from raw bar data.
* **IndexedDB Client-Side Persistence**: Imported datasets are stored in browser IndexedDB, persisting reliably across tab refreshes, browser reboots, and storage cleanups.
* **Dataset Management**: View, switch between, and delete imported datasets directly within the terminal UI.

### 6. OpenAlgo Strategy Backtesting Engine
OpenTradeChart integrates the quantitative backtesting architecture from **OpenAlgo**:
* **Bar-Path Simulation Model**: Reconstructs realistic intra-bar price paths ($\text{Open} \to \text{Adverse} \to \text{Favourable} \to \text{Close}$). If both Stop Loss and Take Profit fall within the bar range, the adverse extreme is tested first to eliminate optimistic bias.
* **Strict No-Lookahead Execution**: Signals generated on bar $i$ execute at bar $i+1$'s Open price adjusted by slippage.
* **Cost & Friction Modeling**:
  * Turnover percentage commission ($\text{Turnover} \times \frac{\text{cost}}{100}$)
  * Per-order flat brokerage fee
  * Configurable slippage (ticks / points)
* **Risk & Position Controls**:
  * Take Profit (%) and Stop Loss (%)
  * Dynamic Trailing Stop Loss
  * Maximum hold limit (exit after $N$ bars)
  * Position sizing (Fixed Quantity, % Equity, Fixed Cash)
* **Built-in Strategies**:
  * OpenAlgo EMA Crossover
  * OpenAlgo Supertrend
  * OpenAlgo RSI Mean Reversion
  * OpenAlgo Bollinger Breakout
  * OpenAlgo MACD Momentum
  * Custom OpenAlgo Python Strategy
* **Performance Analytics & Curves**:
  * Net Profit (\$), Return (%), Benchmark Return (%)
  * Win Rate (%), Total Trades, Win / Loss Counts
  * Profit Factor, Average Win / Loss, Expectancy
  * Max Drawdown (\$) and Max Drawdown (%)
  * Interactive SVG Equity & Underwater Drawdown visualization
* **Trade Reporting & Chart Overlays**:
  * Complete trade log with execution reasons (Signal, SL, TP, Trailing SL, Max Bars)
  * One-click CSV export of all backtest trades
  * On-chart trade markers displaying buy/sell entry points and exit P&L labels

---

## Adapters & Data Sources

OpenTradeChart connects to backends through a modular adapter interface (`OpenTradeChartAdapter`):

1. **Demo Adapter (Default)**: Pre-bundled with Binance-seeded historical crypto klines and tick generator for instant zero-config exploration.
2. **Custom CSV Adapter**: Loads user-imported instruments with local IndexedDB persistence.
3. **Hyperliquid Adapter**: Direct integration with the Hyperliquid decentralized perpetual exchange, supporting Web3 wallet connection, EIP-6963 discovery, agent key signing, and live order execution.
4. **Binance Live Adapter**: Example live market data stream via Binance public WebSocket and REST endpoints.

---

## Quick Start

### Prerequisites
* Node.js $\ge 20$
* npm or pnpm

### Installation

```bash
# Clone the repository and navigate into the project directory
cd OpenTradeChart

# Install dependencies
npm install

# Start the local development server
npm run dev
```

Open `http://localhost:5173` in your browser to launch the terminal.

---

## Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Starts the Vite development server with hot-module reloading |
| `npm run build` | Builds the production-ready web application bundle |
| `npm run preview` | Previews the production build locally |
| `npm run typecheck` | Runs `tsc --noEmit` to verify TypeScript types strictly |
| `npm run lint` | Runs ESLint 9 checks across the codebase |
| `npm run test` | Runs the Vitest test suite |
| `npm run test:watch` | Runs Vitest in interactive watch mode |
| `npm run e2e:hl` | Runs Playwright end-to-end test suite |
| `npm run build:lib` | Builds the distributable component library bundle |

---

## Testing & Quality Gates

The codebase maintains strict quality and reliability standards:
* **Strict Type Safety**: Zero TypeScript compilation errors (`npm run typecheck`).
* **Unit & Integration Tests**: Comprehensive Vitest coverage for indicators, paper trading engine, drawing mathematics, storage drivers, and the OpenAlgo backtest simulation engine.
* **End-to-End Verification**: Playwright test suites covering terminal workflows, orders, and UI interactions.

---

## Attribution & License

OpenTradeChart is released under the **MIT License**.

This project incorporates **TradingView Lightweight Charts™** (Apache License 2.0). In compliance with TradingView attribution requirements, the built-in attribution notice and link to [TradingView](https://www.tradingview.com/) remain intact within the chart canvas layout. Refer to [NOTICE](NOTICE) for complete licensing and copyright notices.
