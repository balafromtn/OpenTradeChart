import type { Plugin } from "vite";
import fs from "fs";
import path from "path";

/**
 * Vite Dev Server Plugin: Local Physical Storage for Imported Datasets.
 *
 * Saves imported CSVs and resampled candle series directly to the project's
 * `data/custom/` directory on disk. This ensures that even if a user clears
 * their browser cache, cookies, or site data, all their imported datasets
 * remain permanently safe on the local computer and are automatically restored.
 *
 * Endpoints:
 * - GET  /api/custom-data/list
 * - GET  /api/custom-data/candles?symbol=...&tf=...
 * - POST /api/custom-data/save
 * - DELETE /api/custom-data/:symbol
 */
export function customDataStoragePlugin(): Plugin {
  return {
    name: "opentradechart-custom-data-storage",
    configureServer(server) {
      const dataDir = path.resolve(process.cwd(), "data", "custom");

      function ensureDir(dirPath: string) {
        if (!fs.existsSync(dirPath)) {
          fs.mkdirSync(dirPath, { recursive: true });
        }
      }

      function getSymbolsFile(): string {
        ensureDir(dataDir);
        return path.join(dataDir, "symbols.json");
      }

      function readSymbols(): any[] {
        const file = getSymbolsFile();
        if (!fs.existsSync(file)) return [];
        try {
          const raw = fs.readFileSync(file, "utf-8");
          const parsed = JSON.parse(raw);
          return Array.isArray(parsed) ? parsed : [];
        } catch {
          return [];
        }
      }

      function writeSymbols(symbols: any[]) {
        const file = getSymbolsFile();
        fs.writeFileSync(file, JSON.stringify(symbols, null, 2), "utf-8");
      }

      server.middlewares.use(async (req: any, res: any, next: () => void) => {
        const url = req.url ? req.url.split("?")[0] : "";

        // Route: /api/custom-data/list
        if (url === "/api/custom-data/list" && req.method === "GET") {
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify(readSymbols()));
          return;
        }

        // Route: /api/custom-data/candles?symbol=...&tf=...
        if (url === "/api/custom-data/candles" && req.method === "GET") {
          const parsedUrl = new URL(req.url, "http://localhost");
          const symbol = parsedUrl.searchParams.get("symbol");
          const tf = parsedUrl.searchParams.get("tf");

          if (!symbol || !tf) {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: "Missing symbol or tf query parameter" }));
            return;
          }

          const candleFile = path.join(dataDir, symbol.toUpperCase(), `${tf}.json`);
          if (fs.existsSync(candleFile)) {
            res.setHeader("Content-Type", "application/json");
            fs.createReadStream(candleFile).pipe(res);
            return;
          } else {
            res.statusCode = 404;
            res.end(JSON.stringify({ error: "Candles not found" }));
            return;
          }
        }

        // Route: /api/custom-data/save
        if (url === "/api/custom-data/save" && req.method === "POST") {
          const chunks: Buffer[] = [];
          req.on("data", (chunk: Buffer) => chunks.push(chunk));
          req.on("end", () => {
            try {
              const rawBody = Buffer.concat(chunks).toString("utf-8");
              const { metadata, seriesMap, rawCsv } = JSON.parse(rawBody);

              if (!metadata || !metadata.symbol || !seriesMap) {
                res.statusCode = 400;
                res.end(JSON.stringify({ success: false, error: "Invalid payload: metadata and seriesMap required" }));
                return;
              }

              const symName = metadata.symbol.toUpperCase();
              const symbolDir = path.join(dataDir, symName);
              ensureDir(symbolDir);

              // 1. Save raw CSV if provided
              if (typeof rawCsv === "string" && rawCsv.length > 0) {
                fs.writeFileSync(path.join(symbolDir, "raw.csv"), rawCsv, "utf-8");
              }

              // 2. Save each timeframe JSON
              for (const [tf, candles] of Object.entries(seriesMap)) {
                fs.writeFileSync(
                  path.join(symbolDir, `${tf}.json`),
                  JSON.stringify(candles),
                  "utf-8"
                );
              }

              // 3. Update symbols list
              const existing = readSymbols();
              const filtered = existing.filter((s: any) => s.symbol !== symName);
              filtered.push(metadata);
              writeSymbols(filtered);

              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ success: true, symbol: symName }));
            } catch (err: any) {
              res.statusCode = 500;
              res.end(JSON.stringify({ success: false, error: err.message }));
            }
          });
          return;
        }

        // Route: /api/custom-data/delete
        if (url === "/api/custom-data/delete" && req.method === "POST") {
          const chunks: Buffer[] = [];
          req.on("data", (chunk: Buffer) => chunks.push(chunk));
          req.on("end", () => {
            try {
              const { symbol } = JSON.parse(Buffer.concat(chunks).toString("utf-8"));
              if (!symbol) {
                res.statusCode = 400;
                res.end(JSON.stringify({ error: "Missing symbol" }));
                return;
              }

              const symName = symbol.toUpperCase();
              const symbolDir = path.join(dataDir, symName);
              if (fs.existsSync(symbolDir)) {
                fs.rmSync(symbolDir, { recursive: true, force: true });
              }

              const existing = readSymbols();
              const filtered = existing.filter((s: any) => s.symbol !== symName);
              writeSymbols(filtered);

              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ success: true }));
            } catch (err: any) {
              res.statusCode = 500;
              res.end(JSON.stringify({ success: false, error: err.message }));
            }
          });
          return;
        }

        next();
      });
    },
  };
}
