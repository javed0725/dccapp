import { z } from "zod";

// Type definitions for data objects
export interface User {
  id: number;
  username: string;
  role: "admin" | "teacher" | "student" | "deactivated";
  teacherId: string | null;
  mobileNumber: string | null;
  name: string | null;
  subject: string | null;
  imageUrl: string | null;
  isAuthority: boolean;
}

export interface Batch {
  id: number;
  name: string;
}

export interface Student {
  id: number;
  studentCustomId: string | null;
  name: string;
  batchId: number;
  mobileNumber: string | null;
  shift: string | null;
  academicGroup: string | null;
  userId: number | null;
}

export interface Income {
  id: number;
  studentId: number;
  batchId: number;
  month: string;
  amount: number;
  date: string;
  recordedBy: number | null;
  status: string;
  addedBy: string | null;
}

export interface Expense {
  id: number;
  description: string;
  amount: number;
  month: string;
  date: string;
}

export interface Result {
  id: number;
  studentId: number;
  batchId: number;
  subject: string;
  examName: string;
  totalMarks: number;
  obtainedMarks: number;
  isModelTest: boolean;
  modelTestGroupId: string | null;
  date: string;
}

// Zod validation schemas (client-safe, no Drizzle dependency)
export const insertBatchSchema = z.object({
  name: z.string().min(1, "Batch name is required"),
});

export const insertStudentSchema = z.object({
  name: z.string().min(1, "Student name is required"),
  batchId: z.coerce.number(),
  mobileNumber: z.string().optional().nullable(),
  studentCustomId: z.string().optional().nullable(),
  shift: z.string().optional(),
  academicGroup: z.string().optional(),
});

export const insertIncomeSchema = z.object({
  studentId: z.coerce.number(),
  batchId: z.coerce.number(),
  month: z.string().min(1, "Month is required"),
  amount: z.coerce.number(),
});

export const insertExpenseSchema = z.object({
  description: z.string().min(1, "Description is required"),
  amount: z.coerce.number(),
  month: z.string().optional(),
});

export const insertResultSchema = z.object({
  studentId: z.coerce.number(),
  batchId: z.coerce.number(),
  subject: z.string().min(1, "Subject is required"),
  examName: z.string().min(1, "Exam name is required"),
  totalMarks: z.coerce.number().min(1),
  obtainedMarks: z.coerce.number().min(0),
  isModelTest: z.boolean().optional().default(false),
  modelTestGroupId: z.string().optional().nullable(),
});

export type InsertBatch = z.infer<typeof insertBatchSchema>;
export type InsertStudent = z.infer<typeof insertStudentSchema>;
export type InsertIncome = z.infer<typeof insertIncomeSchema>;
export type InsertExpense = z.infer<typeof insertExpenseSchema>;
export type InsertResult = z.infer<typeof insertResultSchema>;
