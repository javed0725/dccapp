import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { createServer } from "http";

const app = express();
const httpServer = createServer(app);

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

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
    app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";
      console.error("[Handler] Error:", err);
      if (res.headersSent) return next(err);
      res.status(status).json({ message });
    });
  })
  .catch((err) => {
    console.error("[Handler] FATAL: Failed to initialize routes:", err);
    // Don't re-throw — let the handler below return a 503 instead of crashing
  });

// Export for Vercel: await ready then hand off to Express
export default async function handler(req: any, res: any) {
  try {
    await ready;
  } catch (err) {
    console.error("[Handler] Initialization error on request:", err);
    return res.status(503).json({ message: "Service initializing, please retry." });
  }
  return app(req, res);
}
