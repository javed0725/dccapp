// ESM file (package.json has "type":"module").
// createRequire lets ESM load the pre-compiled CJS handler without issues.
import { createRequire } from "module";
const require = createRequire(import.meta.url);

function logInvocationError(event, error, req) {
  const err = error instanceof Error ? error : new Error(String(error));
  const code = error && typeof error === "object" && "code" in error
    ? error.code
    : null;
  console.error(JSON.stringify({
    level: "error",
    component: "vercel-entrypoint",
    event,
    requestId: req?.headers?.["x-vercel-id"] ?? req?.headers?.["x-request-id"] ?? null,
    error: {
      name: err.name,
      code: typeof code === "string" ? code : null,
      message: err.message,
      stack: err.stack,
    },
  }));
}

let appHandler;
try {
  const mod = require("./_server.cjs");
  appHandler = mod.default ?? mod;
} catch (error) {
  logInvocationError("module_load_failed", error);
}

function sendError(res, statusCode, message) {
  if (res.headersSent) return;
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify({ message }));
}

export default async function handler(req, res) {
  if (!appHandler) {
    return sendError(res, 503, "Service initialization failed. Please try again.");
  }
  try {
    return await appHandler(req, res);
  } catch (error) {
    logInvocationError("request_failed", error, req);
    return sendError(res, 500, "A server error occurred. Please try again.");
  }
}
