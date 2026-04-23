import { db } from "./db";
import { 
  incomes, expenses, batches, students, users, results, modelTestDrafts, notifications, siteSettings,
  collectionTracking, attendance,
  type Income, type InsertIncome, 
  type Expense, type InsertExpense,
  type Batch, type InsertBatch,
  type Student, type InsertStudent,
  type User, type InsertUser,
  type Result, type InsertResult,
  type ModelTestDraft,
  type Notification,
  type CollectionTracking,
  type Attendance, type InsertAttendance,
} from "@shared/schema";
import { eq, desc, asc, inArray, sql } from "drizzle-orm";

function removePassword<T extends User | null | undefined>(user: T) {
  if (!user) return user;
  const { password: _password, ...safeUser } = user;
  return safeUser;
}

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUsers(): Promise<User[]>;
  createUser(user: InsertUser): Promise<User>;
  
  getBatches(): Promise<Batch[]>;
  createBatch(batch: InsertBatch): Promise<Batch>;
  deleteBatch(id: number): Promise<void>;
  getStudent(id: number): Promise<Student | undefined>;
  getStudents(): Promise<any[]>;
  createStudent(student: InsertStudent): Promise<Student>;
  updateStudent(id: number, data: Partial<Student>): Promise<Student>;
  deleteStudent(id: number): Promise<void>;
  
  // Teacher Management
  getTeachers(): Promise<User[]>;
  updateUser(id: number, data: Partial<User>): Promise<User>;
  deleteUser(id: number): Promise<void>;
  
  getIncomes(): Promise<any[]>;
  getIncomesByStudentId(studentId: number): Promise<any[]>;
  getStudentByUserId(userId: number): Promise<Student | undefined>;
  createIncome(income: InsertIncome & { recordedBy?: number }): Promise<Income>;
  updateIncomeStatus(id: number, status: string): Promise<Income>;
  deleteIncome(id: number): Promise<void>;
  
  getExpenses(): Promise<Expense[]>;
  createExpense(expense: InsertExpense): Promise<Expense>;
  deleteExpense(id: number): Promise<void>;

  // Results Management
  getResults(): Promise<any[]>;
  getResultsByStudentId(studentId: number): Promise<any[]>;
  getModelTestResults(groupId: string, studentId: number | null): Promise<any[]>;
  createResult(result: InsertResult): Promise<Result>;
  updateResult(id: number, data: Partial<{ examName: string; subject: string; obtainedMarks: number; totalMarks: number }>): Promise<Result>;
  deleteResult(id: number): Promise<void>;
  deleteResultsByGroupIdAndSubject(groupId: string, subject: string): Promise<void>;
  deleteResultsByExam(batchId: number, examName: string, subject?: string): Promise<number>;

  // Attendance
  upsertAttendance(data: { date: string; batchId: number; teacherId: number | null; absentStudentIds: number[]; totalStudents: number; }): Promise<Attendance>;
  getAttendanceByDate(batchId: number, date: string): Promise<Attendance | undefined>;
  getAttendanceHistory(batchId?: number): Promise<Attendance[]>;
  getAttendanceSummary(): Promise<Array<{ batchId: number; batchName: string; totalSessions: number; averageAttendance: number; lastDate: string | null }>>;

  // Model Test Drafts
  getModelTestDrafts(): Promise<any[]>;
  getModelTestDraftByGroupId(groupId: string): Promise<ModelTestDraft | undefined>;
  createModelTestDraft(data: { groupId: string; examName: string; batchId: number; subjects: { name: string; totalMarks: number }[] }): Promise<ModelTestDraft>;
  publishModelTestDraft(groupId: string): Promise<ModelTestDraft>;
  deleteModelTestDraft(groupId: string): Promise<void>;
  getPublishedModelTestGroupIds(): Promise<string[]>;

  // Notifications
  getNotifications(limit?: number): Promise<Notification[]>;
  createNotification(message: string, type: string): Promise<Notification>;
  markAllNotificationsRead(): Promise<void>;
  getUnreadNotificationCount(): Promise<number>;

  // Site Settings
  getAllSettings(): Promise<Record<string, string>>;
  getSetting(key: string): Promise<string | undefined>;
  setSetting(key: string, value: string): Promise<void>;

  // Collection Tracking
  getCollectionByUserId(userId: number): Promise<CollectionTracking | undefined>;
  getAllCollections(): Promise<(CollectionTracking & { user: Omit<User, "password"> })[]>;
  addToCollection(userId: number, amount: number): Promise<CollectionTracking>;
  resetCollection(userId: number): Promise<CollectionTracking>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async getBatches(): Promise<Batch[]> {
    return await db.select().from(batches).orderBy(asc(batches.id));
  }

  async createBatch(insertBatch: InsertBatch): Promise<Batch> {
    const [batch] = await db.insert(batches).values(insertBatch).returning();
    return batch;
  }

  async getStudent(id: number): Promise<Student | undefined> {
    const [student] = await db.select().from(students).where(eq(students.id, id));
    return student;
  }

  async getStudents(): Promise<any[]> {
    const allStudents = await db.select().from(students).orderBy(asc(students.id));
    const allBatches = await db.select().from(batches).orderBy(asc(batches.id));
    const allUsers = await db.select().from(users);
    console.log(`[STORAGE LOG] Students in DB: ${allStudents.length}`);
    return allStudents.map(student => ({
      ...student,
      batch: allBatches.find(b => b.id === student.batchId),
      addedByUser: student.addedByUserId ? removePassword(allUsers.find(u => u.id === student.addedByUserId)) : null,
    }));
  }

  async createStudent(insertStudent: InsertStudent): Promise<Student> {
    const [student] = await db.insert(students).values(insertStudent).returning();
    return student;
  }

  async updateStudent(id: number, data: Partial<Student>): Promise<Student> {
    const [oldStudent] = await db.select().from(students).where(eq(students.id, id));
    const [student] = await db.update(students).set(data).where(eq(students.id, id)).returning();
    
    if (data.studentCustomId && oldStudent && oldStudent.userId) {
      await db.update(users).set({ username: data.studentCustomId }).where(eq(users.id, oldStudent.userId));
    }
    
    if (!student) throw new Error("Student not found");
    return student;
  }

  async deleteStudent(id: number): Promise<void> {
    await db.delete(students).where(eq(students.id, id));
  }

  async deleteBatch(id: number): Promise<void> {
    await db.delete(batches).where(eq(batches.id, id));
  }

  async getUsers(): Promise<User[]> {
    return await db.select().from(users);
  }

  async getTeachers(): Promise<User[]> {
    return await db.select().from(users).where(eq(users.role, "teacher")).orderBy(asc(users.id));
  }

  async createTeacher(teacherId: string, username: string, password: string, mobileNumber?: string, name?: string, subject?: string): Promise<User> {
    const [user] = await db.insert(users).values({
      username,
      password,
      role: "teacher",
      teacherId,
      mobileNumber: mobileNumber ?? null,
      name: name ?? null,
      subject: subject ?? null,
    }).returning();
    return user;
  }

  async updateUser(id: number, data: Partial<User>): Promise<User> {
    const [user] = await db.update(users).set(data).where(eq(users.id, id)).returning();
    if (!user) throw new Error("User not found");
    return user;
  }

  async deleteUser(id: number): Promise<void> {
    await db.delete(users).where(eq(users.id, id));
  }

  async findIncomeByStudentAndMonth(studentId: number, month: string): Promise<Income | undefined> {
    const { and } = await import("drizzle-orm");
    const [existing] = await db.select().from(incomes).where(
      and(eq(incomes.studentId, studentId), eq(incomes.month, month))
    );
    return existing;
  }

  async getIncomes(): Promise<any[]> {
    const allIncomes = await db.select().from(incomes).orderBy(desc(incomes.date));
    const allStudents = await this.getStudents();
    const allBatches = await this.getBatches();
    const allUsers = await db.select().from(users);

    return allIncomes.map(income => ({
        ...income,
        student: allStudents.find(s => s.id === income.studentId),
        batch: allBatches.find(b => b.id === income.batchId),
        recorder: removePassword(allUsers.find(u => u.id === income.recordedBy)),
        status: income.status,
        addedBy: income.addedBy
    }));
  }

  async getIncomesByStudentId(studentId: number): Promise<any[]> {
    const studentIncomes = await db.select().from(incomes).where(eq(incomes.studentId, studentId)).orderBy(desc(incomes.date));
    const [student] = await db.select().from(students).where(eq(students.id, studentId));
    const allBatches = await db.select().from(batches);

    return studentIncomes.map(income => ({
      ...income,
      student,
      batch: allBatches.find(b => b.id === income.batchId),
      status: income.status || "Received"
    }));
  }

  async getStudentByUserId(userId: number): Promise<Student | undefined> {
    const [student] = await db.select().from(students).where(eq(students.userId, userId));
    return student;
  }

  async createIncome(insertIncome: InsertIncome & { recordedBy?: number, addedBy?: string }): Promise<Income> {
    const [income] = await db.insert(incomes).values({
      ...insertIncome,
      status: "Pending"
    }).returning();
    return income;
  }

  async deleteIncome(id: number): Promise<void> {
    const [income] = await db.select().from(incomes).where(eq(incomes.id, id));
    if (income && income.recordedBy && income.amount) {
      const [existing] = await db.select().from(collectionTracking).where(eq(collectionTracking.userId, income.recordedBy));
      if (existing) {
        const newTotal = Math.max(0, Number(existing.runningCollection) - Number(income.amount));
        await db.update(collectionTracking).set({ runningCollection: newTotal }).where(eq(collectionTracking.userId, income.recordedBy));
      }
    }
    await db.delete(incomes).where(eq(incomes.id, id));
  }

  async updateIncomeStatus(id: number, status: string): Promise<Income> {
    const [income] = await db.update(incomes).set({ status }).where(eq(incomes.id, id)).returning();
    if (!income) throw new Error("Payment not found");
    return income;
  }

  async getExpenses(): Promise<Expense[]> {
    return await db.select().from(expenses).orderBy(desc(expenses.date));
  }

  async createExpense(insertExpense: InsertExpense): Promise<Expense> {
    const [expense] = await db.insert(expenses).values(insertExpense).returning();
    return expense;
  }

  async deleteExpense(id: number): Promise<void> {
    await db.delete(expenses).where(eq(expenses.id, id));
  }

  async getResults(): Promise<any[]> {
    const allResults = await db.select().from(results).orderBy(desc(results.date));
    const allStudents = await this.getStudents();
    const allBatches = await this.getBatches();

    return allResults.map(res => ({
      ...res,
      student: allStudents.find(s => s.id === res.studentId),
      batch: allBatches.find(b => b.id === res.batchId)
    }));
  }

  async getResultsByStudentId(studentId: number): Promise<any[]> {
    const studentResults = await db.select().from(results).where(eq(results.studentId, studentId)).orderBy(desc(results.date));
    const allBatches = await this.getBatches();

    return studentResults.map(res => ({
      ...res,
      batch: allBatches.find(b => b.id === res.batchId)
    }));
  }

  async getModelTestResults(groupId: string, studentId: number | null): Promise<any[]> {
    const allStudents = await this.getStudents();
    const allBatches = await this.getBatches();
    const groupResults = await db.select().from(results).where(eq(results.modelTestGroupId, groupId));
    return groupResults
      .filter(r => studentId === null || r.studentId === studentId)
      .map(res => ({
        ...res,
        studentName: allStudents.find(s => s.id === res.studentId)?.name || '',
        batchName: allBatches.find(b => b.id === res.batchId)?.name || '',
      }));
  }

  async createResult(insertResult: InsertResult): Promise<Result> {
    const [result] = await db.insert(results).values(insertResult).returning();
    return result;
  }

  async updateResult(id: number, data: Partial<{ examName: string; subject: string; obtainedMarks: number; totalMarks: number }>): Promise<Result> {
    const [updated] = await db.update(results).set(data).where(eq(results.id, id)).returning();
    return updated;
  }

  async deleteResult(id: number): Promise<void> {
    await db.delete(results).where(eq(results.id, id));
  }

  async deleteResultsByGroupIdAndSubject(groupId: string, subject: string): Promise<void> {
    const { and } = await import("drizzle-orm");
    await db.delete(results).where(
      and(eq(results.modelTestGroupId, groupId), eq(results.subject, subject))
    );
  }

  async deleteResultsByExam(batchId: number, examName: string, subject?: string): Promise<number> {
    const { and } = await import("drizzle-orm");
    const conditions = [eq(results.batchId, batchId), eq(results.examName, examName)];
    if (subject) conditions.push(eq(results.subject, subject));
    const deleted = await db.delete(results).where(and(...conditions)).returning({ id: results.id });
    return deleted.length;
  }

  async saveModelTestSubjectMarks(
    groupId: string,
    entries: { studentId: number; batchId: number; examName: string; subject: string; totalMarks: number; obtainedMarks: number }[]
  ): Promise<void> {
    const { and } = await import("drizzle-orm");
    if (entries.length === 0) return;
    const { subject } = entries[0];
    await db.delete(results).where(
      and(eq(results.modelTestGroupId, groupId), eq(results.subject, subject))
    );
    await db.insert(results).values(
      entries.map((e) => ({
        studentId: e.studentId,
        batchId: e.batchId,
        examName: e.examName,
        subject: e.subject,
        totalMarks: e.totalMarks,
        obtainedMarks: e.obtainedMarks,
        isModelTest: true,
        modelTestGroupId: groupId,
      }))
    );
  }

  async getModelTestDrafts(): Promise<any[]> {
    const drafts = await db.select().from(modelTestDrafts).orderBy(desc(modelTestDrafts.createdAt));
    const allBatches = await this.getBatches();
    return drafts.map(d => ({
      ...d,
      batch: allBatches.find(b => b.id === d.batchId),
    }));
  }

  async getModelTestDraftByGroupId(groupId: string): Promise<ModelTestDraft | undefined> {
    const [draft] = await db.select().from(modelTestDrafts).where(eq(modelTestDrafts.groupId, groupId));
    return draft;
  }

  async createModelTestDraft(data: { groupId: string; examName: string; batchId: number; subjects: { name: string; totalMarks: number }[] }): Promise<ModelTestDraft> {
    const [draft] = await db.insert(modelTestDrafts).values({
      groupId: data.groupId,
      examName: data.examName,
      batchId: data.batchId,
      subjects: data.subjects,
      status: "draft",
    }).returning();
    return draft;
  }

  async publishModelTestDraft(groupId: string): Promise<ModelTestDraft> {
    const [draft] = await db.update(modelTestDrafts)
      .set({ status: "published" })
      .where(eq(modelTestDrafts.groupId, groupId))
      .returning();
    if (!draft) throw new Error("Draft not found");
    return draft;
  }

  async deleteModelTestDraft(groupId: string): Promise<void> {
    await db.delete(results).where(eq(results.modelTestGroupId, groupId));
    await db.delete(modelTestDrafts).where(eq(modelTestDrafts.groupId, groupId));
  }

  async getPublishedModelTestGroupIds(): Promise<string[]> {
    const published = await db.select({ groupId: modelTestDrafts.groupId })
      .from(modelTestDrafts)
      .where(eq(modelTestDrafts.status, "published"));
    return published.map(d => d.groupId);
  }

  async getNotifications(limit = 20): Promise<Notification[]> {
    return await db.select().from(notifications)
      .orderBy(desc(notifications.createdAt))
      .limit(limit);
  }

  async createNotification(message: string, type: string): Promise<Notification> {
    const [notif] = await db.insert(notifications).values({ message, type }).returning();
    return notif;
  }

  async markAllNotificationsRead(): Promise<void> {
    await db.update(notifications).set({ isRead: true });
  }

  async getUnreadNotificationCount(): Promise<number> {
    const { count } = await import("drizzle-orm");
    const [row] = await db.select({ count: count() }).from(notifications).where(eq(notifications.isRead, false));
    return Number(row?.count ?? 0);
  }

  async getAllSettings(): Promise<Record<string, string>> {
    const rows = await db.select().from(siteSettings);
    return Object.fromEntries(rows.map((r) => [r.key, r.value]));
  }

  async getSetting(key: string): Promise<string | undefined> {
    const [row] = await db.select().from(siteSettings).where(eq(siteSettings.key, key));
    return row?.value;
  }

  async setSetting(key: string, value: string): Promise<void> {
    await db
      .insert(siteSettings)
      .values({ key, value })
      .onConflictDoUpdate({ target: siteSettings.key, set: { value } });
  }

  async getCollectionByUserId(userId: number): Promise<CollectionTracking | undefined> {
    const [row] = await db
      .select()
      .from(collectionTracking)
      .where(eq(collectionTracking.userId, userId));
    return row;
  }

  async getAllCollections(): Promise<(CollectionTracking & { user: Omit<User, "password"> })[]> {
    const rows = await db.select().from(collectionTracking);
    const allTeachers = await db
      .select()
      .from(users)
      .where(eq(users.role, "teacher"))
      .orderBy(asc(users.id));

    // Return one entry per teacher — fall back to 0 for those with no row yet
    return allTeachers.map((teacher) => {
      const { password: _p, ...safeUser } = teacher;
      const row = rows.find((r) => r.userId === teacher.id);
      return {
        id: row?.id ?? 0,
        userId: teacher.id,
        runningCollection: row?.runningCollection ?? 0,
        lastResetAt: row?.lastResetAt ?? null,
        user: safeUser as Omit<User, "password">,
      };
    });
  }

  async addToCollection(userId: number, amount: number): Promise<CollectionTracking> {
    const [existing] = await db
      .select()
      .from(collectionTracking)
      .where(eq(collectionTracking.userId, userId));
    if (existing) {
      const newTotal = existing.runningCollection + amount;
      const [updated] = await db
        .update(collectionTracking)
        .set({ runningCollection: newTotal })
        .where(eq(collectionTracking.userId, userId))
        .returning();
      return updated;
    } else {
      const [created] = await db
        .insert(collectionTracking)
        .values({ userId, runningCollection: amount })
        .returning();
      return created;
    }
  }

  async resetCollection(userId: number): Promise<CollectionTracking> {
    const [existing] = await db
      .select()
      .from(collectionTracking)
      .where(eq(collectionTracking.userId, userId));
    if (existing) {
      const [updated] = await db
        .update(collectionTracking)
        .set({ runningCollection: 0, lastResetAt: new Date() })
        .where(eq(collectionTracking.userId, userId))
        .returning();
      return updated;
    } else {
      const [created] = await db
        .insert(collectionTracking)
        .values({ userId, runningCollection: 0, lastResetAt: new Date() })
        .returning();
      return created;
    }
  }
  // Attendance
  async upsertAttendance(data: { date: string; batchId: number; teacherId: number | null; absentStudentIds: number[]; totalStudents: number; }): Promise<Attendance> {
    const { and } = await import("drizzle-orm");
    const [existing] = await db.select().from(attendance).where(and(eq(attendance.date, data.date), eq(attendance.batchId, data.batchId)));
    if (existing) {
      const [updated] = await db.update(attendance)
        .set({ absentStudentIds: data.absentStudentIds, totalStudents: data.totalStudents, teacherId: data.teacherId ?? existing.teacherId })
        .where(eq(attendance.id, existing.id))
        .returning();
      return updated;
    }
    const [created] = await db.insert(attendance).values({
      date: data.date,
      batchId: data.batchId,
      teacherId: data.teacherId,
      absentStudentIds: data.absentStudentIds,
      totalStudents: data.totalStudents,
    }).returning();
    return created;
  }

  async getAttendanceByDate(batchId: number, date: string): Promise<Attendance | undefined> {
    const { and } = await import("drizzle-orm");
    const [row] = await db.select().from(attendance).where(and(eq(attendance.batchId, batchId), eq(attendance.date, date)));
    return row;
  }

  async getAttendanceHistory(batchId?: number): Promise<Attendance[]> {
    if (batchId) {
      return db.select().from(attendance).where(eq(attendance.batchId, batchId)).orderBy(desc(attendance.date));
    }
    return db.select().from(attendance).orderBy(desc(attendance.date));
  }

  async getAttendanceSummary(): Promise<Array<{ batchId: number; batchName: string; totalSessions: number; averageAttendance: number; lastDate: string | null }>> {
    const allBatches = await this.getBatches();
    const allAttendance = await db.select().from(attendance);
    return allBatches.map(b => {
      const sessions = allAttendance.filter(a => a.batchId === b.id);
      const totalSessions = sessions.length;
      let avg = 0;
      if (totalSessions > 0) {
        const ratios = sessions.map(s => {
          const total = s.totalStudents || 0;
          if (total === 0) return 0;
          const present = total - (s.absentStudentIds?.length || 0);
          return Math.max(0, Math.min(1, present / total));
        });
        avg = ratios.reduce((a, b) => a + b, 0) / totalSessions;
      }
      const lastDate = sessions.length > 0
        ? sessions.map(s => s.date).sort().slice(-1)[0]
        : null;
      return {
        batchId: b.id,
        batchName: b.name,
        totalSessions,
        averageAttendance: Math.round(avg * 1000) / 10, // percentage with 1 decimal
        lastDate,
      };
    });
  }
}

export const storage = new DatabaseStorage();
