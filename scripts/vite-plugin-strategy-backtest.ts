import type { Plugin } from "vite";
import { spawn } from "child_process";

/**
 * Vite Dev Server Plugin: Executes Python Backtesting Strategies natively.
 * Endpoint: POST /api/strategy-backtest
 */
export function strategyBacktestDevPlugin(): Plugin {
  return {
    name: "opentradechart-strategy-backtest-server",
    configureServer(server) {
      server.middlewares.use("/api/strategy-backtest", (req: any, res: any) => {
        if (req.method !== "POST") {
          res.statusCode = 405;
          res.end(JSON.stringify({ error: "Method not allowed" }));
          return;
        }

        const chunks: Buffer[] = [];
        req.on("data", (chunk: Buffer) => chunks.push(chunk));
        req.on("end", () => {
          try {
            const rawBody = Buffer.concat(chunks).toString("utf-8");
            const { script, candles, settings, meta } = JSON.parse(rawBody);

            if (!script || !Array.isArray(candles)) {
              res.statusCode = 400;
              res.setHeader("Content-Type", "application/json");
              res.end(
                JSON.stringify({
                  success: false,
                  error: "Invalid request payload: script and candles required",
                }),
              );
              return;
            }

            const pythonPaths = [
              process.env.PYTHON_PATH,
              "C:\\Users\\Balaji\\AppData\\Local\\Python\\bin\\python.exe",
              "python",
              "py",
              "python3",
            ].filter(Boolean) as string[];

            const pythonCode = `
import sys
import json
import io
import traceback
import math

try:
    payload = json.loads(sys.stdin.read())
    candles = payload.get("candles", [])
    script = payload.get("script", "")
    settings = payload.get("settings", {})
    meta = payload.get("meta", {})

    scope = {
        "candles": candles,
        "math": math,
    }

    # Execute user strategy script
    exec(script, scope)

    # Determine signals
    signals_func = scope.get("signals")
    if callable(signals_func):
        # If user passed a signals() function
        try:
            import pandas as pd
            df = pd.DataFrame(candles)
            res = signals_func(df)
            if hasattr(res, "to_dict"):
                signals_res = res.to_dict(orient="list")
            elif isinstance(res, dict):
                signals_res = res
            else:
                signals_res = {}
        except Exception:
            # Fallback passing candles directly
            signals_res = signals_func(candles)
    else:
        signals_res = scope.get("signals_output", {})

    out = {
        "success": True,
        "signals": signals_res
    }
    print("___JSON_START___" + json.dumps(out) + "___JSON_END___")
except Exception as e:
    err = traceback.format_exc()
    out = {
        "success": False,
        "error": err
    }
    print("___JSON_START___" + json.dumps(out) + "___JSON_END___")
`;

            let executed = false;
            for (const pyCmd of pythonPaths) {
              try {
                const child = spawn(pyCmd, ["-c", pythonCode], {
                  env: { ...process.env, PYTHONIOENCODING: "utf-8" },
                });

                let stdoutData = "";
                let stderrData = "";

                child.stdout.on("data", (d) => {
                  stdoutData += d.toString();
                });
                child.stderr.on("data", (d) => {
                  stderrData += d.toString();
                });

                child.on("close", (code) => {
                  if (executed) return;
                  executed = true;

                  const match = stdoutData.match(/___JSON_START___([\s\S]*?)___JSON_END___/);
                  if (match && match[1]) {
                    res.setHeader("Content-Type", "application/json");
                    res.end(match[1]);
                  } else {
                    res.setHeader("Content-Type", "application/json");
                    res.end(
                      JSON.stringify({
                        success: false,
                        error: stderrData || stdoutData || `Process exited with code ${code}`,
                      }),
                    );
                  }
                });

                child.on("error", () => {
                  // try next python executable
                });

                child.stdin.write(rawBody);
                child.stdin.end();
                break;
              } catch {
                continue;
              }
            }
          } catch (err: any) {
            res.statusCode = 500;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ success: false, error: err.message }));
          }
        });
      });
    },
  };
}
