import express, {
  type Application,
  type Request as ExpressRequest,
  type Response as ExpressResponse,
  type NextFunction,
} from "express";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";

const app: Application = express();
const httpServer = createServer(app);

function logHandlerError(event: string, error: unknown, req?: IncomingMessage | ExpressRequest) {
  const err = error instanceof Error ? error : new Error(String(error));
  const details = error && typeof error === "object"
    ? error as { code?: unknown }
    : {};
  const request = req as (IncomingMessage & {
    get?: (name: string) => string | undefined;
  }) | undefined;
  console.error(err);
  console.error(JSON.stringify({
    level: "error",
    component: "vercel-handler",
    event,
    method: req?.method ?? null,
    path: req?.url ?? null,
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

export function sendJsonError(res: ServerResponse, statusCode: number, payload: Record<string, unknown>) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  return res.end(JSON.stringify(payload));
}

export function describeSafeError(error: unknown) {
  const err = error instanceof Error ? error : new Error(String(error));
  const code = error && typeof error === "object" && "code" in error
    ? (error as { code?: unknown }).code
    : null;
  const message = err.message
    .replace(/(postgres(?:ql)?:\/\/[^:/\s]+:)[^@\s/]+@/gi, "$1[redacted]@")
    .replace(/([?&](?:password|token|secret)=)[^&\s]+/gi, "$1[redacted]")
    .slice(0, 500);
  return {
    name: err.name,
    code: typeof code === "string" ? code : null,
    message,
  };
}

app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: false, limit: "5mb" }));

// Request logger
app.use((req: ExpressRequest, res: ExpressResponse, next: NextFunction) => {
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
    ready = import("./routes.js")
      .then(({ registerRoutes }) => registerRoutes(httpServer, app))
      .then(() => {
      // Global error handler (must be registered AFTER routes)
      app.use((err: unknown, req: ExpressRequest, res: ExpressResponse, next: NextFunction) => {
        const details = err instanceof Error
          ? err as Error & { status?: number; statusCode?: number }
          : null;
        const status = details?.status || details?.statusCode || 500;
        const message = details?.message || "Internal Server Error";
        logHandlerError("request_failed", err, req);
        if (res.headersSent) return next(err);
        res.status(status).json({ message });
      });
      });
  }
  return ready;
}

// Export for Vercel: await ready then hand off to Express
export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<unknown> {
  try {
    await initializeApplication();
  } catch (err) {
    console.error("[Vercel] Application initialization failed:", err);
    logHandlerError("initialization_failed", err, req);
    return sendJsonError(res, 503, {
      code: "HANDLER_INITIALIZATION_FAILED",
      message: "Service initialization failed. Please try again.",
      diagnostic: describeSafeError(err),
    });
  }
  try {
    return app(req as ExpressRequest, res as ExpressResponse);
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
