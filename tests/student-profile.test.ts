import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateStudentGpa,
  getStudentGrade,
  getStudentMonthIndex,
  groupStudentExamResults,
  STUDENT_PROFILE_MONTHS,
} from "../shared/student-profile";

test("exposes a complete January-to-December fee calendar and recognizes month names", () => {
  assert.equal(STUDENT_PROFILE_MONTHS.length, 12);
  assert.equal(STUDENT_PROFILE_MONTHS[0], "January");
  assert.equal(STUDENT_PROFILE_MONTHS[11], "December");
  assert.equal(getStudentMonthIndex("Jan"), 0);
  assert.equal(getStudentMonthIndex("january"), 0);
  assert.equal(getStudentMonthIndex("12"), 11);
  assert.equal(getStudentMonthIndex("not a month"), -1);
});

test("matches the existing grade scale and excludes absences from GPA", () => {
  assert.deepEqual(getStudentGrade(80, 100), { grade: "A+", point: 5 });
  assert.deepEqual(getStudentGrade(33, 100), { grade: "D", point: 1 });
  assert.deepEqual(getStudentGrade(32, 100), { grade: "F", point: 0 });
  assert.deepEqual(getStudentGrade(-1, 100), { grade: "ABS", point: null });
  assert.equal(calculateStudentGpa([
    { obtainedMarks: 80, totalMarks: 100 },
    { obtainedMarks: 70, totalMarks: 100 },
    { obtainedMarks: -1, totalMarks: 100 },
  ]), 4.5);
  assert.equal(calculateStudentGpa([{ obtainedMarks: -1, totalMarks: 100 }]), null);
});

test("groups subjects into exams despite separate save timestamps", () => {
  const results = [
    {
      id: 1, examName: "Half Yearly", date: "2026-06-01T09:00:00.000Z", batchId: 9,
      isModelTest: false, modelTestGroupId: null, obtainedMarks: 75, totalMarks: 100,
    },
    {
      id: 2, examName: "Half Yearly", date: "2026-06-02T09:00:00.000Z", batchId: 9,
      isModelTest: false, modelTestGroupId: null, obtainedMarks: 82, totalMarks: 100,
    },
    {
      id: 3, examName: "Half Yearly", date: "2025-06-02T09:00:00.000Z", batchId: 9,
      isModelTest: false, modelTestGroupId: null, obtainedMarks: 82, totalMarks: 100,
    },
    {
      id: 4, examName: "Practice Test", date: "2026-06-03T09:00:00.000Z", batchId: 9,
      isModelTest: true, modelTestGroupId: "draft-a", obtainedMarks: 82, totalMarks: 100,
    },
    {
      id: 5, examName: "Practice Test", date: "2026-06-03T09:01:00.000Z", batchId: 9,
      isModelTest: true, modelTestGroupId: "draft-b", obtainedMarks: 82, totalMarks: 100,
    },
  ];

  const groups = groupStudentExamResults(results);
  assert.equal(groups.length, 4);
  assert.equal(groups.find((group) => group.results.some((result) => result.id === 1))?.results.length, 2);
  assert.equal(groups.find((group) => group.results.some((result) => result.id === 1))?.results[0].id, 2);
  assert.equal(groups.find((group) => group.results.some((result) => result.id === 4))?.results.length, 1);
  assert.equal(groups.find((group) => group.results.some((result) => result.id === 5))?.results.length, 1);
});
