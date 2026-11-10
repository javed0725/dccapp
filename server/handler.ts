import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { createServer } from "http";

const app = express();
const httpServer = createServer(app);

function logHandlerError(event: string, error: unknown, req?: Request) {
  const err = error instanceof Error ? error : new Error(String(error));
  const details = error && typeof error === "object"
    ? error as { code?: unknown }
    : {};
  console.error(JSON.stringify({
    level: "error",
    component: "vercel-handler",
    event,
    method: req?.method ?? null,
    path: req?.path ?? null,
    requestId: req?.get("x-vercel-id") || req?.get("x-request-id") || null,
    error: {
      name: err.name,
      code: typeof details.code === "string" ? details.code : null,
      message: err.message,
      stack: err.stack,
    },
  }));
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
const ready = registerRoutes(httpServer, app)
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

// Export for Vercel: await ready then hand off to Express
export default async function handler(req: any, res: any) {
  try {
    await ready;
  } catch (err) {
    logHandlerError("initialization_failed", err, req);
    return res.status(503).json({ message: "Service initializing, please retry." });
  }
  try {
    return app(req, res);
  } catch (err) {
    logHandlerError("invocation_failed", err, req);
    if (!res.headersSent) {
      return res.status(500).json({ message: "A server error occurred. Please try again." });
    }
    throw err;
  }
}
