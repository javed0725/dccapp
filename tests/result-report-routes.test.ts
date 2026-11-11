import { test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import express from "express";
import { registerResultReportRoutes } from "../server/result-report-routes.js";

test("published PDF endpoints enforce authentication, ownership, authority and group scope", async () => {
  const app = express();
  const student = { id: 1, userId: 11, name: "Student", studentCustomId: "101", batchId: 9, academicGroup: "Science", isActive: true };
  const commerce = { ...student, id: 2, userId: 12, academicGroup: "Commerce" };
  const draft = { groupId: "exam-1", examName: "Test", batchId: 9, status: "published", createdAt: new Date("2026-01-01"), subjects: [
    { name: "English", totalMarks: 100, allGroups: true },
    { name: "Physics", totalMarks: 100, academicGroup: "Science" },
  ] };
  app.use((req, _res, next) => {
    const role = req.header("x-test-role");
    req.isAuthenticated = (() => Boolean(role)) as typeof req.isAuthenticated;
    req.user = role ? { id: 11, role, isAuthority: req.header("x-test-authority") === "true" } as Express.User : undefined;
    next();
  });
  let renderedGroup = "";
  const repository = {
    getModelTestDraftByGroupId: async (id: string) => id === "exam-1" ? draft : undefined,
    getStudentByUserId: async () => student,
    getStudent: async (id: number) => id === 1 ? student : id === 2 ? commerce : undefined,
    getStudents: async () => [student, commerce],
    getBatches: async () => [{ id: 9, name: "Class 9" }],
    getModelTestResults: async () => [{ studentId: 1, batchId: 9, subject: "English", totalMarks: 100, obtainedMarks: 80 }],
  } as unknown as NonNullable<Parameters<typeof registerResultReportRoutes>[1]>;
  registerResultReportRoutes(app, repository, {
    transcript: async () => Buffer.from("%PDF-transcript"),
    tabulation: async (reports) => { renderedGroup = reports.map((r) => r.student.academicGroup).join(","); return Buffer.from("%PDF-class"); },
  });
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}/api/model-test-drafts`;
  const get = (path: string, role?: string, authority = false) => fetch(`${base}/${path}`, {
    headers: role ? { "x-test-role": role, "x-test-authority": String(authority) } : {},
  });
  try {
    assert.equal((await get("exam-1/transcript.pdf")).status, 401);
    assert.equal((await get("exam-1/transcript.pdf?studentId=2", "student")).status, 403);
    const own = await get("exam-1/transcript.pdf", "student");
    assert.equal(own.status, 200);
    assert.match(own.headers.get("content-type")!, /application\/pdf/);
    assert.match(own.headers.get("content-disposition")!, /attachment/);
    assert.match(own.headers.get("cache-control")!, /no-store/);
    assert.equal((await get("exam-1/tabulation.pdf", "student")).status, 403);
    assert.equal((await get("exam-1/tabulation.pdf", "teacher")).status, 403);
    assert.equal((await get("exam-1/tabulation.pdf?academicGroup=Science", "teacher", true)).status, 200);
    assert.equal(renderedGroup, "Science");
    assert.equal((await get("exam-1/tabulation.pdf?academicGroup=Unknown", "admin")).status, 404);
    assert.equal((await get("exam-1/transcript.pdf", "admin")).status, 400);
    assert.equal((await get("exam-1/transcript.pdf?studentId=abc", "admin")).status, 400);
    assert.equal((await get("missing/transcript.pdf", "student")).status, 404);
    draft.status = "draft";
    assert.equal((await get("exam-1/transcript.pdf", "student")).status, 403);
    assert.equal((await get("exam-1/tabulation.pdf", "admin")).status, 403);
  } finally { server.closeAllConnections(); await new Promise<void>((resolve) => server.close(() => resolve())); }
});
