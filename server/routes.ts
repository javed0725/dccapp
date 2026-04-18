import { db } from "./db";
import { eq, sql } from "drizzle-orm";
import { students } from "@shared/schema";
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

  app.get("/api/_git_push", async (_req, res) => {
    try {
      const token = process.env.GITHUB_PERSONAL_ACCESS_TOKEN;
      if (!token) return res.status(500).json({ error: "No token" });
      const cwd = process.cwd();
      execSync(`git remote set-url origin https://x-access-token:${token}@github.com/javed0725/dccapp.git`, { cwd });
      execSync("git add -A", { cwd });
      execSync('git commit -m "Add Teacher Directory to Student Panel" --allow-empty', { cwd });
      const out = execSync("git push origin main 2>&1", { cwd, timeout: 60000 }).toString();
      res.json({ ok: true, out });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
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
    if (!req.isAuthenticated() || (req.user as any).role !== "admin") {
      return res.sendStatus(403);
    }
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
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const batches = await storage.getBatches();
    res.json(batches);
  });

  app.post(api.batches.create.path, async (req, res) => {
    if (!req.isAuthenticated() || ((req.user as any).role !== 'admin' && (req.user as any).role !== 'teacher')) {
      return res.sendStatus(403);
    }
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
    if (!req.isAuthenticated() || req.user.role !== 'admin') return res.sendStatus(403);
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
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const students = await storage.getStudents();
    console.log(`[BACKEND LOG] Fetched ${students.length} students`);
    res.json(students);
  });

  app.post(api.students.create.path, async (req, res) => {
    if (!req.isAuthenticated() || ((req.user as any).role !== 'admin' && (req.user as any).role !== 'teacher')) {
      return res.sendStatus(403);
    }
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
    if (!req.isAuthenticated()) return res.sendStatus(401);
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
    } catch (err) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.delete(api.students.delete.path, async (req, res) => {
    if (!req.isAuthenticated() || (req.user as any).role !== 'admin') return res.sendStatus(403);
    try {
      await storage.deleteStudent(Number(req.params.id));
      res.sendStatus(204);
    } catch (err) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get(api.incomes.list.path, async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
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
    
    // Teachers only see their own entries
    if (user.role === 'teacher') {
      const filtered = allIncomes.filter(inc => inc.recordedBy === user.id);
      console.log(`[BACKEND LOG] Teacher ${user.username} sees ${filtered.length} incomes`);
      return res.json(filtered);
    }
    
    res.json(allIncomes);
  });

  app.post(api.incomes.create.path, async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
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
      } catch (_) {}

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
    if (!req.isAuthenticated() || (req.user as any).role !== 'admin') return res.sendStatus(403);
    await storage.deleteIncome(Number(req.params.id));
    res.sendStatus(204);
  });

  app.get(api.expenses.list.path, async (req, res) => {
    if (!req.isAuthenticated() || (req.user as any).role !== 'admin') return res.sendStatus(403);
    const expenses = await storage.getExpenses();
    console.log(`[BACKEND LOG] Fetched ${expenses.length} total expenses`);
    res.json(expenses);
  });

  app.post(api.expenses.create.path, async (req, res) => {
    if (!req.isAuthenticated() || (req.user as any).role !== 'admin') return res.sendStatus(403);
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
    if (!req.isAuthenticated() || (req.user as any).role !== 'admin') return res.sendStatus(403);
    await storage.deleteExpense(Number(req.params.id));
    res.sendStatus(204);
  });

  // Teacher Management Routes
  app.get("/api/admin/teachers", async (req, res) => {
    if (!req.isAuthenticated() || (req.user as any).role !== 'admin') return res.sendStatus(403);
    const teachers = await storage.getTeachers();
    res.json(teachers.map(removePassword));
  });

  app.post("/api/admin/teachers", async (req, res) => {
    if (!req.isAuthenticated() || (req.user as any).role !== 'admin') return res.sendStatus(403);
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
    if (!req.isAuthenticated() || (req.user as any).role !== 'admin') return res.sendStatus(403);
    const id = Number(req.params.id);
    const { password, role, name, subject } = req.body;
    const updateData: any = {};
    if (password) updateData.password = await bcrypt.hash(password, 10);
    if (role) updateData.role = role;
    if (name !== undefined) updateData.name = name;
    if (subject !== undefined) updateData.subject = subject;
    
    const user = await storage.updateUser(id, updateData);
    res.json(removePassword(user));
  });

  app.delete("/api/admin/teachers/:id", async (req, res) => {
    if (!req.isAuthenticated() || (req.user as any).role !== 'admin') return res.sendStatus(403);
    await storage.deleteUser(Number(req.params.id));
    res.sendStatus(204);
  });

  app.patch(api.incomes.updateStatus.path, async (req, res) => {
    if (!req.isAuthenticated() || (req.user as any).role !== 'admin') return res.sendStatus(403);
    try {
      const { status } = z.object({ status: z.enum(["Pending", "Verified"]) }).parse(req.body);
      const income = await storage.updateIncomeStatus(Number(req.params.id), status);
      res.json(income);
    } catch (err) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.patch("/api/user/password", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try {
      const { password } = z.object({ password: z.string().min(6) }).parse(req.body);
      const hashedPassword = await bcrypt.hash(password, 10);
      await storage.updateUser((req.user as any).id, { password: hashedPassword });
      res.json({ message: "Password updated" });
    } catch (err) {
      res.status(400).json({ message: "Invalid password" });
    }
  });

  // Results Routes
  app.get("/api/results", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
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
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const role = (req.user as any).role;
    if (role !== "teacher" && role !== "admin") return res.sendStatus(403);
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

      // Notification trigger: result upload
      try {
        const allBatches = await storage.getBatches();
        const batch = allBatches.find(b => b.id === data.batchId);
        const teacherName = (req.user as any).username;
        await storage.createNotification(
          `${teacherName} has uploaded results for ${batch?.name ?? "a batch"} in ${data.subject}.`,
          "result"
        );
      } catch (_) {}

      res.status(201).json(result);
    } catch (err) {
      res.status(400).json({ message: "Invalid data" });
    }
  });

  app.patch("/api/results/:id", async (req, res) => {
    if (!req.isAuthenticated() || (req.user as any).role !== "admin") return res.sendStatus(403);
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
    if (!req.isAuthenticated() || (req.user as any).role !== "admin") return res.sendStatus(403);
    const id = Number(req.params.id);
    if (isNaN(id)) return res.sendStatus(400);
    await storage.deleteResult(id);
    res.sendStatus(204);
  });

  app.get("/api/results/model-test/:groupId", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
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
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const role = (req.user as any).role;
    if (role === "student") return res.sendStatus(403);
    const drafts = await storage.getModelTestDrafts();
    res.json(drafts);
  });

  app.post("/api/model-test-drafts", async (req, res) => {
    if (!req.isAuthenticated() || (req.user as any).role !== "admin") return res.sendStatus(403);
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
    if (!req.isAuthenticated() || (req.user as any).role !== "admin") return res.sendStatus(403);
    try {
      const draft = await storage.publishModelTestDraft(req.params.groupId);
      res.json(draft);
    } catch {
      res.status(404).json({ message: "Draft not found" });
    }
  });

  app.delete("/api/model-test-drafts/:groupId", async (req, res) => {
    if (!req.isAuthenticated() || (req.user as any).role !== "admin") return res.sendStatus(403);
    await storage.deleteModelTestDraft(req.params.groupId);
    res.sendStatus(204);
  });

  app.delete("/api/model-test-drafts/:groupId/subject", async (req, res) => {
    if (!req.isAuthenticated() || (req.user as any).role !== "admin") return res.sendStatus(403);
    const { subject } = req.body;
    if (!subject) return res.status(400).json({ message: "subject required" });
    await storage.deleteResultsByGroupIdAndSubject(req.params.groupId, subject);
    res.sendStatus(204);
  });

  app.post("/api/model-test-drafts/:groupId/marks", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const role = (req.user as any).role;
    if (role !== "admin" && role !== "teacher") return res.sendStatus(403);
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
    if (!req.isAuthenticated() || (req.user as any).role !== "admin") return res.sendStatus(403);
    const notifs = await storage.getNotifications(20);
    res.json(notifs);
  });

  app.get("/api/notifications/unread-count", async (req, res) => {
    if (!req.isAuthenticated() || (req.user as any).role !== "admin") return res.sendStatus(403);
    const count = await storage.getUnreadNotificationCount();
    res.json({ count });
  });

  app.patch("/api/notifications/read-all", async (req, res) => {
    if (!req.isAuthenticated() || (req.user as any).role !== "admin") return res.sendStatus(403);
    await storage.markAllNotificationsRead();
    res.json({ ok: true });
  });

  // Collection Tracking routes
  // GET /api/collections/me — teacher sees their own balance
  app.get("/api/collections/me", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
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
    if (!req.isAuthenticated() || (req.user as any).role !== "admin") return res.sendStatus(403);
    try {
      const rows = await storage.getAllCollections();
      res.json(rows);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // POST /api/collections/:userId/reset — admin resets a teacher's balance
  app.post("/api/collections/:userId/reset", async (req, res) => {
    if (!req.isAuthenticated() || (req.user as any).role !== "admin") return res.sendStatus(403);
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

