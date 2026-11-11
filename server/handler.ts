import express, { type Request, Response, NextFunction } from "express";
import { createServer } from "http";

const app = express();
const httpServer = createServer(app);

function logHandlerError(event: string, error: unknown, req?: Request) {
  const err = error instanceof Error ? error : new Error(String(error));
  const details = error && typeof error === "object"
    ? error as { code?: unknown }
    : {};
  const request = req as (Request & {
    headers?: Record<string, string | string[] | undefined>;
    get?: (name: string) => string | undefined;
  }) | undefined;
  console.error(err);
  console.error(JSON.stringify({
    level: "error",
    component: "vercel-handler",
    event,
    method: req?.method ?? null,
    path: req?.path ?? null,
    requestId: request?.get?.("x-vercel-id")
      || request?.get?.("x-request-id")
      || request?.headers?.["x-vercel-id"]
      || request?.headers?.["x-request-id"]
      || null,
    error: {
      name: err.name,
      code: typeof details.code === "string" ? details.code : null,
      message: err.message,
      stack: err.stack,
    },
  }));
}

export function sendJsonError(res: any, statusCode: number, payload: Record<string, unknown>) {
  // Initialization can fail before Express decorates Vercel's native
  // ServerResponse with .status() and .json().
  if (typeof res.status === "function" && typeof res.json === "function") {
    return res.status(statusCode).json(payload);
  }
  res.statusCode = statusCode;
  res.setHeader?.("Content-Type", "application/json; charset=utf-8");
  return res.end(JSON.stringify(payload));
}

app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: false, limit: "5mb" }));

// Request logger
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  res.on("finish", () => {
    if (path.startsWith("/api")) {
      console.log(`${req.method} ${path} ${res.statusCode} in ${Date.now() - start}ms`);
    }
  });
  next();
});

// Register all routes (auth + API) — returns a Promise
let ready: Promise<void> | null = null;

function initializeApplication(): Promise<void> {
  if (!ready) {
    ready = import("./routes")
      .then(({ registerRoutes }) => registerRoutes(httpServer, app))
      .then(() => {
      // Global error handler (must be registered AFTER routes)
      app.use((err: any, req: Request, res: Response, next: NextFunction) => {
        const status = err.status || err.statusCode || 500;
        const message = err.message || "Internal Server Error";
        logHandlerError("request_failed", err, req);
        if (res.headersSent) return next(err);
        res.status(status).json({ message });
      });
      });
  }
  return ready;
}

// Export for Vercel: await ready then hand off to Express
export default async function handler(req: any, res: any) {
  try {
    await initializeApplication();
  } catch (err) {
    console.error("[Vercel] Application initialization failed:", err);
    logHandlerError("initialization_failed", err, req);
    return sendJsonError(res, 503, {
      code: "HANDLER_INITIALIZATION_FAILED",
      message: "Service initialization failed. Please try again.",
    });
  }
  try {
    return app(req, res);
  } catch (err) {
    logHandlerError("invocation_failed", err, req);
    if (!res.headersSent) {
      return sendJsonError(res, 500, {
        code: "HANDLER_INVOCATION_FAILED",
        message: "A server error occurred. Please try again.",
      });
    }
    throw err;
  }
}
