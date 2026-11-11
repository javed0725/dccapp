import type { Express, Request, Response } from "express";
import { getResultPermissions } from "../shared/result-permissions.js";

export function requireResultPermission(req: Request, res: Response, permission: "canManageStructure" | "canEnterMarks") {
  if (!req.isAuthenticated?.()) {
    res.status(401).json({ message: "Your session has expired. Please log in again." });
    return false;
  }
  if (!getResultPermissions(req.user)[permission]) {
    res.status(403).json({ message: permission === "canEnterMarks"
      ? "Only teacher-only accounts can enter marks. Authority accounts cannot enter or update student marks."
      : "Only Authority accounts can manage subjects, exam structure and publishing." });
    return false;
  }
  return true;
}

/** Run after Passport, before any result/OMR handlers, including legacy routes. */
export function registerResultPermissionMiddleware(app: Express) {
  app.use((req, res, next) => {
    const mutating = ["POST", "PUT", "PATCH", "DELETE"].includes(req.method);
    // Express routes are case-insensitive by default; the permission match must be too.
    const path = req.path.toLowerCase();
    const marksRoute = /^\/api\/model-test-drafts\/[^/]+\/marks\/?$/.test(path);
    const structureRoute = /^\/api\/(?:model-test-drafts|subject-master-list)(?:\/|$)/.test(path);
    const legacyResults = /^\/api\/results(?:\/|$)/.test(path);
    const standaloneOmr = /^\/api\/omr\/(?:save|configs)(?:\/|$)/.test(path);

    if (mutating && (legacyResults || standaloneOmr)) {
      if (!req.isAuthenticated?.()) return res.status(401).json({ message: "Please sign in." });
      return res.status(403).json({
        message: "Standalone result writes are disabled. Teachers must enter marks through an active Authority-created model-test draft.",
      });
    }
    if (marksRoute && mutating) {
      if (!requireResultPermission(req, res, "canEnterMarks")) return;
    } else if (structureRoute && (mutating || path.startsWith("/api/subject-master-list"))) {
      if (!requireResultPermission(req, res, "canManageStructure")) return;
    }
    next();
  });
}
