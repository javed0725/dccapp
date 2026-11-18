import type { IncomingMessage, ServerResponse } from "node:http";

// The Vercel build script generates this bundled backend before function
// packaging; the local type-check intentionally runs without that artifact.
// @ts-ignore
import bundledServer from "../dist/serverless-handler.cjs";

type ServerlessHandler = (
  request: IncomingMessage,
  response: ServerResponse
) => unknown;

function loadServerlessHandler(): ServerlessHandler {
  const serverModule = bundledServer as { default?: unknown };
  if (typeof serverModule.default !== "function") {
    throw new TypeError("Prebuilt serverless handler does not expose a callable default export");
  }
  return serverModule.default as ServerlessHandler;
}

function sendJsonError(res: ServerResponse, statusCode: number, payload: Record<string, unknown>) {
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

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<unknown> {
  let appHandler: (request: IncomingMessage, response: ServerResponse) => unknown;
  try {
    appHandler = loadServerlessHandler();
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
