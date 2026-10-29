import type { Express } from "express";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "./db";
import { storage } from "./storage";
import { scanOmrSheet } from "./omr-scanner";
import {
  omrConfigs,
  omrScanResults,
  results as resultsTable,
  type OmrAnswer,
  type OmrAnswerKeys,
  type OmrResponse,
  type OmrSetCode,
} from "@shared/schema";

const setCodeSchema = z.enum(["ক", "খ", "গ", "ঘ"]);
const answerSchema = z.enum(["A", "B", "C", "D"]);
const answerKeysSchema = z.object({
  "ক": z.array(answerSchema),
  "খ": z.array(answerSchema),
  "গ": z.array(answerSchema),
  "ঘ": z.array(answerSchema),
});

const createConfigSchema = z.object({
  batchId: z.coerce.number().int().positive(),
  examName: z.string().trim().min(1).max(120),
  subject: z.string().trim().min(1).max(80),
  questionCount: z.coerce.number().int().min(1).max(30),
  answerKeys: answerKeysSchema,
}).superRefine((value, ctx) => {
  for (const setCode of ["ক", "খ", "গ", "ঘ"] as const) {
    if (value.answerKeys[setCode].length !== value.questionCount) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["answerKeys", setCode],
        message: `Set ${setCode} must have exactly ${value.questionCount} answers.`,
      });
    }
  }
});

const scanRequestSchema = z.object({
  configId: z.coerce.number().int().positive(),
  imageData: z.string().min(32).max(5_200_000),
});

const saveRequestSchema = scanRequestSchema.extend({
  studentId: z.coerce.number().int().positive(),
});

function requireOmrAccess(req: any, res: any): boolean {
  if (!req.isAuthenticated?.()) {
    res.status(401).json({ message: "Your session has expired. Please log in again." });
    return false;
  }
  if (!["teacher", "admin"].includes((req.user as any)?.role)) {
    res.status(403).json({ message: "Only teachers can use the OMR scanner." });
    return false;
  }
  return true;
}

async function getAccessibleConfig(configId: number, user: any) {
  const conditions = [eq(omrConfigs.id, configId)];
  if (user.role !== "admin") {
    conditions.push(eq(omrConfigs.createdByUserId, user.id));
  }
  const [config] = await db.select().from(omrConfigs).where(and(...conditions)).limit(1);
  return config;
}

function calculateGrade(responses: OmrResponse[], answerKey: OmrAnswer[]) {
  if (responses.length !== answerKey.length) {
    throw new Error("The configured answer key does not match the question count.");
  }
  let correct = 0;
  let wrong = 0;
  let unattempted = 0;
  for (const response of responses) {
    if (response.status === "blank") {
      unattempted++;
    } else if (response.status === "valid" && response.selected === answerKey[response.question - 1]) {
      correct++;
    } else {
      // Multiple and ambiguous marks are intentionally treated as wrong.
      wrong++;
    }
  }
  return {
    correct,
    wrong,
    unattempted,
    obtainedMarks: correct,
    totalMarks: answerKey.length,
  };
}

function scanWithKey(scan: Awaited<ReturnType<typeof scanOmrSheet>>, keys: OmrAnswerKeys) {
  const setCode = scan.setCode as OmrSetCode | null;
  if (!setCode) throw new Error("The set-code bubbles could not be read.");
  const answerKey = keys[setCode];
  if (!Array.isArray(answerKey)) {
    throw new Error(`No answer key is configured for set ${setCode}.`);
  }
  return { ...scan, grading: calculateGrade(scan.responses, answerKey) };
}

function safeMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

export function registerOmrRoutes(app: Express) {
  app.get("/api/omr/configs", async (req, res) => {
    if (!requireOmrAccess(req, res)) return;
    const batchId = Number(req.query.batchId);
    if (!Number.isInteger(batchId) || batchId <= 0) {
      return res.status(400).json({ message: "Select a valid batch." });
    }

    const user = req.user as any;
    const conditions = [eq(omrConfigs.batchId, batchId)];
    if (user.role !== "admin") {
      conditions.push(eq(omrConfigs.createdByUserId, user.id));
    }
    const configs = await db
      .select()
      .from(omrConfigs)
      .where(and(...conditions))
      .orderBy(desc(omrConfigs.createdAt));
    res.json(configs);
  });

  app.post("/api/omr/configs", async (req, res) => {
    if (!requireOmrAccess(req, res)) return;
    const parsed = createConfigSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.issues[0]?.message ?? "Check the exam and answer key." });
    }

    const input = parsed.data;
    const batch = (await storage.getBatches()).find((item) => item.id === input.batchId);
    if (!batch) return res.status(404).json({ message: "The selected batch was not found." });

    const user = req.user as any;
    const values = {
      ...input,
      answerKeys: input.answerKeys as OmrAnswerKeys,
      createdByUserId: user.id,
    };
    const [config] = await db
      .insert(omrConfigs)
      .values(values)
      .onConflictDoUpdate({
        target: [
          omrConfigs.createdByUserId,
          omrConfigs.batchId,
          omrConfigs.examName,
          omrConfigs.subject,
        ],
        set: {
          questionCount: input.questionCount,
          answerKeys: input.answerKeys as OmrAnswerKeys,
          createdAt: new Date(),
        },
      })
      .returning();
    res.status(201).json(config);
  });

  app.post("/api/omr/scan", async (req, res) => {
    if (!requireOmrAccess(req, res)) return;
    const parsed = scanRequestSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Choose an exam and upload a supported image." });

    try {
      const config = await getAccessibleConfig(parsed.data.configId, req.user);
      if (!config) return res.status(404).json({ message: "The selected exam configuration was not found." });
      const scan = await scanOmrSheet(parsed.data.imageData, config.questionCount);
      const result = scanWithKey(scan, config.answerKeys);
      res.json(result);
    } catch (error) {
      res.status(422).json({ message: safeMessage(error, "The sheet could not be read. Check the image and try again.") });
    }
  });

  app.post("/api/omr/save", async (req, res) => {
    if (!requireOmrAccess(req, res)) return;
    const parsed = saveRequestSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Choose an exam, student, and sheet image." });

    try {
      const { configId, imageData, studentId } = parsed.data;
      const config = await getAccessibleConfig(configId, req.user);
      if (!config) return res.status(404).json({ message: "The selected exam configuration was not found." });

      const student = await storage.getStudent(studentId);
      if (!student || student.batchId !== config.batchId || student.isActive === false) {
        return res.status(400).json({ message: "The selected student is not active in this exam's batch." });
      }

      // Reprocess the original image on confirmation so saved marks always
      // come from the server's OpenCV result, never from editable browser data.
      const scan = await scanOmrSheet(imageData, config.questionCount);
      const evaluated = scanWithKey(scan, config.answerKeys);
      if (!evaluated.setCode) {
        return res.status(422).json({ message: "The set code must be detected before saving." });
      }

      const user = req.user as any;
      let resultId = 0;
      await db.transaction(async (tx) => {
        const [existingScan] = await tx
          .select()
          .from(omrScanResults)
          .where(and(
            eq(omrScanResults.configId, configId),
            eq(omrScanResults.studentId, studentId),
          ))
          .limit(1);

        if (existingScan) {
          const [updated] = await tx
            .update(resultsTable)
            .set({
              totalMarks: evaluated.grading.totalMarks,
              obtainedMarks: evaluated.grading.obtainedMarks,
              date: new Date(),
            })
            .where(eq(resultsTable.id, existingScan.resultId))
            .returning({ id: resultsTable.id });
          if (!updated) throw new Error("The previous OMR result could not be updated.");
          resultId = updated.id;
          await tx.delete(omrScanResults).where(eq(omrScanResults.id, existingScan.id));
        } else {
          const [created] = await tx
            .insert(resultsTable)
            .values({
              studentId,
              batchId: config.batchId,
              subject: config.subject,
              examName: config.examName,
              totalMarks: evaluated.grading.totalMarks,
              obtainedMarks: evaluated.grading.obtainedMarks,
              isModelTest: false,
              modelTestGroupId: null,
            })
            .returning({ id: resultsTable.id });
          resultId = created.id;
        }

        await tx.insert(omrScanResults).values({
          resultId,
          configId,
          studentId,
          rollNumber: evaluated.rollNumber ?? "",
          setCode: evaluated.setCode!,
          correctAnswers: evaluated.grading.correct,
          wrongAnswers: evaluated.grading.wrong,
          unattempted: evaluated.grading.unattempted,
          responses: evaluated.responses,
          scannedByUserId: user.id,
        });
      });

      res.status(201).json({
        saved: true,
        resultId,
        studentId,
        obtainedMarks: evaluated.grading.obtainedMarks,
        totalMarks: evaluated.grading.totalMarks,
      });
    } catch (error) {
      res.status(422).json({ message: safeMessage(error, "The result could not be saved. Recheck the sheet and try again.") });
    }
  });
}
