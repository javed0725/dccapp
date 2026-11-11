import { test } from "node:test";
import assert from "node:assert/strict";
import { getBangladeshGrade, summarizeModelTest, rankModelTestReports, ordinal } from "../shared/result-reports.js";
import { renderTranscriptPdf, renderTabulationPdf } from "../server/result-pdf.js";

const student = { id: 1, name: "পরীক্ষার্থী Student", studentCustomId: "101", batchId: 9, academicGroup: "Science" };
const subjects = [
  { name: "English 2nd", totalMarks: 50, allGroups: true },
  { name: "Physics", totalMarks: 100, academicGroup: "Science", cqEnabled: true, mcqEnabled: true, practicalEnabled: true },
  { name: "Accounting", totalMarks: 100, academicGroup: "Commerce" },
];
const results = [
  { id: 1, studentId: 1, batchId: 9, subject: "English 2nd", totalMarks: 50, obtainedMarks: 40 },
  { id: 2, studentId: 1, batchId: 9, subject: "Physics", totalMarks: 100, obtainedMarks: 85, cqMarks: 45, mcqMarks: 20, practicalMarks: 20 },
];

test("Bangladesh grade boundaries normalize custom subject maxima", () => {
  for (const [marks, grade, gp] of [[80, "A+", 5], [79, "A", 4], [70, "A", 4], [69, "A-", 3.5],
    [60, "A-", 3.5], [59, "B", 3], [50, "B", 3], [49, "C", 2], [40, "C", 2],
    [39, "D", 1], [33, "D", 1], [32, "F", 0], [0, "F", 0]] as const) {
    assert.deepEqual(getBangladeshGrade(marks, 100), { grade, gp });
  }
  assert.deepEqual(getBangladeshGrade(40, 50), { grade: "A+", gp: 5 });
  assert.equal(getBangladeshGrade(-1, 100).grade, "ABS");
  assert.equal(getBangladeshGrade(101, 100).grade, "INC");
  assert.equal(getBangladeshGrade(0, 0).grade, "INC");
});

test("GPA includes only applicable compulsory subjects and handles failure, absence and missing marks", () => {
  const report = summarizeModelTest(student, subjects, results);
  assert.equal(report.rows.length, 2);
  assert.equal(report.gpa, 5);
  assert.equal(report.obtainedMarks, 125);
  assert.equal(report.totalMarks, 150);
  assert.equal(report.grade, "A+");
  assert.equal(summarizeModelTest(student, subjects, [{ ...results[0], obtainedMarks: 10 }, results[1]]).gpa, 0);
  const absent = summarizeModelTest(student, subjects, [{ ...results[0], obtainedMarks: -1 }, results[1]]);
  assert.equal(absent.gpa, 0);
  assert.equal(absent.status, "Absent");
  assert.equal(absent.totalMarks, 150);
  assert.equal(summarizeModelTest(student, subjects, results.slice(0, 1)).status, "Incomplete");
  assert.equal(summarizeModelTest(student, subjects, [{ ...results[0], totalMarks: 100 }, results[1]]).status, "Incomplete");
});

test("Merit ordering uses GPA then total, shared competition ranks and stable roll ordering", () => {
  const create = (id: number, english: number, physics: number) => summarizeModelTest(
    { ...student, id, studentCustomId: String(id) }, subjects,
    results.map((r, i) => ({ ...r, studentId: id, obtainedMarks: i === 0 ? english : physics })),
  );
  const ranked = rankModelTestReports([create(5, 40, 80), create(3, 40, 85), create(2, 40, 85),
    create(1, 0, 100), create(4, 35, 90)]);
  assert.deepEqual(ranked.map((r) => r.student.id), [2, 3, 5, 4, 1]);
  assert.deepEqual(ranked.map((r) => r.position), [1, 1, 3, 4, null]);
  assert.equal(ordinal(11), "11th");
  assert.equal(ordinal(22), "22nd");
  assert.equal(ordinal(103), "103rd");
});

test("PDF renderer creates real transcript and landscape multiband tabulation documents", async () => {
  const report = summarizeModelTest(student, subjects, results);
  const meta = { examName: "Model Test 2026", className: "Class 9", session: "2026", group: "Science" };
  const transcript = await renderTranscriptPdf(report, meta);
  assert.equal(transcript.subarray(0, 5).toString(), "%PDF-");
  assert.ok(transcript.length > 10000);
  const bandSubjects = Array.from({ length: 9 }, (_, i) => ({ name: `Subject ${i + 1}`, totalMarks: 100 }));
  const bandReport = summarizeModelTest(student, bandSubjects, bandSubjects.map((s) =>
    ({ studentId: 1, subject: s.name, totalMarks: 100, obtainedMarks: 80 })));
  const tabulation = await renderTabulationPdf(rankModelTestReports([bandReport]), bandSubjects, meta);
  assert.equal(tabulation.subarray(0, 5).toString(), "%PDF-");
  assert.ok(tabulation.toString("latin1").includes("/Count 3"));
});
