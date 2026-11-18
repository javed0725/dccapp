import type { Request, Response } from "express";

function sendJsonError(res: Response, statusCode: number, payload: Record<string, unknown>) {
  if (res.headersSent) return;
  res.statusCode = statusCode;
  res.setHeader?.("Content-Type", "application/json; charset=utf-8");
  return res.end(JSON.stringify(payload));
}

function describeSafeError(error: unknown) {
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

type VercelRequestHandler = (request: Request, response: Response) => unknown;

export default async function handler(req: Request, res: Response): Promise<unknown> {
  let server: typeof import("../server/handler.js");
  try {
    server = await import("../server/handler.js");
  } catch (error) {
    console.error("[Vercel] Server handler import failed:", error);
    const requestId = req?.headers?.["x-vercel-id"] ?? req?.headers?.["x-request-id"] ?? null;
    return sendJsonError(res, 503, {
      code: "SERVER_HANDLER_IMPORT_FAILED",
      message: "Service initialization failed. Please try again.",
      requestId,
      diagnostic: describeSafeError(error),
    });
  }

  const exported = server as unknown as Record<string, unknown>;
  const defaultExport = exported.default;
  let appHandler: VercelRequestHandler | null =
    typeof defaultExport === "function"
      ? defaultExport as VercelRequestHandler
      : null;
  if (!appHandler && defaultExport && typeof defaultExport === "object") {
    const nestedDefault = (defaultExport as { default?: unknown }).default;
    if (typeof nestedDefault === "function") {
      appHandler = nestedDefault as VercelRequestHandler;
    }
  }
  if (!appHandler && typeof exported.handler === "function") {
    appHandler = exported.handler as VercelRequestHandler;
  }
  if (!appHandler) {
    const error = new TypeError("server/handler does not expose a callable request handler");
    console.error("[Vercel] Server handler export is invalid:", error);
    return sendJsonError(res, 503, {
      code: "SERVER_HANDLER_EXPORT_INVALID",
      message: "Service initialization failed. Please try again.",
      diagnostic: describeSafeError(error),
    });
  }

  try {
    return await appHandler(req, res);
  } catch (error) {
    console.error("[Vercel] Server handler request failed:", error);
    const requestId = req?.headers?.["x-vercel-id"] ?? req?.headers?.["x-request-id"] ?? null;
    return sendJsonError(res, 500, {
      code: "SERVER_HANDLER_REQUEST_FAILED",
      message: "A server error occurred. Please try again.",
      requestId,
      diagnostic: describeSafeError(error),
    });
  }
}
