function sendJsonError(res: any, statusCode: number, payload: Record<string, unknown>) {
  res.statusCode = statusCode;
  res.setHeader?.("Content-Type", "application/json; charset=utf-8");
  return res.end(JSON.stringify(payload));
}

export default async function handler(req: any, res: any) {
  try {
    const server = await import("../server/handler");
    return await server.default(req, res);
  } catch (error) {
    console.error("[Vercel] Server handler import failed:", error);
    const requestId = req?.headers?.["x-vercel-id"] ?? req?.headers?.["x-request-id"] ?? null;
    return sendJsonError(res, 503, {
      code: "SERVER_HANDLER_IMPORT_FAILED",
      message: "Service initialization failed. Please try again.",
      requestId,
    });
  }
}
