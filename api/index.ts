import type { VercelRequest, VercelResponse } from "@vercel/node";

function sendJsonError(res: VercelResponse, statusCode: number, payload: Record<string, unknown>) {
  if (res.headersSent) return;
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
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

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<unknown> {
  let appHandler: (request: VercelRequest, response: VercelResponse) => unknown;
  try {
    const server = await import("../server/handler.js");
    if (typeof server.default !== "function") {
      throw new TypeError("server/handler does not expose a callable request handler");
    }
    appHandler = server.default;
  } catch (error) {
    console.error("[Vercel] Server handler import failed:", error);
    const requestId = req.headers["x-vercel-id"] ?? req.headers["x-request-id"] ?? null;
    return sendJsonError(res, 503, {
      code: "SERVER_HANDLER_IMPORT_FAILED",
      message: "Service initialization failed. Please try again.",
      requestId,
      diagnostic: describeSafeError(error),
    });
  }

  try {
    return await appHandler(req, res);
  } catch (error) {
    console.error("[Vercel] Server handler request failed:", error);
    const requestId = req.headers["x-vercel-id"] ?? req.headers["x-request-id"] ?? null;
    return sendJsonError(res, 500, {
      code: "SERVER_HANDLER_REQUEST_FAILED",
      message: "A server error occurred. Please try again.",
      requestId,
      diagnostic: describeSafeError(error),
    });
  }
}
