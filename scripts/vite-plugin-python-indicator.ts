import type { Plugin } from "vite";
import { spawn } from "child_process";

/**
 * Vite Dev Server Plugin: executes custom Python indicators natively.
 * Endpoint: POST /api/python-indicator
 */
export function pythonIndicatorDevPlugin(): Plugin {
  return {
    name: "opentradechart-python-indicator-server",
    configureServer(server) {
      server.middlewares.use("/api/python-indicator", (req: any, res: any) => {
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
            const { script, candles } = JSON.parse(rawBody);

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

try:
    payload = json.loads(sys.stdin.read())
    candles = payload.get("candles", [])
    user_script = payload.get("script", "")

    opens = [float(c.get("open", 0)) for c in candles]
    highs = [float(c.get("high", 0)) for c in candles]
    lows = [float(c.get("low", 0)) for c in candles]
    closes = [float(c.get("close", 0)) for c in candles]
    volumes = [float(c.get("volume", 0)) for c in candles]
    times = [int(c.get("time", 0)) for c in candles]

    # Captured stdout for user prints
    captured_logs = io.StringIO()
    sys.stdout = captured_logs

    scope = {
        "candles": candles,
        "opens": opens,
        "highs": highs,
        "lows": lows,
        "closes": closes,
        "volumes": volumes,
        "times": times,
        "output": None,
        "plots": None,
        "result": None,
    }

    exec(user_script, scope)

    sys.stdout = sys.__stdout__
    logs = [line for line in captured_logs.getvalue().splitlines() if line.strip()]

    out = scope.get("output")
    if out is None:
        out = scope.get("plots")
    if out is None:
        out = scope.get("result")

    # If user script defined a function calculate(candles):
    if out is None and "calculate" in scope and callable(scope["calculate"]):
        out = scope["calculate"](candles)

    print(json.dumps({
        "success": True,
        "plots": out,
        "logs": logs
    }))
except Exception as e:
    sys.stdout = sys.__stdout__
    err_msg = f"{type(e).__name__}: {str(e)}"
    print(json.dumps({
        "success": False,
        "error": err_msg,
        "traceback": traceback.format_exc(),
        "logs": []
    }))
`;

            let child: ReturnType<typeof spawn> | null = null;
            let lastErr: any = null;

            for (const pyPath of pythonPaths) {
              try {
                child = spawn(pyPath, ["-c", pythonCode], {
                  windowsHide: true,
                  stdio: ["pipe", "pipe", "pipe"],
                });
                break;
              } catch (e) {
                lastErr = e;
              }
            }

            if (!child) {
              res.statusCode = 500;
              res.setHeader("Content-Type", "application/json");
              res.end(
                JSON.stringify({
                  success: false,
                  error: `Could not launch Python: ${lastErr?.message || lastErr}`,
                }),
              );
              return;
            }

            let stdout = "";
            let stderr = "";

            child.stdout?.on("data", (d: Buffer) => {
              stdout += d.toString();
            });
            child.stderr?.on("data", (d: Buffer) => {
              stderr += d.toString();
            });

            child.on("error", (spawnErr: any) => {
              res.statusCode = 500;
              res.setHeader("Content-Type", "application/json");
              res.end(
                JSON.stringify({
                  success: false,
                  error: `Python process failed to spawn: ${spawnErr?.message || spawnErr}`,
                }),
              );
            });

            child.on("close", () => {
              res.setHeader("Content-Type", "application/json");
              const trimmed = stdout.trim();
              if (trimmed) {
                try {
                  const parsed = JSON.parse(trimmed);
                  res.end(JSON.stringify(parsed));
                  return;
                } catch {
                  // Fallback
                }
              }

              res.end(
                JSON.stringify({
                  success: false,
                  error: stderr.trim() || trimmed || "Unknown error executing Python script",
                  logs: [],
                }),
              );
            });

            child.stdin?.write(JSON.stringify({ script, candles }));
            child.stdin?.end();
          } catch (err: any) {
            res.statusCode = 500;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ success: false, error: err?.message || String(err) }));
          }
        });
      });
    },
  };
}
