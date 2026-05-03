import { db } from "./db";
import { eq, sql, desc } from "drizzle-orm";
import { students, incomes as incomesTable } from "@shared/schema";
import type { Express } from "express";
import { type Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import { setupAuth } from "./auth/auth";
import bcrypt from "bcryptjs";
import { execSync } from "child_process";

function removePassword<T extends { password?: string } | null | undefined>(user: T) {
  if (!user) return user;
  const { password: _password, ...safeUser } = user;
  return safeUser;
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
    const dbUrl = process.env.NEON_DATABASE_URL || process.env.DATABASE_URL;
    const sessionSecret = process.env.SESSION_SECRET;
    try {
      await db.execute(sql`SELECT 1`);
      res.json({
        status: "ok",
        db: "connected",
        hasDbUrl: !!dbUrl,
        hasSessionSecret: !!sessionSecret,
        nodeEnv: process.env.NODE_ENV,
      });
    } catch (err: any) {
      res.status(500).json({
        status: "error",
        db: "unreachable",
        error: err.message,
        hasDbUrl: !!dbUrl,
        hasSessionSecret: !!sessionSecret,
        nodeEnv: process.env.NODE_ENV,
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

    if (user.role === 'student') {
      const student = await storage.getStudentByUserId(user.id);
      if (!student) return res.json([]);
      const incomes = await storage.getIncomesByStudentId(student.id);
      console.log(`[BACKEND LOG] Fetched ${incomes.length} incomes for student ${student.name}`);
      return res.json(incomes);
    }

    const allIncomes = await storage.getIncomes();
    console.log(`[BACKEND LOG] Fetched ${allIncomes.length} total incomes`);

    // Determine effective portal — authority teachers can switch between
    // "teacher" (own records only) and "admin" (all records) portals.
    const requestedPortal = String(req.query.portal ?? "").toLowerCase();
    const inTeacherPortal =
      user.role === 'teacher' && (!user.isAuthority || requestedPortal === 'teacher');

    if (inTeacherPortal) {
      const filtered = allIncomes.filter(inc => inc.recordedBy === user.id);
      console.log(`[BACKEND LOG] Teacher ${user.username} (portal=${requestedPortal || 'teacher'}) sees ${filtered.length} incomes`);
      return res.json(filtered);
    }

    res.json(allIncomes);
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
    const expenses = await storage.getExpenses();
    console.log(`[BACKEND LOG] Fetched ${expenses.length} total expenses`);
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
        res.status(500).json({ message: "Internal server error" });
      }
    }
  });

  app.delete(api.deposits.delete.path, async (req, res) => {
    if (!requireAdmin(req, res)) return;
    await storage.deleteDeposit(Number(req.params.id));
    res.sendStatus(204);
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
      const { insertResultSchema } = await import("@shared/schema");
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
      const { insertResultSchema } = await import("@shared/schema");
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

  app.get("/api/attendance/summary", async (req, res) => {
    if (!requireAdmin(req, res)) return;
    const subject = req.query.subject ? String(req.query.subject) : undefined;
    const academicGroup = req.query.academicGroup ? String(req.query.academicGroup) : undefined;
    const shift = req.query.shift ? String(req.query.shift) : undefined;
    const summary = await storage.getAttendanceSummary({ subject, academicGroup, shift });
    res.json(summary);
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
    if (user.role === "student") {
      const student = await storage.getStudentByUserId(user.id);
      if (!student) return res.json([]);
      const groupResults = await storage.getModelTestResults(req.params.groupId, student.id);
      return res.json(groupResults);
    }
    const groupResults = await storage.getModelTestResults(req.params.groupId, null);
    res.json(groupResults);
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
      const { examName, batchId, subjects } = req.body;
      if (!examName || !batchId || !Array.isArray(subjects) || subjects.length === 0) {
        return res.status(400).json({ message: "examName, batchId, and subjects are required" });
      }
      const { randomUUID } = await import("crypto");
      const groupId = randomUUID();
      const draft = await storage.createModelTestDraft({
        groupId,
        examName,
        batchId: Number(batchId),
        subjects,
      });
      res.status(201).json(draft);
    } catch (err) {
      res.status(500).json({ message: "Failed to create draft" });
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
      const { entries } = req.body as {
        entries: { studentId: number; batchId: number; examName: string; subject: string; totalMarks: number; obtainedMarks: number }[];
      };
      if (!Array.isArray(entries) || entries.length === 0) {
        return res.status(400).json({ message: "entries array is required" });
      }
      await storage.saveModelTestSubjectMarks(groupId, entries);

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

      res.json({ saved: entries.length });
    } catch (err) {
      console.error("Error saving model test marks:", err);
      res.status(500).json({ message: "Failed to save marks" });
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

  // POST /api/collections/:userId/reset — admin resets a teacher's balance
  app.post("/api/collections/:userId/reset", async (req, res) => {
    if (!requireAdmin(req, res)) return;
    const userId = parseInt(req.params.userId, 10);
    if (isNaN(userId)) return res.status(400).json({ message: "Invalid user id" });
    try {
      const row = await storage.resetCollection(userId);
      res.json(row);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  return httpServer;
}

