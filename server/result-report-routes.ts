import type { Express } from "express";
import { z } from "zod";
import { storage } from "./storage.js";
import { rankModelTestReports, summarizeModelTest, subjectAppliesToStudent } from "../shared/result-reports.js";
import { renderTranscriptPdf, renderTabulationPdf } from "./result-pdf.js";

type ReportStorage = Pick<typeof storage,
  "getModelTestDraftByGroupId" | "getModelTestResults" | "getStudentByUserId" | "getStudent" | "getStudents" | "getBatches">;
type ReportRenderers = { transcript: typeof renderTranscriptPdf; tabulation: typeof renderTabulationPdf };
class ExportError extends Error {
  constructor(readonly status: number, message: string) { super(message); }
}

export function registerResultReportRoutes(
  app: Express,
  repository: ReportStorage = storage,
  renderers: ReportRenderers = { transcript: renderTranscriptPdf, tabulation: renderTabulationPdf },
) {
  for (const kind of ["transcript", "tabulation"] as const) {
    app.get(`/api/model-test-drafts/:groupId/${kind}.pdf`, async (req, res) => {
      res.setHeader("Cache-Control", "private, no-store");
      try {
        if (!req.isAuthenticated()) throw new ExportError(401, "Please sign in to download results.");
        const user = req.user!;
        const authority = user.role === "admin" || Boolean(user.isAuthority);
        if (kind === "tabulation" && !authority) throw new ExportError(403, "Only authority users may export a class result sheet.");
        if (kind === "transcript" && user.role !== "student" && !authority) {
          throw new ExportError(403, "You do not have permission to download this transcript.");
        }
        const query = z.object({
          studentId: z.coerce.number().int().positive().optional(),
          academicGroup: z.string().trim().min(1).max(80).optional(),
          session: z.string().trim().min(1).max(40).optional(),
        }).parse(req.query);
        const draft = await repository.getModelTestDraftByGroupId(String(req.params.groupId));
        if (!draft) throw new ExportError(404, "Model test not found.");
        if (draft.status !== "published") throw new ExportError(403, "PDF downloads are available only for published results.");
        const batches = await repository.getBatches();
        const metadata = {
          examName: draft.examName,
          className: batches.find((b) => b.id === draft.batchId)?.name ?? "—",
          session: query.session ?? String(new Date(draft.createdAt).getFullYear()),
          group: query.academicGroup ?? "All Groups",
        };
        let pdf: Buffer;
        let suffix = "";
        if (kind === "transcript") {
          const student = user.role === "student"
            ? await repository.getStudentByUserId(user.id)
            : query.studentId ? await repository.getStudent(query.studentId) : undefined;
          if (!student) throw new ExportError(authority && !query.studentId ? 400 : 404,
            authority && !query.studentId ? "Select a student for this transcript." : "Student record not found.");
          if (user.role === "student" && query.studentId && query.studentId !== student.id) {
            throw new ExportError(403, "Students can download only their own transcript.");
          }
          if (student.batchId !== draft.batchId) throw new ExportError(404, "This student is not in the exam class.");
          const results = await repository.getModelTestResults(draft.groupId, student.id);
          const report = summarizeModelTest(student, draft.subjects, results);
          if (!report.rows.length) throw new ExportError(404, "This exam has no applicable subjects for the student's group.");
          pdf = await renderers.transcript(report, metadata);
          suffix = `-${student.studentCustomId || student.id}`;
        } else {
          const [students, results] = await Promise.all([
            repository.getStudents(), repository.getModelTestResults(draft.groupId, null),
          ]);
          const roster = students.filter((student) => student.batchId === draft.batchId &&
            (student.isActive !== false || results.some((r) => r.studentId === student.id)) &&
            draft.subjects.some((subject) => subjectAppliesToStudent(subject, student)));
          const scoped = query.academicGroup
            ? roster.filter((student) => (student.academicGroup?.trim() || "General") === query.academicGroup)
            : roster;
          if (!scoped.length) throw new ExportError(404, "No students found for the selected class/group.");
          const reports = rankModelTestReports(scoped.map((student) => summarizeModelTest(student, draft.subjects, results)));
          const subjects = draft.subjects.filter((subject) => scoped.some((student) => subjectAppliesToStudent(subject, student)));
          pdf = await renderers.tabulation(reports, subjects, metadata);
        }
        const filename = `${kind}-${draft.groupId}${suffix}`.replace(/[^a-zA-Z0-9_-]/g, "_");
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `attachment; filename="${filename}.pdf"`);
        res.send(pdf);
      } catch (error) {
        if (error instanceof ExportError) return res.status(error.status).json({ message: error.message });
        if (error instanceof z.ZodError) return res.status(400).json({ message: "Invalid student, group or session selection." });
        console.error("[ModelTestPdf] Export failed", error);
        res.status(500).json({ message: "Unable to generate the result PDF. Please try again." });
      }
    });
  }
}
