import { pgTable, text, serial, integer, timestamp, boolean, json, decimal } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  role: text("role").notNull().default("teacher"),
  teacherId: text("teacher_id").unique(),
  mobileNumber: text("mobile_number"),
  name: text("name"),
  subject: text("subject"),
  imageUrl: text("image_url"),
});

export const batches = pgTable("batches", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
});

export const students = pgTable("students", {
  id: serial("id").primaryKey(),
  studentCustomId: text("student_custom_id").unique(),
  name: text("name").notNull(),
  batchId: integer("batch_id").references(() => batches.id).notNull(),
  mobileNumber: text("mobile_number"),
  shift: text("shift"),
  academicGroup: text("academic_group"),
  userId: integer("user_id").references(() => users.id),
  addedByUserId: integer("added_by_user_id").references(() => users.id),
  admissionDate: timestamp("admission_date").defaultNow(),
});

export const incomes = pgTable("incomes", {
  id: serial("id").primaryKey(),
  studentId: integer("student_id").references(() => students.id).notNull(),
  batchId: integer("batch_id").references(() => batches.id).notNull(),
  month: text("month").notNull(),
  amount: integer("amount").notNull(),
  date: timestamp("date").defaultNow().notNull(),
  recordedBy: integer("recorded_by").references(() => users.id),
  status: text("status").notNull().default("Pending"),
  addedBy: text("added_by"),
});

export const expenses = pgTable("expenses", {
  id: serial("id").primaryKey(),
  description: text("description").notNull(),
  amount: integer("amount").notNull(),
  month: text("month").notNull().default(""),
  date: timestamp("date").defaultNow().notNull(),
});

export const results = pgTable("results", {
  id: serial("id").primaryKey(),
  studentId: integer("student_id").references(() => students.id).notNull(),
  batchId: integer("batch_id").references(() => batches.id).notNull(),
  subject: text("subject").notNull(),
  examName: text("exam_name").notNull(),
  totalMarks: integer("total_marks").notNull(),
  obtainedMarks: integer("obtained_marks").notNull(),
  isModelTest: boolean("is_model_test").notNull().default(false),
  modelTestGroupId: text("model_test_group_id"),
  date: timestamp("date").defaultNow().notNull(),
});

export const modelTestDrafts = pgTable("model_test_drafts", {
  id: serial("id").primaryKey(),
  groupId: text("group_id").notNull().unique(),
  examName: text("exam_name").notNull(),
  batchId: integer("batch_id").references(() => batches.id).notNull(),
  subjects: json("subjects").notNull().$type<{ name: string; totalMarks: number }[]>(),
  status: text("status").notNull().default("draft"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  message: text("message").notNull(),
  type: text("type").notNull(), // "admission" | "payment" | "result"
  isRead: boolean("is_read").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const siteSettings = pgTable("site_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

export const attendance = pgTable("attendance", {
  id: serial("id").primaryKey(),
  date: text("date").notNull(), // YYYY-MM-DD
  batchId: integer("batch_id").references(() => batches.id).notNull(),
  teacherId: integer("teacher_id").references(() => users.id),
  subject: text("subject").notNull().default(""),
  academicGroup: text("academic_group").notNull().default(""),
  shift: text("shift").notNull().default(""),
  absentStudentIds: integer("absent_student_ids").array().notNull().default([]),
  totalStudents: integer("total_students").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const collectionTracking = pgTable("collection_tracking", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull().unique(),
  runningCollection: integer("running_collection").notNull().default(0),
  lastResetAt: timestamp("last_reset_at").defaultNow(),
});

export type ModelTestDraft = typeof modelTestDrafts.$inferSelect;
export type InsertModelTestDraft = typeof modelTestDrafts.$inferInsert;
export type Notification = typeof notifications.$inferSelect;
export type CollectionTracking = typeof collectionTracking.$inferSelect;

export const insertUserSchema = createInsertSchema(users).omit({ id: true });
export const insertBatchSchema = createInsertSchema(batches).omit({ id: true });
export const insertStudentSchema = createInsertSchema(students).omit({ id: true, userId: true, addedByUserId: true, admissionDate: true }).extend({
  mobileNumber: z.string().optional().nullable(),
  studentCustomId: z.string().optional().nullable(),
});
export const insertIncomeSchema = createInsertSchema(incomes).omit({ 
  id: true, 
  date: true,
  recordedBy: true,
  status: true
});

export const insertExpenseSchema = createInsertSchema(expenses).omit({ 
  id: true, 
  date: true 
});

export const insertResultSchema = createInsertSchema(results).omit({ 
  id: true, 
  date: true 
});

export type User = typeof users.$inferSelect;
export type Batch = typeof batches.$inferSelect;
export type Student = typeof students.$inferSelect;
export type Income = typeof incomes.$inferSelect;
export type Expense = typeof expenses.$inferSelect;
export type Result = typeof results.$inferSelect;
export type Attendance = typeof attendance.$inferSelect;
export type InsertAttendance = typeof attendance.$inferInsert;

export type InsertUser = z.infer<typeof insertUserSchema>;
export type InsertBatch = z.infer<typeof insertBatchSchema>;
export type InsertStudent = z.infer<typeof insertStudentSchema>;
export type InsertIncome = z.infer<typeof insertIncomeSchema>;
export type InsertExpense = z.infer<typeof insertExpenseSchema>;
export type InsertResult = z.infer<typeof insertResultSchema>;
