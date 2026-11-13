import assert from "node:assert/strict";
import test from "node:test";
import { getStudentMarksheetData } from "../shared/student-marksheet";

test("builds A5 marksheet rows using only the components configured for the exam", () => {
  const marksheet = getStudentMarksheetData([
    {
      subject: "Physics",
      obtainedMarks: 77,
      totalMarks: 100,
      mcqMarks: 20,
      cqMarks: 37,
      practicalMarks: 20,
      markingConfig: {
        mcqEnabled: true,
        cqEnabled: true,
        practicalEnabled: true,
        mcqMax: 25,
        cqMax: 50,
        practicalMax: 25,
      },
    },
    {
      subject: "English 2nd",
      obtainedMarks: 42,
      totalMarks: 50,
      mcqMarks: null,
      cqMarks: null,
      practicalMarks: null,
      markingConfig: { totalMarks: 50 },
    },
  ]);

  assert.deepEqual(marksheet.componentColumns, ["cq", "mcq", "practical"]);
  assert.equal(marksheet.rows[0].grade, "A");
  assert.equal(marksheet.rows[0].passed, true);
  assert.equal(marksheet.rows[1].grade, "A+");
  assert.equal(marksheet.totalObtained, 119);
  assert.equal(marksheet.totalFull, 150);
  assert.equal(marksheet.gpa, 4.5);
  assert.equal(marksheet.passed, true);
});

test("fails a subject when any configured component is below the 33 percent threshold", () => {
  const marksheet = getStudentMarksheetData([
    {
      subject: "Mathematics",
      obtainedMarks: 40,
      totalMarks: 100,
      mcqMarks: 8,
      cqMarks: 32,
      markingConfig: {
        mcqEnabled: true,
        cqEnabled: true,
        mcqMax: 30,
        cqMax: 70,
      },
    },
  ]);

  assert.equal(marksheet.rows[0].grade, "C");
  assert.equal(marksheet.rows[0].passed, false);
  assert.equal(marksheet.passed, false);
});

test("shows absent subjects as failed and excludes absent marks from totals and GPA", () => {
  const marksheet = getStudentMarksheetData([
    { subject: "Science", obtainedMarks: -1, totalMarks: 100 },
    { subject: "English", obtainedMarks: 80, totalMarks: 100 },
  ]);

  assert.equal(marksheet.rows[0].grade, "ABS");
  assert.equal(marksheet.passed, false);
  assert.equal(marksheet.totalObtained, 80);
  assert.equal(marksheet.totalFull, 100);
  assert.equal(marksheet.gpa, 5);
});
