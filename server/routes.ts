import {
  db,
  databaseUrlEnvironmentKey,
  databaseUrlEnvironmentKeys,
  hasDatabaseUrl,
} from "./db.js";
import { eq, sql, desc, and, gte, lt } from "drizzle-orm";
import { students, incomes as incomesTable, users, type ModelTestSubject } from "../shared/schema.js";
import type { Express } from "express";
import { type Server } from "http";
import { storage } from "./storage.js";
import { api } from "../shared/routes.js";
import { z } from "zod";
import { setupAuth } from "./auth/auth.js";
import bcrypt from "bcryptjs";
import { execSync } from "child_process";
import { renderAttendancePdf } from "./attendance-pdf.js";
import { validateSubjectMarksEntry } from "../shared/marking.js";
import {
  calculateModelTestStandings,
  formatModelTestTabulation,
  filterModelTestRoster,
  resolveModelTestGroupScope,
  sameAcademicGroup,
} from "../shared/model-test-results.js";

function removePassword<T extends { password?: string } | null | undefined>(user: T) {
  if (!user) return user;
  const { password: _password, ...safeUser } = user;
  return safeUser;
}

async function getModelTestStandings(groupId: string, requestedGroup?: string | null) {
  const draft = await storage.getModelTestDraftByGroupId(groupId);
  if (!draft) return null;

  const scope = resolveModelTestGroupScope(draft.subjects, requestedGroup);
  const [allStudents, marks] = await Promise.all([
    storage.getStudents(),
    storage.getModelTestResults(groupId, null),
  ]);
  const classGroupExists = !scope.academicGroup || allStudents.some((student) =>
    student.batchId === draft.batchId && sameAcademicGroup(student.academicGroup, scope.academicGroup)
  );
  const scopeError = scope.error
    || (!classGroupExists ? `No students are assigned to ${scope.academicGroup} in this class` : null);
  const roster = filterModelTestRoster(allStudents, draft.batchId, scope.academicGroup);

  return {
    groupId,
    examName: draft.examName,
    batchId: draft.batchId,
    draftStatus: draft.status,
    academicGroup: scope.academicGroup,
    scopeError,
    subjects: scope.subjects,
    standings: scopeError ? [] : calculateModelTestStandings(scope.subjects, roster, marks),
  };
}

// --- Auth guards --------------------------------------------------------
// Distinguish between "not signed in" (401) and "signed in but lacks
// permission" (403) so the UI can react appropriately (e.g. redirect to
// /login on 401 instead of showing a confusing "Forbidden" message).
const SESSION_EXPIRED_MESSAGE =
  "Your session has expired. Please log in again.";
const ADMIN_ONLY_MESSAGE =
  "Only the Authority account can perform this action.";
const ROLE_FORBIDDEN_MESSAGE =
  "You don't have permission to perform this action.";

const subjectMasterPayloadSchema = z.object({
  name: z.string().trim().min(1).max(100),
  batchId: z.union([z.coerce.number().int().positive(), z.null()]),
  totalMarks: z.coerce.number().int().min(1).max(1000),
  mcqEnabled: z.boolean(),
  cqEnabled: z.boolean(),
  practicalEnabled: z.boolean(),
  mcqMax: z.coerce.number().int().min(0).max(1000),
  cqMax: z.coerce.number().int().min(0).max(1000),
  practicalMax: z.coerce.number().int().min(0).max(1000),
  allGroups: z.boolean(),
}).superRefine((subject, ctx) => {
  const selected = [
    { enabled: subject.mcqEnabled, maximum: subject.mcqMax },
    { enabled: subject.cqEnabled, maximum: subject.cqMax },
    { enabled: subject.practicalEnabled, maximum: subject.practicalMax },
  ].filter((component) => component.enabled);
  if (selected.some(({ maximum }) => maximum <= 0 || maximum > subject.totalMarks)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Selected component maximums must be positive and within Total Marks" });
  }
  if (selected.length > 0 && selected.reduce((sum, { maximum }) => sum + maximum, 0) !== subject.totalMarks) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Selected component maximums must add up to Total Marks" });
  }
});

function requireAuth(req: any, res: any): boolean {
  if (!req.isAuthenticated()) {
    res.status(401).json({ message: SESSION_EXPIRED_MESSAGE });
    return false;
  }
  return true;
}

function requireAdmin(req: any, res: any): boolean {
  if (!req.isAuthenticated()) {
    res.status(401).json({ message: SESSION_EXPIRED_MESSAGE });
    return false;
  }
  const u = req.user as any;
  if (u.role !== "admin" && !u.isAuthority) {
    res.status(403).json({ message: ADMIN_ONLY_MESSAGE });
    return false;
  }
  return true;
}

function requireRoles(req: any, res: any, roles: string[]): boolean {
  if (!req.isAuthenticated()) {
    res.status(401).json({ message: SESSION_EXPIRED_MESSAGE });
    return false;
  }
  if (!roles.includes((req.user as any).role)) {
    res.status(403).json({ message: ROLE_FORBIDDEN_MESSAGE });
    return false;
  }
  return true;
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  setupAuth(app);
  // Health-check — useful for diagnosing Vercel cold starts and DB connectivity
  app.get("/api/health", async (_req, res) => {
    const sessionSecret = process.env.SESSION_SECRET;
    const healthDetails = {
      hasDbUrl: hasDatabaseUrl,
      databaseUrlKey: databaseUrlEnvironmentKey,
      hasSessionSecret: !!sessionSecret,
      nodeEnv: process.env.NODE_ENV,
    };
    if (!hasDatabaseUrl) {
      return res.status(503).json({
        status: "error",
        db: "not_configured",
        code: "DATABASE_URL_MISSING",
        message: `Set one of: ${databaseUrlEnvironmentKeys.join(", ")}`,
        ...healthDetails,
      });
    }
    try {
      await db.execute(sql`SELECT 1`);
      res.json({
        status: "ok",
        db: "connected",
        ...healthDetails,
      });
    } catch (err: any) {
      console.error("[Health] Database probe failed:", err);
      console.error(JSON.stringify({
        level: "error",
        component: "health",
        event: "database_probe_failed",
        code: err?.code ?? null,
        message: err?.message ?? "Unknown database error",
      }));
      res.status(500).json({
        status: "error",
        db: "unreachable",
        error: "Database connection failed",
        ...healthDetails,
      });
    }
  });

  app.get("/api/_git_push", async (req, res) => {
    try {
      const token = process.env.GITHUB_TOKEN || process.env.GITHUB_PERSONAL_ACCESS_TOKEN;
      if (!token) return res.status(500).json({ error: "No GitHub token found. Set GITHUB_TOKEN in secrets." });
      const message = (req.query.msg as string) || "Update from Replit";
      const cwd = process.cwd();
      // Remove stale lock file if it exists
      const lockFile = `${cwd}/.git/index.lock`;
      try { (await import("fs")).unlinkSync(lockFile); } catch {}
      execSync(`git remote set-url origin https://x-access-token:${token}@github.com/javed0725/dccapp.git`, { cwd, stdio: "pipe" });
      execSync(`git config user.email "replit@dcc.app"`, { cwd, stdio: "pipe" });
      execSync(`git config user.name "DCC Replit"`, { cwd, stdio: "pipe" });
      execSync("git add -A", { cwd, stdio: "pipe" });
      const status = execSync("git status --porcelain", { cwd, stdio: "pipe" }).toString().trim();
      if (status) {
        execSync(`git commit -m "${message.replace(/"/g, "'")}"`, { cwd, stdio: "pipe" });
      }
      const out = execSync("git push origin main 2>&1", { cwd, timeout: 60000 }).toString();
      // Reset URL to remove token
      execSync("git remote set-url origin https://github.com/javed0725/dccapp", { cwd, stdio: "pipe" });
      res.json({ ok: true, committed: !!status, out: out || "Already up to date" });
    } catch (err: any) {
      // Reset URL even on error
      try { execSync("git remote set-url origin https://github.com/javed0725/dccapp", { cwd: process.cwd(), stdio: "pipe" }); } catch {}
      res.status(500).json({ error: err.stderr?.toString() || err.message });
    }
  });

  // Public endpoint — no auth required — used by the landing page Teachers section
  app.get("/api/teachers", async (_req, res) => {
    try {
      const teachers = await storage.getTeachers();
      res.json(teachers);
    } catch {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Public endpoint — no auth required — used by the landing page About section (CMS)
  app.get("/api/settings", async (_req, res) => {
    try {
      const settings = await storage.getAllSettings();
      res.json(settings);
    } catch {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Admin-only: update site settings
  app.patch("/api/settings", async (req, res) => {
    if (!requireAdmin(req, res)) return;
    try {
      const updates = z.record(z.string()).parse(req.body);
      for (const [key, value] of Object.entries(updates)) {
        await storage.setSetting(key, value);
      }
      const settings = await storage.getAllSettings();
      res.json(settings);
    } catch (err) {
      if (err instanceof z.ZodError) {
        res.status(400).json({ message: err.errors[0].message });
      } else {
        res.status(500).json({ message: "Internal server error" });
      }
    }
  });

  app.get("/api/subject-master-list", async (req, res) => {
    if (!requireAdmin(req, res)) return;
    res.json(await storage.getSubjectMasterList());
  });

  app.post("/api/subject-master-list", async (req, res) => {
    if (!requireAdmin(req, res)) return;
    const parsed = subjectMasterPayloadSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.issues[0]?.message || "Invalid subject settings" });
    const payload = parsed.data;
    if (payload.batchId !== null && !(await storage.getBatches()).some((batch) => batch.id === payload.batchId)) {
      return res.status(400).json({ message: "Select a valid class" });
    }
    const normalizedName = payload.name.trim().toLocaleLowerCase();
    const existing = await storage.getSubjectMasterList();
    if (existing.some((subject) => subject.batchId === payload.batchId && subject.name.trim().toLocaleLowerCase() === normalizedName)) {
      return res.status(409).json({ message: "A subject with this name already exists for that class" });
    }
    try {
      const created = await storage.createSubjectMaster({
        ...payload,
        mcqMax: payload.mcqEnabled ? payload.mcqMax : 0,
        cqMax: payload.cqEnabled ? payload.cqMax : 0,
        practicalMax: payload.practicalEnabled ? payload.practicalMax : 0,
      });
      res.status(201).json(created);
    } catch (error: any) {
      if (error?.code === "23505") return res.status(409).json({ message: "A subject with this name already exists" });
      res.status(500).json({ message: "Failed to create subject" });
    }
  });

  app.patch("/api/subject-master-list/:id", async (req, res) => {
    if (!requireAdmin(req, res)) return;
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) return res.status(400).json({ message: "Invalid subject id" });
    const parsed = subjectMasterPayloadSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.issues[0]?.message || "Invalid subject settings" });
    const payload = parsed.data;
    if (payload.batchId !== null && !(await storage.getBatches()).some((batch) => batch.id === payload.batchId)) {
      return res.status(400).json({ message: "Select a valid class" });
    }
    const normalizedName = payload.name.trim().toLocaleLowerCase();
    const existing = await storage.getSubjectMasterList();
    if (existing.some((subject) =>
      subject.id !== id
      && subject.batchId === payload.batchId
      && subject.name.trim().toLocaleLowerCase() === normalizedName
    )) {
      return res.status(409).json({ message: "A subject with this name already exists for that class" });
    }
    try {
      const updated = await storage.updateSubjectMaster(id, {
        ...payload,
        mcqMax: payload.mcqEnabled ? payload.mcqMax : 0,
        cqMax: payload.cqEnabled ? payload.cqMax : 0,
        practicalMax: payload.practicalEnabled ? payload.practicalMax : 0,
      });
      if (!updated) return res.status(404).json({ message: "Subject not found" });
      res.json(updated);
    } catch (error: any) {
      if (error?.code === "23505") return res.status(409).json({ message: "A subject with this name already exists" });
      res.status(500).json({ message: "Failed to update subject" });
    }
  });

  app.delete("/api/subject-master-list/:id", async (req, res) => {
    if (!requireAdmin(req, res)) return;
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) return res.status(400).json({ message: "Invalid subject id" });
    await storage.deleteSubjectMaster(id);
    res.sendStatus(204);
  });

  app.get(api.batches.list.path, async (req, res) => {
    if (!requireAuth(req, res)) return;
    const batches = await storage.getBatches();
    res.json(batches);
  });

  app.post(api.batches.create.path, async (req, res) => {
    if (!requireRoles(req, res, ['admin', 'teacher'])) return;
    try {
      const input = api.batches.create.input.parse(req.body);
      const batch = await storage.createBatch(input);
      res.status(201).json(batch);
    } catch (err) {
      if (err instanceof z.ZodError) {
        res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      } else {
        res.status(500).json({ message: "Internal server error" });
      }
    }
  });

  app.delete(api.batches.delete.path, async (req, res) => {
    if (!requireAdmin(req, res)) return;
    try {
      await storage.deleteBatch(Number(req.params.id));
      res.sendStatus(204);
    } catch (err: any) {
      if (err.code === '23503') { // Foreign key constraint error
        res.status(400).json({ message: "Cannot delete batch with active students" });
      } else {
        res.status(500).json({ message: "Internal server error" });
      }
    }
  });

  app.get(api.students.list.path, async (req, res) => {
    if (!requireAuth(req, res)) return;
    const students = await storage.getStudents();
    console.log(`[BACKEND LOG] Fetched ${students.length} students`);
    res.json(students);
  });

  app.post(api.students.create.path, async (req, res) => {
    if (!requireRoles(req, res, ['admin', 'teacher'])) return;
    try {
      const payload = {
        ...req.body,
        batchId: Number(req.body.batchId),
        studentCustomId: req.body.studentCustomId || null
      };
      const studentInput = api.students.create.input.parse(payload);
      const student = await storage.createStudent({
        ...studentInput,
        addedByUserId: (req.user as any).id,
      } as any);
      console.log(`[BACKEND LOG] Created student: ${student.name}`);
      
      // If student has a custom ID, create a user account for them
      if (student.studentCustomId) {
        const defaultPassword = await bcrypt.hash("password123", 10);
        const user = await storage.createUser({
          username: student.studentCustomId,
          password: defaultPassword,
          role: "student"
        });
        await storage.updateStudent(student.id, { userId: user.id });
      }

      // Notification trigger: admission
      try {
        const batches = await storage.getBatches();
        const batch = batches.find(b => b.id === student.batchId);
        await storage.createNotification(
          `New student ${student.name} admitted to ${batch?.name ?? "a batch"}.`,
          "admission"
        );
      } catch (_) {}
      
      res.status(201).json(student);
    } catch (err) {
      if (err instanceof z.ZodError) {
        console.error("Zod Validation Error in api.students.create:", JSON.stringify(err.errors, null, 2));
        res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
          details: err.errors
        });
      } else {
        console.error("Unexpected Error in api.students.create:", err);
        res.status(500).json({ message: "Internal server error" });
      }
    }
  });

  app.patch("/api/students/:id", async (req, res) => {
    if (!requireAuth(req, res)) return;
    try {
      const id = Number(req.params.id);
      const oldStudent = await storage.getStudent(id);
      
      // If studentCustomId is being set for the first time, create a user account
      if (req.body.studentCustomId && !oldStudent?.userId) {
        const defaultPassword = await bcrypt.hash("password123", 10);
        const user = await storage.createUser({
          username: req.body.studentCustomId,
          password: defaultPassword,
          role: "student"
        });
        req.body.userId = user.id;
      }
      
      const student = await storage.updateStudent(id, req.body);
      res.json(student);
    } catch (err: any) {
      console.error("[PATCH /api/students/:id] Error:", err?.message || err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.delete(api.students.delete.path, async (req, res) => {
    if (!requireAdmin(req, res)) return;
    try {
      await storage.deleteStudent(Number(req.params.id));
      res.sendStatus(204);
    } catch (err) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  /* Returns due months for a student — past months (Jan → prev month) not yet paid this year */
  app.get("/api/students/:id/due-months", async (req, res) => {
    if (!requireAuth(req, res)) return;
    const studentId = Number(req.params.id);
    if (isNaN(studentId)) return res.status(400).json({ message: "Invalid student id" });

    const ALL_MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
    const currentMonthIndex = new Date().getMonth(); // 0-based; July = 6
    const pastMonths = ALL_MONTHS.slice(0, currentMonthIndex); // ["January" … "June"] for July

    if (pastMonths.length === 0) return res.json({ dueMonths: [] });

    // Use date range (gte/lt) instead of EXTRACT to avoid drizzle sql-template
    // column-reference rendering issues that silently break the year filter.
    const currentYear = new Date().getFullYear();
    const yearStart = new Date(`${currentYear}-01-01T00:00:00.000Z`);
    const yearEnd   = new Date(`${currentYear + 1}-01-01T00:00:00.000Z`);

    const paid = await db
      .select({ month: incomesTable.month })
      .from(incomesTable)
      .where(
        and(
          eq(incomesTable.studentId, studentId),
          gte(incomesTable.date, yearStart),
          lt(incomesTable.date, yearEnd)
        )
      );

    // Normalise to lowercase for case-safe comparison
    const dbPaidMonths = paid.map((r) => r.month.toLowerCase());
    const paidSet = new Set(dbPaidMonths);
    const dueMonths = pastMonths.filter((m) => !paidSet.has(m.toLowerCase()));

    // Debug log — remove once confirmed working
    console.log(`[DueMonths] studentId=${studentId} year=${currentYear} pastMonths=${JSON.stringify(pastMonths)} dbPaidMonths=${JSON.stringify(dbPaidMonths)} dueMonths=${JSON.stringify(dueMonths)}`);

    return res.json({ dueMonths });
  });

  /* Returns the most recent payment amount for a given student (any recorder) */
  app.get("/api/students/:id/last-payment", async (req, res) => {
    if (!requireAuth(req, res)) return;
    const studentId = Number(req.params.id);
    if (isNaN(studentId)) return res.status(400).json({ message: "Invalid student id" });
    const [last] = await db
      .select({ amount: incomesTable.amount })
      .from(incomesTable)
      .where(eq(incomesTable.studentId, studentId))
      .orderBy(desc(incomesTable.date))
      .limit(1);
    return res.json(last ?? null);
  });

  app.get(api.incomes.list.path, async (req, res) => {
    if (!requireAuth(req, res)) return;
    const user = req.user as any;

    // ?limit=N caps the response size for slow connections (default 400, max 1000).
    // Pass ?all=true to bypass the cap when the full history is explicitly needed.
    const bypassLimit = req.query.all === "true";
    const limit = bypassLimit ? Infinity : Math.min(Number(req.query.limit) || 400, 1000);

    if (user.role === 'student') {
      const student = await storage.getStudentByUserId(user.id);
      if (!student) return res.json([]);
      const incomes = await storage.getIncomesByStudentId(student.id);
      return res.json(incomes);
    }

    const allIncomes = await storage.getIncomes();

    // Determine effective portal — authority teachers can switch between
    // "teacher" (own records only) and "admin" (all records) portals.
    const requestedPortal = String(req.query.portal ?? "").toLowerCase();
    const inTeacherPortal =
      user.role === 'teacher' && (!user.isAuthority || requestedPortal === 'teacher');

    let result = inTeacherPortal
      ? allIncomes.filter(inc => inc.recordedBy === user.id)
      : allIncomes;

    // Apply limit (getIncomes() is already sorted newest-first, so slice keeps
    // the most recent records which are most relevant for daily use).
    if (isFinite(limit) && result.length > limit) {
      result = result.slice(0, limit);
    }

    console.log(`[BACKEND LOG] Returning ${result.length}/${allIncomes.length} incomes (limit=${limit})`);
    res.json(result);
  });

  app.post(api.incomes.create.path, async (req, res) => {
    if (!requireAuth(req, res)) return;
    try {
      const input = api.incomes.create.input.parse({
        ...req.body,
        amount: Number(req.body.amount),
        studentId: Number(req.body.studentId),
        batchId: Number(req.body.batchId)
      });

      const duplicate = await storage.findIncomeByStudentAndMonth(input.studentId, input.month);
      if (duplicate) {
        const studentsList = await storage.getStudents();
        const student = studentsList.find(s => s.id === input.studentId);
        return res.status(409).json({
          message: `${student?.name ?? "This student"} has already paid for ${input.month}. Duplicate entries are not allowed.`
        });
      }

      const recordedByUserId = (req.user as any).id;
      const income = await storage.createIncome({
        ...input,
        recordedBy: recordedByUserId,
        addedBy: (req.user as any).username
      });

      // Auto-update teacher's running collection
      try {
        await storage.addToCollection(recordedByUserId, input.amount);
      } catch (collErr) {
        console.error("[collection] addToCollection failed:", collErr);
      }

      // Notification trigger: payment
      try {
        const studentsList = await storage.getStudents();
        const student = studentsList.find((s: any) => s.id === input.studentId);
        await storage.createNotification(
          `Payment of ৳${input.amount} received from ${student?.name ?? "a student"} for ${input.month}.`,
          "payment"
        );
      } catch (_) {}

      res.status(201).json(income);
    } catch (err) {
      if (err instanceof z.ZodError) {
        res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      } else {
        res.status(500).json({ message: "Internal server error" });
      }
    }
  });

  app.delete(api.incomes.delete.path, async (req, res) => {
    if (!requireAdmin(req, res)) return;
    await storage.deleteIncome(Number(req.params.id));
    res.sendStatus(204);
  });

  app.get(api.expenses.list.path, async (req, res) => {
    if (!requireAdmin(req, res)) return;
    const bypassLimit = req.query.all === "true";
    const limit = bypassLimit ? Infinity : Math.min(Number(req.query.limit) || 400, 1000);
    let expenses = await storage.getExpenses();
    if (isFinite(limit) && expenses.length > limit) expenses = expenses.slice(0, limit);
    console.log(`[BACKEND LOG] Returning ${expenses.length} expenses (limit=${limit})`);
    res.json(expenses);
  });

  app.post(api.expenses.create.path, async (req, res) => {
    if (!requireAdmin(req, res)) return;
    try {
      const input = api.expenses.create.input.parse({
          ...req.body,
          amount: Number(req.body.amount)
      });
      const expense = await storage.createExpense(input);
      res.status(201).json(expense);
    } catch (err) {
      if (err instanceof z.ZodError) {
        res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      } else {
        res.status(500).json({ message: "Internal server error" });
      }
    }
  });

  app.delete(api.expenses.delete.path, async (req, res) => {
    if (!requireAdmin(req, res)) return;
    await storage.deleteExpense(Number(req.params.id));
    res.sendStatus(204);
  });

  // Deposit Routes
  app.get(api.deposits.list.path, async (req, res) => {
    if (!requireAdmin(req, res)) return;
    const depositList = await storage.getDeposits();
    res.json(depositList);
  });

  app.post(api.deposits.create.path, async (req, res) => {
    if (!requireAdmin(req, res)) return;
    try {
      const input = api.deposits.create.input.parse({
        ...req.body,
        amount: Number(req.body.amount),
      });
      const deposit = await storage.createDeposit(input);
      res.status(201).json(deposit);
    } catch (err) {
      if (err instanceof z.ZodError) {
        res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join("."),
        });
      } else {
        console.error("Deposit create error:", err);
        res.status(500).json({ message: "Internal server error" });
      }
    }
  });

  app.delete(api.deposits.delete.path, async (req, res) => {
    if (!requireAdmin(req, res)) return;
    try {
      await storage.deleteDeposit(Number(req.params.id));
      res.sendStatus(204);
    } catch (err) {
      console.error("Deposit delete error:", err);
      res.status(500).json({ message: "Failed to delete deposit" });
    }
  });

  // Teacher Management Routes
  app.get("/api/admin/teachers", async (req, res) => {
    if (!requireAdmin(req, res)) return;
    const teachers = await storage.getTeachers();
    res.json(teachers.map(removePassword));
  });

  app.post("/api/admin/teachers", async (req, res) => {
    if (!requireAdmin(req, res)) return;
    try {
      const { teacherId, username, password, mobileNumber, name, subject } = z.object({
        teacherId: z.string().min(1),
        username: z.string().min(1),
        password: z.string().min(6),
        mobileNumber: z.string().optional(),
        name: z.string().optional(),
        subject: z.string().optional(),
      }).parse(req.body);
      
      const hashedPassword = await bcrypt.hash(password, 10);
      const teacher = await storage.createTeacher(teacherId, username, hashedPassword, mobileNumber, name, subject);
      res.status(201).json(removePassword(teacher));
    } catch (err) {
      res.status(400).json({ message: "Teacher ID already exists or invalid data" });
    }
  });

  app.patch("/api/admin/teachers/:id", async (req, res) => {
    if (!requireAdmin(req, res)) return;
    const id = Number(req.params.id);
    try {
      const body = z.object({
        password: z.string().min(6).optional(),
        role: z.string().optional(),
        name: z.string().nullable().optional(),
        subject: z.string().nullable().optional(),
        isAuthority: z.boolean().optional(),
        imageUrl: z
          .string()
          .max(2_000_000)
          .nullable()
          .optional()
          .refine(
            (v) => v == null || v === "" || /^data:image\/(png|jpe?g|webp|gif);base64,/.test(v),
            { message: "imageUrl must be a data:image/* base64 URL" },
          ),
      }).parse(req.body);

      const updateData: any = {};
      if (body.password) updateData.password = await bcrypt.hash(body.password, 10);
      if (body.role) updateData.role = body.role;
      if (body.name !== undefined) updateData.name = body.name;
      if (body.subject !== undefined) updateData.subject = body.subject;
      if (body.isAuthority !== undefined) updateData.isAuthority = body.isAuthority;
      if (body.imageUrl !== undefined) updateData.imageUrl = body.imageUrl || null;

      const user = await storage.updateUser(id, updateData);
      res.json(removePassword(user));
    } catch (err: any) {
      res.status(400).json({ message: err?.message || "Invalid teacher update" });
    }
  });

  app.delete("/api/admin/teachers/:id", async (req, res) => {
    if (!requireAdmin(req, res)) return;
    await storage.deleteUser(Number(req.params.id));
    res.sendStatus(204);
  });

  app.patch(api.incomes.updateStatus.path, async (req, res) => {
    if (!requireAdmin(req, res)) return;
    try {
      const { status } = z.object({ status: z.enum(["Pending", "Verified"]) }).parse(req.body);
      const income = await storage.updateIncomeStatus(Number(req.params.id), status);
      res.json(income);
    } catch (err) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.patch("/api/user/password", async (req, res) => {
    if (!requireAuth(req, res)) return;
    try {
      const { password } = z.object({ password: z.string().min(6) }).parse(req.body);
      const hashedPassword = await bcrypt.hash(password, 10);
      await storage.updateUser((req.user as any).id, { password: hashedPassword });
      res.json({ message: "Password updated" });
    } catch (err) {
      res.status(400).json({ message: "Invalid password" });
    }
  });

  // Public Results Route (for Landing Page)
  app.get("/api/public/results", async (_req, res) => {
    try {
      const allResults = await storage.getResults();
      const publishedGroupIds = await storage.getPublishedModelTestGroupIds();
      const visible = allResults.filter(r =>
        !r.isModelTest || !r.modelTestGroupId || publishedGroupIds.includes(r.modelTestGroupId)
      );
      const sanitized = visible.map(r => ({
        id: r.id,
        studentId: r.studentId,
        studentCustomId: r.student?.studentCustomId ?? null,
        studentName: r.student?.name ?? "",
        batchId: r.batchId,
        batchName: r.batch?.name ?? "",
        subject: r.subject,
        examName: r.examName,
        totalMarks: r.totalMarks,
        obtainedMarks: r.obtainedMarks,
      }));
      res.json(sanitized);
    } catch {
      res.status(500).json({ message: "Failed to load results" });
    }
  });

  // Results Routes
  app.get("/api/results", async (req, res) => {
    if (!requireAuth(req, res)) return;
    const user = req.user as any;
    if (user.role === "student") {
      const student = await storage.getStudentByUserId(user.id);
      if (!student) return res.json([]);
      const allResults = await storage.getResultsByStudentId(student.id);
      const publishedGroupIds = await storage.getPublishedModelTestGroupIds();
      const filtered = allResults.filter(r =>
        !r.isModelTest || !r.modelTestGroupId || publishedGroupIds.includes(r.modelTestGroupId)
      );
      return res.json(filtered);
    }
    const results = await storage.getResults();
    res.json(results);
  });

  app.post("/api/results", async (req, res) => {
    if (!requireRoles(req, res, ['teacher', 'admin'])) return;
    try {
      const { insertResultSchema } = await import("../shared/schema.js");
      const data = insertResultSchema.parse({
        ...req.body,
        totalMarks: Number(req.body.totalMarks),
        obtainedMarks: Number(req.body.obtained_marks || req.body.obtainedMarks),
        isModelTest: Boolean(req.body.isModelTest),
        modelTestGroupId: req.body.modelTestGroupId || null,
      });
      const result = await storage.createResult(data);
      // NOTE: No notification here. Single-result POSTs are used in loops
      // (one call per student). Sending a notification per call would spam
      // the Authority. Use POST /api/results/batch for one consolidated
      // notification per save action.
      res.status(201).json(result);
    } catch (err) {
      res.status(400).json({ message: "Invalid data" });
    }
  });

  // Batch result upload — saves many results at once and emits exactly ONE
  // notification for the entire action (e.g. a teacher saving marks for a
  // whole class in one click).
  app.post("/api/results/batch", async (req, res) => {
    if (!requireRoles(req, res, ['teacher', 'admin'])) return;
    try {
      const { insertResultSchema } = await import("../shared/schema.js");
      const rawEntries = Array.isArray(req.body?.entries) ? req.body.entries : [];
      if (rawEntries.length === 0) {
        return res.status(400).json({ message: "entries array is required" });
      }
      const parsed = rawEntries.map((entry: any) =>
        insertResultSchema.parse({
          ...entry,
          totalMarks: Number(entry.totalMarks),
          obtainedMarks: Number(entry.obtained_marks ?? entry.obtainedMarks),
          isModelTest: Boolean(entry.isModelTest),
          modelTestGroupId: entry.modelTestGroupId || null,
        })
      );

      const created = [];
      for (const data of parsed) {
        created.push(await storage.createResult(data));
      }

      // ONE consolidated notification for the whole batch.
      try {
        const first = parsed[0];
        const allBatches = await storage.getBatches();
        const batch = allBatches.find(b => b.id === first.batchId);
        const batchName = batch?.name ?? "a batch";
        const teacherName = (req.user as any).username;
        const uniqueSubjects = Array.from(new Set(parsed.map(p => p.subject)));
        const label = uniqueSubjects.length === 1 ? uniqueSubjects[0] : first.examName;
        await storage.createNotification(
          `${teacherName} has uploaded results for ${label} - ${batchName}.`,
          "result"
        );
      } catch (_) {}

      res.status(201).json({ saved: created.length });
    } catch (err) {
      res.status(400).json({ message: "Invalid data" });
    }
  });

  app.patch("/api/results/:id", async (req, res) => {
    if (!requireAdmin(req, res)) return;
    const id = Number(req.params.id);
    if (isNaN(id)) return res.sendStatus(400);
    try {
      const { examName, subject, obtainedMarks, totalMarks } = req.body;
      const updated = await storage.updateResult(id, {
        ...(examName !== undefined && { examName }),
        ...(subject !== undefined && { subject }),
        ...(obtainedMarks !== undefined && { obtainedMarks: Number(obtainedMarks) }),
        ...(totalMarks !== undefined && { totalMarks: Number(totalMarks) }),
      });
      res.json(updated);
    } catch {
      res.status(400).json({ message: "Update failed" });
    }
  });

  app.delete("/api/results/:id", async (req, res) => {
    if (!requireAdmin(req, res)) return;
    const id = Number(req.params.id);
    if (isNaN(id)) return res.sendStatus(400);
    await storage.deleteResult(id);
    res.sendStatus(204);
  });

  // Attendance Routes
  app.get("/api/attendance", async (req, res) => {
    if (!requireRoles(req, res, ['teacher', 'admin'])) return;
    const user = req.user as any;
    const batchId = req.query.batchId ? Number(req.query.batchId) : undefined;
    const date = req.query.date ? String(req.query.date) : undefined;
    const subject = req.query.subject ? String(req.query.subject) : undefined;
    const academicGroup = req.query.academicGroup ? String(req.query.academicGroup) : undefined;
    const shift = req.query.shift ? String(req.query.shift) : undefined;
    if (batchId && date) {
      const row = await storage.getAttendanceByKey({ batchId, date, subject, academicGroup, shift });
      return res.json(row || null);
    }

    // Determine effective portal — authority teachers can switch between
    // "teacher" (own records only) and "admin" (all records) portals.
    const requestedPortal = String(req.query.portal ?? "").toLowerCase();
    const inTeacherPortal =
      user.role === 'teacher' && (!user.isAuthority || requestedPortal === 'teacher');

    const teacherIdFilter = inTeacherPortal ? user.id : undefined;
    const rows = await storage.getAttendanceHistory({ batchId, subject, academicGroup, shift, teacherId: teacherIdFilter });
    if (inTeacherPortal) {
      console.log(`[BACKEND LOG] Teacher ${user.username} (portal=${requestedPortal || 'teacher'}) sees ${rows.length} attendance sessions`);
    }
    res.json(rows);
  });

  app.post("/api/attendance", async (req, res) => {
    if (!requireRoles(req, res, ['teacher', 'admin'])) return;
    const user = req.user as any;
    try {
      const date = String(req.body.date || "");
      const batchId = Number(req.body.batchId);
      const subject = req.body.subject ? String(req.body.subject) : "";
      const academicGroup = req.body.academicGroup ? String(req.body.academicGroup) : "";
      const shift = req.body.shift ? String(req.body.shift) : "";
      const absentStudentIds = Array.isArray(req.body.absentStudentIds) ? req.body.absentStudentIds.map((n: any) => Number(n)).filter((n: number) => !isNaN(n)) : [];
      const totalStudents = Number(req.body.totalStudents) || 0;
      if (!date || !batchId) return res.status(400).json({ message: "date and batchId required" });
      const saved = await storage.upsertAttendance({
        date, batchId, teacherId: user.id, subject, academicGroup, shift, absentStudentIds, totalStudents,
      });
      res.status(201).json(saved);
    } catch (err: any) {
      res.status(400).json({ message: err?.message || "Invalid data" });
    }
  });

  app.delete("/api/attendance/:id", async (req, res) => {
    if (!requireRoles(req, res, ['teacher', 'admin'])) return;
    const user = req.user as any;
    const id = Number(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid id" });
    const session = await storage.getAttendanceById(id);
    if (!session) return res.status(404).json({ message: "Session not found" });
    // Teachers may only delete sessions they recorded; admins can delete any.
    if (user.role !== 'admin' && session.teacherId !== user.id) {
      return res.status(403).json({ message: "Forbidden" });
    }
    await storage.deleteAttendance(id);
    res.sendStatus(204);
  });

  // GET /api/attendance/zkteco-logs — raw biometric punch log viewer (admin only)
  // Optional query params: from=YYYY-MM-DD, to=YYYY-MM-DD, date=YYYY-MM-DD (legacy single day), limit=N (max 2000)
  app.get("/api/attendance/zkteco-logs", async (req, res) => {
    if (!requireAdmin(req, res)) return;
    const fromParam = req.query.from ? String(req.query.from) : undefined;
    const toParam   = req.query.to   ? String(req.query.to)   : undefined;
    const dateParam = req.query.date ? String(req.query.date) : undefined; // legacy
    const limit = req.query.limit ? Math.min(Number(req.query.limit), 2000) : 500;
    let fromDate: Date | undefined;
    let toDate:   Date | undefined;
    if (fromParam || toParam) {
      if (fromParam) { fromDate = new Date(`${fromParam}T00:00:00`); if (isNaN(fromDate.getTime())) return res.status(400).json({ message: "Invalid from date" }); }
      if (toParam)   { toDate   = new Date(`${toParam}T23:59:59.999`); if (isNaN(toDate.getTime())) return res.status(400).json({ message: "Invalid to date" }); }
    } else if (dateParam) {
      fromDate = new Date(`${dateParam}T00:00:00`);
      toDate   = new Date(`${dateParam}T23:59:59.999`);
      if (isNaN(fromDate.getTime())) return res.status(400).json({ message: "Invalid date parameter" });
    }
    const logs = await storage.getZktecoLogs({ fromDate, toDate, limit });
    res.json(logs);
  });

  app.get("/api/attendance/summary", async (req, res) => {
    if (!requireAdmin(req, res)) return;
    const subject = req.query.subject ? String(req.query.subject) : undefined;
    const academicGroup = req.query.academicGroup ? String(req.query.academicGroup) : undefined;
    const shift = req.query.shift ? String(req.query.shift) : undefined;
    const summary = await storage.getAttendanceSummary({ subject, academicGroup, shift });
    res.json(summary);
  });

  // ── Smart Attendance Cross-Check ──────────────────────────────────────────
  // GET /api/attendance/smart
  //   ?batchId=N&startDate=YYYY-MM-DD&endDate=YYYY-MM-DD[&shift=S][&group=G]
  //   Also accepts ?date=YYYY-MM-DD (shorthand for startDate=endDate=date).
  //
  // Iterates every calendar day in the range (Dhaka timezone, UTC+6).
  // For each day, cross-checks biometric punches against class_routines.
  // Deduplication: only the EARLIEST valid punch per student per slot window
  // is counted. Returns { startDate, endDate, batchId, days: SmartDayResult[] }.
  app.get("/api/attendance/smart", async (req, res) => {
    if (!requireAuth(req, res)) return;

    const batchId    = req.query.batchId ? Number(req.query.batchId) : undefined;
    const queryShift = req.query.shift   ? String(req.query.shift)   : undefined;
    const queryGroup = req.query.group   ? String(req.query.group)   : undefined;

    // Accept both single date and explicit range
    const singleDate = req.query.date      ? String(req.query.date)      : undefined;
    const startDate  = req.query.startDate ? String(req.query.startDate) : singleDate;
    const endDate    = req.query.endDate   ? String(req.query.endDate)   : singleDate;

    const dateRx = /^\d{4}-\d{2}-\d{2}$/;
    if (!batchId || isNaN(batchId) || !startDate || !endDate
        || !dateRx.test(startDate) || !dateRx.test(endDate)) {
      return res.status(400).json({ message: "batchId and startDate/endDate (YYYY-MM-DD) are required" });
    }

    const DAY_NAMES = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
    const GRACE_MS  = 30 * 60 * 1000;

    // Helper: parse "HH:MM AM/PM" → Date in Dhaka tz for a given date string
    function parseSlotTime(ds: string, timeStr: string): Date | null {
      if (!timeStr) return null;
      const m = timeStr.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
      if (!m) return null;
      let h = parseInt(m[1]);
      const min = parseInt(m[2]);
      const mer = m[3].toUpperCase();
      if (mer === "PM" && h !== 12) h += 12;
      if (mer === "AM" && h === 12) h = 0;
      return new Date(`${ds}T${String(h).padStart(2,"0")}:${String(min).padStart(2,"0")}:00+06:00`);
    }

    // Enumerate every calendar date in [startDate, endDate] (Dhaka-local dates)
    const dates: string[] = [];
    {
      const cur = new Date(`${startDate}T12:00:00+06:00`);
      const lim = new Date(`${endDate}T12:00:00+06:00`);
      while (cur <= lim) {
        dates.push(cur.toISOString().slice(0, 10));
        cur.setUTCDate(cur.getUTCDate() + 1);
      }
    }
    if (dates.length > 90) {
      return res.status(400).json({ message: "Date range cannot exceed 90 days" });
    }

    // ── Load shared data once for the whole range ──────────────────────────
    const allRoutines = await storage.getClassRoutines(batchId);

    const allBatchStudents: any[] = (await storage.getStudents()).filter(
      (s: any) => s.batchId === batchId && s.isActive !== false && s.studentCustomId
    );

    const rangeStart = new Date(`${startDate}T00:00:00+06:00`);
    const rangeEnd   = new Date(`${endDate}T23:59:59+06:00`);
    const allZkLogs  = await storage.getZktecoLogs({ fromDate: rangeStart, toDate: rangeEnd, limit: 100000 });

    // Build: Dhaka-local dateKey → studentCustomId → punch Date[]
    // We bucket punches by the Dhaka-local date they occurred on.
    const punchesByDateAndStudent = new Map<string, Map<string, Date[]>>();
    for (const log of allZkLogs) {
      const t = new Date(log.punchTime);
      // Shift to UTC+6 to read the local Dhaka date
      const dhakaMs = t.getTime() + 6 * 60 * 60 * 1000;
      const dateKey = new Date(dhakaMs).toISOString().slice(0, 10);
      if (!punchesByDateAndStudent.has(dateKey)) {
        punchesByDateAndStudent.set(dateKey, new Map());
      }
      const byStudent = punchesByDateAndStudent.get(dateKey)!;
      const arr = byStudent.get(log.deviceUserId) ?? [];
      arr.push(t);
      byStudent.set(log.deviceUserId, arr);
    }

    // ── Process each date ──────────────────────────────────────────────────
    const days = dates.map(ds => {
      const midday    = new Date(`${ds}T12:00:00+06:00`);
      const dayOfWeek = DAY_NAMES[midday.getDay()];

      // Filter routines: match this day, respect query shift/group
      const dayRoutines = allRoutines.filter(r => {
        if (r.dayOfWeek !== dayOfWeek) return false;
        if (queryShift && r.shift && r.shift !== queryShift) return false;
        if (queryGroup && r.academicGroup && r.academicGroup !== queryGroup) return false;
        return true;
      });

      if (dayRoutines.length === 0) {
        return { date: ds, dayOfWeek, offDay: false, noRoutine: true, slots: [] };
      }

      const allOff = dayRoutines.every(r => r.isOffDay);
      const dayStart = new Date(`${ds}T00:00:00+06:00`);
      const dayEnd   = new Date(`${ds}T23:59:59+06:00`);
      const punchesByStudent = punchesByDateAndStudent.get(ds) ?? new Map<string, Date[]>();

      const slots = dayRoutines.map(routine => {
        if (routine.isOffDay) {
          return {
            routineId:     routine.id,
            subject:       routine.subjectName,
            startTime:     routine.startTime,
            endTime:       routine.endTime,
            isOffDay:      true,
            shift:         routine.shift ?? null,
            academicGroup: routine.academicGroup ?? null,
            presentCount:  0,
            absentCount:   0,
            students:      [] as any[],
          };
        }

        // A null/empty slot scope means "All": it matches every student in
        // the batch, even when the Attendance page has a shift/group filter.
        // Query filters only hide contradictory scoped slots above.
        const effectiveShift = routine.shift || null;
        const effectiveGroup = routine.academicGroup || null;

        const slotStudents = allBatchStudents.filter((s: any) => {
          if (effectiveShift && s.shift !== effectiveShift) return false;
          if (effectiveGroup && s.academicGroup !== effectiveGroup) return false;
          return true;
        });

        const slotStart = parseSlotTime(ds, routine.startTime);
        const slotEnd   = parseSlotTime(ds, routine.endTime);
        const winStart  = slotStart ? new Date(slotStart.getTime() - GRACE_MS) : dayStart;
        const winEnd    = slotEnd   ? new Date(slotEnd.getTime()   + GRACE_MS) : dayEnd;

        const studentRows = slotStudents.map((student: any) => {
          const sid     = String(student.studentCustomId);
          const punches = punchesByStudent.get(sid) ?? [];
          // Deduplication: take only the EARLIEST valid punch in the window
          const matched = punches
            .filter(t => t >= winStart && t <= winEnd)
            .sort((a, b) => a.getTime() - b.getTime())[0] ?? null;
          return {
            studentId:       student.id,
            studentCustomId: sid,
            name:            student.name,
            group:           student.academicGroup ?? null,
            shift:           student.shift ?? null,
            status:          matched ? "Present" : "Absent",
            punchTime:       matched ? matched.toISOString() : null,
          };
        });

        const presentCount = studentRows.filter((r: any) => r.status === "Present").length;
        const absentCount  = studentRows.length - presentCount;

        return {
          routineId:     routine.id,
          subject:       routine.subjectName,
          startTime:     routine.startTime,
          endTime:       routine.endTime,
          isOffDay:      false,
          shift:         routine.shift ?? null,
          academicGroup: routine.academicGroup ?? null,
          presentCount,
          absentCount,
          students:      studentRows,
        };
      });

      return { date: ds, dayOfWeek, offDay: allOff, noRoutine: false, slots };
    });

    res.json({ startDate, endDate, batchId, days });
  });

  // Server-side PDF export keeps Bengali text in Unicode and lets Chromium's
  // HarfBuzz shaping engine render kar-chihna and conjuncts correctly.
  app.post("/api/attendance/smart/pdf", async (req, res) => {
    if (!requireAuth(req, res)) return;

    try {
      const payload = z.object({
        batchName: z.string().optional().default("All Batches"),
        data: z.object({
          startDate: z.string(),
          endDate: z.string(),
          days: z.array(z.unknown()),
        }),
      }).parse(req.body);

      const pdf = await renderAttendancePdf(
        payload.data as Parameters<typeof renderAttendancePdf>[0],
        payload.batchName,
      );
      const safeBatchName = payload.batchName
        .normalize("NFC")
        .replace(/[^\w-]+/g, "_")
        .replace(/^_+|_+$/g, "") || "All_Batches";

      res.status(200).setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="Attendance_Report_${safeBatchName}_${payload.data.startDate}.pdf"`,
      );
      res.setHeader("Content-Length", String(pdf.length));
      res.setHeader("Content-Transfer-Encoding", "binary");
      res.setHeader("Cache-Control", "no-store");
      res.send(pdf);
    } catch (err: any) {
      console.error("[Attendance PDF] Failed to render:", err);
      if (err instanceof Error && err.stack) {
        console.error("[Attendance PDF] Stack:", err.stack);
      }
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid attendance report data" });
      }
      if (!res.headersSent) {
        return res.status(500).json({ message: "Failed to generate attendance PDF" });
      }
      return res.end();
    }
  });

  // Bulk delete an entire exam (all student results matching batch + exam, optional subject)
  app.delete("/api/results/exam/bulk", async (req, res) => {
    if (!requireAdmin(req, res)) return;
    const batchId = Number(req.query.batchId);
    const examName = String(req.query.examName || "");
    const subject = req.query.subject ? String(req.query.subject) : undefined;
    if (!batchId || isNaN(batchId) || !examName) {
      return res.status(400).json({ message: "batchId and examName are required" });
    }
    const count = await storage.deleteResultsByExam(batchId, examName, subject);
    res.json({ deleted: count });
  });

  app.get("/api/results/model-test/:groupId", async (req, res) => {
    if (!requireAuth(req, res)) return;
    const user = req.user as any;
    const student = user.role === "student" ? await storage.getStudentByUserId(user.id) : undefined;
    if (user.role === "student" && !student) return res.json([]);
    const requestedGroup = user.role === "student"
      ? student!.academicGroup
      : typeof req.query.group === "string" ? req.query.group : undefined;
    const processed = await getModelTestStandings(req.params.groupId, requestedGroup);
    if (!processed) return res.status(404).json({ message: "Model test draft not found" });
    if (processed.scopeError) {
      return user.role === "student" ? res.json([]) : res.status(400).json({ message: processed.scopeError });
    }
    const standingByStudent = new Map(processed.standings.map((standing) => [standing.studentId, standing]));
    const allGroupResults = await storage.getModelTestResults(req.params.groupId, null);
    const annotatedResults = allGroupResults.map((result) => {
      const standing = standingByStudent.get(result.studentId);
      const subjectStanding = standing?.subjects.find((subject) =>
        subject.subject.trim().toLocaleLowerCase() === result.subject.trim().toLocaleLowerCase()
      );
      return {
        ...result,
        subjectPassStatus: subjectStanding?.status ?? "Pending",
        studentResultStatus: standing?.status ?? "Pending",
        totalMarksObtained: standing?.totalMarksObtained ?? 0,
        totalPossibleMarks: standing?.totalPossibleMarks ?? 0,
        meritRank: standing?.meritRank ?? null,
        meritPosition: standing?.meritPosition ?? null,
      };
    }).filter((result) =>
      standingByStudent.has(result.studentId)
      && processed.subjects.some((subject) => sameAcademicGroup(subject.name, result.subject))
    );
    if (user.role === "student") {
      return res.json(annotatedResults.filter((result) => result.studentId === student!.id));
    }
    res.json(annotatedResults);
  });

  app.get("/api/results/model-test/:groupId/standings", async (req, res) => {
    if (!requireAuth(req, res)) return;
    const user = req.user as any;
    const student = user.role === "student" ? await storage.getStudentByUserId(user.id) : undefined;
    if (user.role === "student" && !student) return res.json({ standings: [] });
    const requestedGroup = user.role === "student"
      ? student!.academicGroup
      : typeof req.query.group === "string" ? req.query.group : undefined;
    const processed = await getModelTestStandings(req.params.groupId, requestedGroup);
    if (!processed) return res.status(404).json({ message: "Model test draft not found" });
    if (processed.scopeError) {
      return user.role === "student"
        ? res.json({ ...processed, standings: [] })
        : res.status(400).json({ message: processed.scopeError });
    }
    if (user.role === "student") {
      return res.json({
        ...processed,
        standings: processed.standings.filter((standing) => standing.studentId === student!.id),
      });
    }
    res.json(processed);
  });

  app.get("/api/model-test-drafts/:groupId/tabulation", async (req, res) => {
    if (!requireRoles(req, res, ["admin", "teacher"])) return;
    const requestedGroup = typeof req.query.group === "string" ? req.query.group : undefined;
    const processed = await getModelTestStandings(req.params.groupId, requestedGroup);
    if (!processed) return res.status(404).json({ message: "Model test draft not found" });
    if (processed.scopeError) return res.status(400).json({ message: processed.scopeError });

    const table = formatModelTestTabulation(processed.subjects, processed.standings);
    res.json({
      groupId: processed.groupId,
      examName: processed.examName,
      batchId: processed.batchId,
      draftStatus: processed.draftStatus,
      academicGroup: processed.academicGroup,
      columns: table.columns,
      rows: table.rows,
    });
  });

  app.get("/api/model-test-drafts/:groupId/pdf", async (req, res) => {
    if (!requireRoles(req, res, ["admin", "teacher"])) return;
    try {
      const requestedGroup = typeof req.query.group === "string" ? req.query.group : undefined;
      const processed = await getModelTestStandings(req.params.groupId, requestedGroup);
      if (!processed) return res.status(404).json({ message: "Model test draft not found" });
      if (processed.scopeError) return res.status(400).json({ message: processed.scopeError });
      const batches = await storage.getBatches();
      const batch = batches.find((candidate) => candidate.id === processed.batchId);
      const { renderClassResultSheetPdf } = await import("./class-result-pdf.js");
      const pdf = await renderClassResultSheetPdf({
        examName: processed.examName,
        className: batch?.name || `Class ${processed.batchId}`,
        groupName: processed.academicGroup || "All Groups",
      }, formatModelTestTabulation(processed.subjects, processed.standings));
      const filename = `${processed.examName}_${batch?.name || processed.batchId}_Result_Sheet`
        .replace(/[^A-Za-z0-9_-]+/g, "_");
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}.pdf"`);
      res.setHeader("Content-Length", pdf.length);
      res.setHeader("Cache-Control", "no-store");
      res.send(pdf);
    } catch (error) {
      console.error("[Class Result PDF] OpenType rendering failed:", error);
      if (!res.headersSent) res.status(500).json({ message: "Could not generate the class result PDF" });
    }
  });

  // Model Test Drafts Routes
  app.get("/api/model-test-drafts", async (req, res) => {
    if (!requireRoles(req, res, ['admin', 'teacher'])) return;
    const drafts = await storage.getModelTestDrafts();
    res.json(drafts);
  });

  app.post("/api/model-test-drafts", async (req, res) => {
    if (!requireAdmin(req, res)) return;
    try {
      const payload = z.object({
        examName: z.string().trim().min(1),
        batchId: z.coerce.number().int().positive(),
        academicGroup: z.string().trim().nullable().optional(),
        subjects: z.array(z.object({
          subjectId: z.coerce.number().int().positive(),
          academicGroup: z.string().nullable().optional(),
        })).min(1),
      }).parse(req.body);

      const selectedIds = payload.subjects.map((subject) => subject.subjectId);
      if (new Set(selectedIds).size !== selectedIds.length) {
        return res.status(400).json({ message: "Select each subject only once" });
      }

      const allMasterSubjects = await storage.getSubjectMasterList();
      const selectedSubjects = payload.subjects.map((selection) =>
        allMasterSubjects.find((subject) => subject.id === selection.subjectId)
      );
      if (selectedSubjects.some((subject) => !subject)) {
        return res.status(400).json({ message: "One or more selected subjects are no longer available" });
      }
      if (selectedSubjects.some((subject) => subject!.batchId !== null && subject!.batchId !== payload.batchId)) {
        return res.status(400).json({ message: "A selected subject is not configured for this class" });
      }
      const normalizedNames = selectedSubjects.map((subject) => subject!.name.trim().toLocaleLowerCase());
      if (new Set(normalizedNames).size !== normalizedNames.length) {
        return res.status(400).json({ message: "Select each subject only once" });
      }

      const classStudents = (await storage.getStudents()).filter((student) =>
        student.batchId === payload.batchId && student.isActive !== false
      );
      const availableGroups = new Set(
        classStudents.map((student) => student.academicGroup?.trim()).filter((group): group is string => !!group)
      );
      const selectedGroup = payload.academicGroup?.trim()
        || payload.subjects.find((selection, index) =>
          !selectedSubjects[index]!.allGroups && !!selection.academicGroup?.trim()
        )?.academicGroup?.trim()
        || null;
      if (selectedGroup && !Array.from(availableGroups).some((group) => sameAcademicGroup(group, selectedGroup))) {
        return res.status(400).json({ message: `Unknown group: ${selectedGroup}` });
      }

      for (let index = 0; index < payload.subjects.length; index += 1) {
        const selection = payload.subjects[index];
        const masterSubject = selectedSubjects[index]!;
        if (masterSubject.allGroups) continue;
        if (selection.academicGroup && !Array.from(availableGroups).some((group) => sameAcademicGroup(group, selection.academicGroup))) {
          return res.status(400).json({ message: `Unknown group for ${masterSubject.name}` });
        }
        if (selectedGroup && selection.academicGroup?.trim() && !sameAcademicGroup(selection.academicGroup, selectedGroup)) {
          return res.status(400).json({ message: `All group-specific subjects must use ${selectedGroup}` });
        }
        if (availableGroups.size > 0 && !selectedGroup) {
          return res.status(400).json({ message: `Select a group for ${masterSubject.name}` });
        }
      }

      const { randomUUID } = await import("crypto");
      const groupId = randomUUID();
      const draft = await storage.createModelTestDraft({
        groupId,
        examName: payload.examName,
        batchId: payload.batchId,
        subjects: payload.subjects.map((selection, index) => {
          const subject = selectedSubjects[index]!;
          return {
            subjectId: subject.id,
            name: subject.name,
            totalMarks: subject.totalMarks,
            mcqEnabled: subject.mcqEnabled,
            cqEnabled: subject.cqEnabled,
            practicalEnabled: subject.practicalEnabled,
            mcqMax: subject.mcqMax,
            cqMax: subject.cqMax,
            practicalMax: subject.practicalMax,
            academicGroup: subject.allGroups ? null : selection.academicGroup?.trim() || selectedGroup,
            allGroups: subject.allGroups,
            draftAcademicGroup: selectedGroup,
          };
        }),
      });
      res.status(201).json(draft);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: "Provide a name, class, and at least one valid subject" });
      }
      res.status(500).json({ message: "Failed to create draft" });
    }
  });

  app.patch("/api/model-test-drafts/:groupId", async (req, res) => {
    if (!requireAdmin(req, res)) return;
    try {
      const payload = z.object({
        examName: z.string().trim().min(1).max(150),
        academicGroup: z.string().trim().nullable().optional(),
        subjects: z.array(z.object({
          subjectId: z.coerce.number().int().positive().optional(),
          name: z.string().trim().min(1),
          academicGroup: z.string().trim().nullable().optional(),
        })).min(1),
      }).parse(req.body);
      const draft = await storage.getModelTestDraftByGroupId(req.params.groupId);
      if (!draft) return res.status(404).json({ message: "Model test draft not found" });

      const normalizedNames = payload.subjects.map((subject) => subject.name.trim().toLocaleLowerCase());
      if (new Set(normalizedNames).size !== normalizedNames.length) {
        return res.status(400).json({ message: "A subject can only be added once to a draft" });
      }

      const [allMasterSubjects, allStudents, existingResults] = await Promise.all([
        storage.getSubjectMasterList(),
        storage.getStudents(),
        storage.getModelTestResults(req.params.groupId, null),
      ]);
      const classStudents = allStudents.filter((student) =>
        student.batchId === draft.batchId && student.isActive !== false
      );
      const availableGroups = new Set(
        classStudents.map((student) => student.academicGroup?.trim()).filter((group): group is string => !!group)
      );
      const nextDraftGroup = payload.academicGroup?.trim() || null;
      const currentDraftGroup = resolveModelTestGroupScope(draft.subjects).academicGroup;
      if (existingResults.length && !sameAcademicGroup(currentDraftGroup, nextDraftGroup)) {
        return res.status(400).json({ message: "Cannot change this draft's academic group after marks have been entered" });
      }
      if (nextDraftGroup && !Array.from(availableGroups).some((group) => sameAcademicGroup(group, nextDraftGroup))) {
        return res.status(400).json({ message: `Unknown group: ${nextDraftGroup}` });
      }
      const nextSubjects: ModelTestSubject[] = [];

      for (const selection of payload.subjects) {
        const oldSubject = draft.subjects.find((subject) =>
          (selection.subjectId !== undefined && subject.subjectId === selection.subjectId)
          || subject.name.trim().toLocaleLowerCase() === selection.name.trim().toLocaleLowerCase()
        );
        let subject: ModelTestSubject;

        if (oldSubject) {
          const nextGroup = oldSubject.allGroups ? null : selection.academicGroup?.trim() || null;
          const subjectResults = existingResults.filter((result) => result.subject === oldSubject.name);
          if (subjectResults.length && (oldSubject.academicGroup ?? null) !== nextGroup) {
            return res.status(400).json({ message: `Cannot change the group for ${oldSubject.name} after marks have been entered` });
          }
          subject = {
            ...oldSubject,
            academicGroup: nextGroup,
            draftAcademicGroup: nextDraftGroup,
          };
        } else {
          if (selection.subjectId === undefined) {
            return res.status(400).json({ message: `Select a predefined configuration for ${selection.name}` });
          }
          const masterSubject = allMasterSubjects.find((candidate) => candidate.id === selection.subjectId);
          if (!masterSubject
            || (masterSubject.batchId !== null && masterSubject.batchId !== draft.batchId)
            || masterSubject.name.trim().toLocaleLowerCase() !== selection.name.trim().toLocaleLowerCase()) {
            return res.status(400).json({ message: `${selection.name} is not configured for this class` });
          }
          subject = {
            subjectId: masterSubject.id,
            name: masterSubject.name,
            totalMarks: masterSubject.totalMarks,
            mcqEnabled: masterSubject.mcqEnabled,
            cqEnabled: masterSubject.cqEnabled,
            practicalEnabled: masterSubject.practicalEnabled,
            mcqMax: masterSubject.mcqMax,
            cqMax: masterSubject.cqMax,
            practicalMax: masterSubject.practicalMax,
            academicGroup: masterSubject.allGroups ? null : selection.academicGroup?.trim() || null,
            allGroups: masterSubject.allGroups,
            draftAcademicGroup: nextDraftGroup,
          };
        }

        if (!subject.allGroups) {
          if (subject.academicGroup && !Array.from(availableGroups).some((group) => sameAcademicGroup(group, subject.academicGroup))) {
            return res.status(400).json({ message: `Unknown group for ${subject.name}` });
          }
          if (nextDraftGroup && subject.academicGroup && !sameAcademicGroup(subject.academicGroup, nextDraftGroup)) {
            return res.status(400).json({ message: `${subject.name} is scoped to ${subject.academicGroup}, not ${nextDraftGroup}` });
          }
          if (availableGroups.size > 0 && !nextDraftGroup && !subject.academicGroup) {
            return res.status(400).json({ message: `Select a group for ${subject.name}` });
          }
        }
        nextSubjects.push(subject);
      }

      const previousNames = new Set(draft.subjects.map((subject) => subject.name));
      const subjectScopesChanged = nextSubjects.some((subject) => {
        const previous = draft.subjects.find((candidate) => candidate.name === subject.name);
        return previous && !sameAcademicGroup(previous.academicGroup, subject.academicGroup);
      });
      const subjectsChanged = draft.subjects.length !== nextSubjects.length
        || nextSubjects.some((subject) => !previousNames.has(subject.name))
        || subjectScopesChanged;
      const updated = await storage.updateModelTestDraft(req.params.groupId, {
        examName: payload.examName,
        subjects: nextSubjects.map((subject) => ({
          ...subject,
          draftAcademicGroup: nextDraftGroup,
        })),
        status: draft.status === "published" && (subjectsChanged || !sameAcademicGroup(currentDraftGroup, nextDraftGroup))
          ? "draft"
          : draft.status,
      });
      if (!updated) return res.status(404).json({ message: "Model test draft not found" });
      res.json(updated);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.issues[0]?.message || "Invalid draft settings" });
      }
      console.error("Error updating model test draft:", err);
      res.status(500).json({ message: "Failed to update model test draft" });
    }
  });

  app.patch("/api/model-test-drafts/:groupId/publish", async (req, res) => {
    if (!requireAdmin(req, res)) return;
    try {
      const draft = await storage.publishModelTestDraft(req.params.groupId);
      res.json(draft);
    } catch {
      res.status(404).json({ message: "Draft not found" });
    }
  });

  app.delete("/api/model-test-drafts/:groupId", async (req, res) => {
    if (!requireAdmin(req, res)) return;
    await storage.deleteModelTestDraft(req.params.groupId);
    res.sendStatus(204);
  });

  app.delete("/api/model-test-drafts/:groupId/subject", async (req, res) => {
    if (!requireAdmin(req, res)) return;
    const { subject } = req.body;
    if (!subject) return res.status(400).json({ message: "subject required" });
    await storage.deleteResultsByGroupIdAndSubject(req.params.groupId, subject);
    res.sendStatus(204);
  });

  app.post("/api/model-test-drafts/:groupId/marks", async (req, res) => {
    if (!requireRoles(req, res, ['admin', 'teacher'])) return;
    try {
      const { groupId } = req.params;
      const entriesSchema = z.array(z.object({
        studentId: z.number().int().positive(),
        batchId: z.number().int().positive(),
        examName: z.string().min(1),
        subject: z.string().min(1),
        totalMarks: z.number().int().min(1).max(1000),
        obtainedMarks: z.number().int().min(-1).max(1000),
        mcqMarks: z.number().int().min(0).max(1000).nullable(),
        cqMarks: z.number().int().min(0).max(1000).nullable(),
        practicalMarks: z.number().int().min(0).max(1000).nullable(),
      })).min(1);
      const entries = entriesSchema.parse(req.body?.entries);
      if (entries.length === 0) {
        return res.status(400).json({ message: "entries array is required" });
      }

      const draft = await storage.getModelTestDraftByGroupId(groupId);
      if (!draft) return res.status(404).json({ message: "Model test draft not found" });
      const scope = resolveModelTestGroupScope(draft.subjects);
      if (scope.error) return res.status(400).json({ message: scope.error });
      const subjectName = entries[0].subject;
      const draftSubject = scope.subjects.find((subject) => subject.name === subjectName);
      if (!draftSubject || entries.some((entry) =>
        entry.subject !== subjectName
        || entry.batchId !== draft.batchId
        || entry.examName !== draft.examName
      )) {
        return res.status(400).json({ message: "Marks must match the selected draft subject and class" });
      }

      const studentsInScope = filterModelTestRoster(await storage.getStudents(), draft.batchId, scope.academicGroup);
      const allowedStudentIds = new Set(studentsInScope.map((student) => student.id));
      const submittedStudentIds = new Set(entries.map((entry) => entry.studentId));
      if (submittedStudentIds.size !== entries.length || entries.some((entry) => !allowedStudentIds.has(entry.studentId))) {
        return res.status(400).json({ message: "Marks include a duplicate or a student outside this group" });
      }

      const existingGroupResults = await storage.getModelTestResults(groupId, null);
      for (const entry of entries) {
        const existing = existingGroupResults.find((result) =>
          result.studentId === entry.studentId && result.subject === entry.subject
        );
        const validationMessage = validateSubjectMarksEntry(entry, existing, draftSubject);
        if (validationMessage) {
          return res.status(400).json({ message: validationMessage });
        }
      }

      await storage.saveModelTestSubjectMarks(groupId, entries);
      const processed = await getModelTestStandings(groupId);

      // Notification trigger: model test marks
      try {
        const allBatches = await storage.getBatches();
        const batch = allBatches.find(b => b.id === entries[0].batchId);
        const teacherName = (req.user as any).username;
        const subject = entries[0].subject;
        await storage.createNotification(
          `${teacherName} has uploaded model test results for ${batch?.name ?? "a batch"} in ${subject}.`,
          "result"
        );
      } catch (_) {}

      res.json({ saved: entries.length, standings: processed?.standings ?? [] });
    } catch (err) {
      console.error("Error saving model test marks:", err);
      res.status(err instanceof z.ZodError ? 400 : 500).json({
        message: err instanceof z.ZodError ? "Invalid marks data" : "Failed to save marks",
      });
    }
  });

  // Notification API routes
  app.get("/api/notifications", async (req, res) => {
    if (!requireAdmin(req, res)) return;
    const notifs = await storage.getNotifications(20);
    res.json(notifs);
  });

  app.get("/api/notifications/unread-count", async (req, res) => {
    if (!requireAdmin(req, res)) return;
    const count = await storage.getUnreadNotificationCount();
    res.json({ count });
  });

  app.patch("/api/notifications/read-all", async (req, res) => {
    if (!requireAdmin(req, res)) return;
    await storage.markAllNotificationsRead();
    res.json({ ok: true });
  });

  // Collection Tracking routes
  // GET /api/collections/me — teacher sees their own balance
  app.get("/api/collections/me", async (req, res) => {
    if (!requireAuth(req, res)) return;
    const userId = (req.user as any).id;
    try {
      const row = await storage.getCollectionByUserId(userId);
      res.json({ userId, runningCollection: row?.runningCollection ?? 0, lastResetAt: row?.lastResetAt ?? null });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // GET /api/collections/me/details — teacher sees individual payments in current (uncleared) collection
  app.get("/api/collections/me/details", async (req, res) => {
    if (!requireAuth(req, res)) return;
    const userId = (req.user as any).id;
    try {
      const row = await storage.getCollectionByUserId(userId);
      const lastResetAt = row?.lastResetAt ?? null;

      const allStudents = await db.select().from(students);
      const studentMap: Record<number, string> = {};
      allStudents.forEach((s) => { studentMap[s.id] = s.name; });

      const { gte, and: dbAnd } = await import("drizzle-orm");
      const conditions = lastResetAt
        ? dbAnd(eq(incomesTable.recordedBy, userId), gte(incomesTable.date, lastResetAt))
        : eq(incomesTable.recordedBy, userId);

      const rows = await db
        .select()
        .from(incomesTable)
        .where(conditions)
        .orderBy(desc(incomesTable.date));

      const details = rows.map((r) => ({
        id: r.id,
        studentName: studentMap[r.studentId] ?? `Student #${r.studentId}`,
        month: r.month,
        amount: r.amount,
        date: r.date,
      }));

      res.json(details);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // GET /api/collections/:userId/details — admin sees individual uncleared payments for a teacher
  app.get("/api/collections/:userId/details", async (req, res) => {
    if (!requireAdmin(req, res)) return;
    const userId = parseInt(req.params.userId, 10);
    if (isNaN(userId)) return res.status(400).json({ message: "Invalid user id" });
    try {
      const row = await storage.getCollectionByUserId(userId);
      const lastResetAt = row?.lastResetAt ?? null;

      const allStudents = await db.select().from(students);
      const studentMap: Record<number, { name: string; batchId: number | null }> = {};
      allStudents.forEach((s) => { studentMap[s.id] = { name: s.name, batchId: s.batchId ?? null }; });

      const { batches: batchesTable } = await import("../shared/schema.js");
      const allBatches = await db.select().from(batchesTable);
      const batchMap: Record<number, string> = {};
      allBatches.forEach((b) => { batchMap[b.id] = b.name; });

      const { gte, and: dbAnd } = await import("drizzle-orm");
      const conditions = lastResetAt
        ? dbAnd(eq(incomesTable.recordedBy, userId), gte(incomesTable.date, lastResetAt))
        : eq(incomesTable.recordedBy, userId);

      const rows = await db
        .select()
        .from(incomesTable)
        .where(conditions)
        .orderBy(desc(incomesTable.date));

      const details = rows.map((r) => {
        const student = studentMap[r.studentId];
        const batchName = student?.batchId ? (batchMap[student.batchId] ?? "—") : "—";
        return {
          id: r.id,
          studentName: student?.name ?? `Student #${r.studentId}`,
          batchName,
          month: r.month,
          amount: r.amount,
          date: r.date,
        };
      });

      res.json(details);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // GET /api/collections — admin sees all teachers
  app.get("/api/collections", async (req, res) => {
    if (!requireAdmin(req, res)) return;
    try {
      const rows = await storage.getAllCollections();
      res.json(rows);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // POST /api/collections/:userId/reset — admin resets a teacher's balance and auto-creates a deposit
  app.post("/api/collections/:userId/reset", async (req, res) => {
    if (!requireAdmin(req, res)) return;
    const userId = parseInt(req.params.userId, 10);
    if (isNaN(userId)) return res.status(400).json({ message: "Invalid user id" });
    try {
      const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
      const month: string = req.body?.month && MONTHS.includes(req.body.month)
        ? req.body.month
        : MONTHS[new Date().getMonth()];

      const currentCollection = await storage.getCollectionByUserId(userId);
      const amount = currentCollection?.runningCollection ?? 0;

      let deposit = null;
      if (amount > 0) {
        const [teacher] = await db.select().from(users).where(eq(users.id, userId));
        const teacherName = teacher?.name || teacher?.username || `Teacher #${userId}`;
        deposit = await storage.createDeposit({
          description: `Collection - ${teacherName}`,
          amount,
          month,
        });
      }

      const collection = await storage.resetCollection(userId);
      res.json({ collection, deposit });
    } catch (err: any) {
      console.error("Collection reset error:", err);
      res.status(500).json({ message: err.message });
    }
  });

  // ---------------------------------------------------------------------------
  // ZKTeco Integration
  // POST /api/attendance/sync-zkteco
  //
  // Accepts an array of raw punch log objects straight from the ZKTeco device
  // (or any intermediary script that forwards them).  Each object must contain
  // at least `userId` (device-enrolled ID) and `punchTime` (ISO-8601 string).
  // All other fields are stored verbatim in the `rawLog` JSON column for
  // auditing and future processing.
  //
  // Deduplication: a log is considered a duplicate if the same (userId, punchTime)
  // pair already exists in the zkteco_logs table.
  //
  // Response: { status, inserted, duplicates, total }
  // ---------------------------------------------------------------------------
  const zktecoLogSchema = z.object({
    userId:    z.string({ required_error: "userId is required" }).min(1),
    deviceId:  z.string().optional().default(""),
    punchTime: z.string({ required_error: "punchTime is required" }),
  }).passthrough(); // keep all extra device fields in rawLog

  app.post("/api/attendance/sync-zkteco", async (req, res) => {
    // Allow authentication via x-api-key header (for device/script callers that
    // cannot maintain a browser session) OR via the normal admin session cookie.
    const apiKey = process.env.ZKTECO_API_KEY;
    const providedKey = req.headers["x-api-key"];
    const apiKeyValid = apiKey && providedKey === apiKey;
    if (!apiKeyValid && !requireAdmin(req, res)) return;

    try {
      // Body must be a non-empty array.
      if (!Array.isArray(req.body) || req.body.length === 0) {
        return res.status(400).json({
          status: "error",
          message: "Request body must be a non-empty array of punch log objects.",
        });
      }

      // Validate every entry; collect validation errors with their index.
      const validLogs: z.infer<typeof zktecoLogSchema>[] = [];
      const validationErrors: { index: number; error: string }[] = [];

      for (let i = 0; i < req.body.length; i++) {
        const parsed = zktecoLogSchema.safeParse(req.body[i]);
        if (parsed.success) {
          validLogs.push(parsed.data);
        } else {
          validationErrors.push({
            index: i,
            error: parsed.error.errors.map(e => `${e.path.join(".")}: ${e.message}`).join("; "),
          });
        }
      }

      if (validLogs.length === 0) {
        return res.status(400).json({
          status: "error",
          message: "No valid log entries found.",
          validationErrors,
        });
      }

      // Map validated payloads → InsertZktecoLog rows.
      const insertRows = validLogs.map(log => {
        // Normalise punchTime — the ZKTeco device sends local Bangladesh time
        // (Asia/Dhaka, UTC+6) as a bare string with no timezone suffix, e.g.
        // "2026-07-29 08:11:00".  JavaScript's Date constructor treats such
        // strings as UTC, which would add a spurious +6 h offset on display.
        // Fix: if the string carries no timezone indicator, append "+06:00" so
        // it is correctly interpreted as Dhaka local time before UTC conversion.
        let rawTs = log.punchTime.trim();
        const hasTzInfo = /[Zz]$/.test(rawTs) || /[+-]\d{2}:?\d{2}$/.test(rawTs);
        if (!hasTzInfo) {
          // Normalise space separator to "T" for ISO-8601 compliance, then tag
          // as Asia/Dhaka so the UTC value stored in PostgreSQL is correct.
          rawTs = rawTs.replace(" ", "T") + "+06:00";
        }
        const punchDate = new Date(rawTs);
        if (isNaN(punchDate.getTime())) {
          throw new Error(`Invalid punchTime value: "${log.punchTime}"`);
        }
        return {
          deviceUserId: log.userId,
          deviceId:     log.deviceId ?? "",
          punchTime:    punchDate,
          rawLog:       log as Record<string, unknown>,
        };
      });

      const { inserted, duplicates } = await storage.syncZktecoLogs(insertRows);

      return res.status(200).json({
        status:     "ok",
        inserted,
        duplicates,
        total:      req.body.length,
        ...(validationErrors.length > 0 ? { skippedInvalid: validationErrors.length, validationErrors } : {}),
      });
    } catch (err: any) {
      console.error("[ZKTeco] sync error:", err);
      return res.status(500).json({ status: "error", message: err?.message ?? "Internal server error" });
    }
  });

  // ── Class Routine CRUD ─────────────────────────────────────────────────────
  // GET /api/class-routines?batchId=N&shift=Morning&group=Science  — auth required
  app.get(api.classRoutines.list.path, async (req, res) => {
    if (!requireAuth(req, res)) return;
    const batchId      = req.query.batchId ? Number(req.query.batchId) : undefined;
    const shift        = req.query.shift  ? String(req.query.shift)  : undefined;
    const academicGroup = req.query.group ? String(req.query.group)  : undefined;
    const routines = await storage.getClassRoutines(batchId, shift, academicGroup);
    res.json(routines);
  });

  // POST /api/class-routines  — admin only
  app.post(api.classRoutines.create.path, async (req, res) => {
    if (!requireAdmin(req, res)) return;
    try {
      const input = api.classRoutines.create.input.parse({
        ...req.body,
        batchId: Number(req.body.batchId),
        isOffDay: Boolean(req.body.isOffDay),
      });
      const routine = await storage.createClassRoutine(input);
      res.status(201).json(routine);
    } catch (err) {
      if (err instanceof z.ZodError) {
        res.status(400).json({ message: err.errors[0].message, field: err.errors[0].path.join(".") });
      } else {
        res.status(500).json({ message: "Internal server error" });
      }
    }
  });

  // PUT /api/class-routines/:id  — admin only
  app.put(api.classRoutines.update.path, async (req, res) => {
    if (!requireAdmin(req, res)) return;
    const id = Number(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid id" });
    try {
      const input = api.classRoutines.update.input.parse({
        ...req.body,
        ...(req.body.batchId !== undefined && { batchId: Number(req.body.batchId) }),
        ...(req.body.isOffDay !== undefined && { isOffDay: Boolean(req.body.isOffDay) }),
      });
      const routine = await storage.updateClassRoutine(id, input);
      res.json(routine);
    } catch (err) {
      if (err instanceof z.ZodError) {
        res.status(400).json({ message: err.errors[0].message });
      } else if ((err as any)?.message === "Class routine not found") {
        res.status(404).json({ message: "Class routine not found" });
      } else {
        res.status(500).json({ message: "Internal server error" });
      }
    }
  });

  // DELETE /api/class-routines/:id  — admin only
  app.delete(api.classRoutines.delete.path, async (req, res) => {
    if (!requireAdmin(req, res)) return;
    const id = Number(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid id" });
    await storage.deleteClassRoutine(id);
    res.sendStatus(204);
  });

  return httpServer;
}

