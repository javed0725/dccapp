import { test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import express from "express";
import { getResultPermissions, canEnterDraftMarks, visibleResultDrafts } from "../shared/result-permissions.js";
import { registerResultPermissionMiddleware } from "../server/result-permissions.js";

const actors = {
  admin: { role: "admin", isAuthority: false },
  authorityTeacher: { role: "teacher", isAuthority: true },
  teacher: { role: "teacher", isAuthority: false },
  student: { role: "student", isAuthority: false },
};

test("Authority accounts never receive mark-entry permission, including authority-enabled teachers", () => {
  assert.deepEqual(getResultPermissions(actors.admin), { canManageStructure: true, canEnterMarks: false });
  assert.deepEqual(getResultPermissions(actors.authorityTeacher), { canManageStructure: true, canEnterMarks: false });
  assert.deepEqual(getResultPermissions(actors.teacher), { canManageStructure: false, canEnterMarks: true });
  assert.deepEqual(getResultPermissions(actors.student), { canManageStructure: false, canEnterMarks: false });
  assert.deepEqual(getResultPermissions(null), { canManageStructure: false, canEnterMarks: false });
});

test("Teachers can see and enter only active drafts; published and missing drafts are locked", () => {
  const drafts = [{ status: "draft", id: 1 }, { status: "published", id: 2 }];
  assert.deepEqual(visibleResultDrafts(actors.teacher, drafts).map((d) => d.id), [1]);
  assert.deepEqual(visibleResultDrafts(actors.admin, drafts).map((d) => d.id), [1, 2]);
  assert.deepEqual(visibleResultDrafts(actors.authorityTeacher, drafts).map((d) => d.id), [1, 2]);
  assert.deepEqual(visibleResultDrafts(actors.student, drafts), []);
  assert.equal(canEnterDraftMarks(actors.teacher, drafts[0]), true);
  assert.equal(canEnterDraftMarks(actors.teacher, drafts[1]), false);
  assert.equal(canEnterDraftMarks(actors.teacher, undefined), false);
  assert.equal(canEnterDraftMarks(actors.admin, drafts[0]), false);
  assert.equal(canEnterDraftMarks(actors.authorityTeacher, drafts[0]), false);
});

test("HTTP permission boundaries reject forbidden writes before any handler runs", async () => {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    const actor = actors[req.header("x-test-actor") as keyof typeof actors];
    req.isAuthenticated = (() => !!actor) as typeof req.isAuthenticated;
    req.user = actor ? { id: 1, ...actor } as Express.User : undefined;
    next();
  });
  registerResultPermissionMiddleware(app);
  let writes = 0;
  app.use((_req, res) => { writes++; res.json({ ok: true }); });
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  const call = async (path: string, method: string, actor?: keyof typeof actors) => {
    const previous = writes;
    const response = await fetch(base + path, {
      method,
      headers: { ...(actor ? { "x-test-actor": actor } : {}), "x-results-panel": "teacher", "content-type": "application/json" },
      ...(method === "GET" ? {} : { body: JSON.stringify({ role: "admin", isAuthority: false }) }),
    });
    await response.arrayBuffer();
    if (response.status >= 400) assert.equal(writes, previous, `${actor}: ${method} ${path} reached a write handler`);
    return response.status;
  };
  try {
    const structure = [
      ["/api/model-test-drafts", "POST"],
      ["/api/model-test-drafts/exam", "PATCH"],
      ["/api/model-test-drafts/exam", "DELETE"],
      ["/api/model-test-drafts/exam/publish", "PATCH"],
      ["/api/model-test-drafts/exam/subject", "DELETE"],
      ["/api/subject-master-list", "GET"],
      ["/api/subject-master-list", "POST"],
      ["/api/subject-master-list/1", "PATCH"],
      ["/api/subject-master-list/1", "DELETE"],
    ];
    for (const [path, method] of structure) {
      assert.equal(await call(path, method), 401);
      assert.equal(await call(path, method, "teacher"), 403);
      assert.equal(await call(path, method, "student"), 403);
      assert.equal(await call(path, method, "admin"), 200);
      assert.equal(await call(path, method, "authorityTeacher"), 200);
    }
    for (const actor of Object.keys(actors) as (keyof typeof actors)[]) {
      assert.equal(await call("/api/model-test-drafts/exam/marks", "POST", actor), actor === "teacher" ? 200 : 403);
      for (const [path, method] of [
        ["/api/results", "POST"], ["/api/results/batch", "POST"], ["/api/results/1", "PATCH"],
        ["/api/results/1", "DELETE"], ["/api/results/exam/bulk", "DELETE"],
        ["/api/omr/save", "POST"], ["/api/omr/configs", "POST"],
        ["/API/Results", "POST"], ["/API/OMR/SAVE/", "POST"],
      ]) assert.equal(await call(path, method, actor), 403);
    }
    assert.equal(await call("/api/model-test-drafts/exam/marks", "POST"), 401);
    assert.equal(await call("/API/MODEL-TEST-DRAFTS/exam/MARKS/", "POST", "admin"), 403);
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
