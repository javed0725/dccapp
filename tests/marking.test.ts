import assert from "node:assert/strict";
import test from "node:test";
import { getSubjectMarkingRule, validateSubjectMarksEntry } from "../shared/marking";

test("all English-labeled subjects use one total field", () => {
  for (const subject of ["English 1st", "English 2nd", "english 1st paper", "English Grammar"]) {
    assert.deepEqual(getSubjectMarkingRule(subject).fields, [
      { key: "total", label: "Total Marks", max: 100 },
    ]);
  }
});

test("science subjects use the three configured component limits", () => {
  assert.deepEqual(
    getSubjectMarkingRule("Physics").fields.map(({ key, max }) => [key, max]),
    [["mcq", 25], ["cq", 50], ["practical", 25]],
  );
});

test("other subjects use MCQ 30 and CQ 70", () => {
  assert.deepEqual(
    getSubjectMarkingRule("Mathematics").fields.map(({ key, max }) => [key, max]),
    [["mcq", 30], ["cq", 70]],
  );
});

test("accepts valid component totals and rejects mismatched totals", () => {
  const valid = {
    subject: "Physics",
    totalMarks: 100,
    obtainedMarks: 90,
    mcqMarks: 20,
    cqMarks: 45,
    practicalMarks: 25,
  };
  assert.equal(validateSubjectMarksEntry(valid), null);
  assert.equal(validateSubjectMarksEntry({ ...valid, obtainedMarks: 89 }), "Total marks must equal the sum of components");
});

test("rejects marks above each subject-specific component maximum", () => {
  assert.equal(validateSubjectMarksEntry({
    subject: "Physics",
    totalMarks: 100,
    obtainedMarks: 100,
    mcqMarks: 26,
    cqMarks: 49,
    practicalMarks: 25,
  }), "MCQ Marks must be between 0 and 25");
  assert.equal(validateSubjectMarksEntry({
    subject: "Mathematics",
    totalMarks: 100,
    obtainedMarks: 101,
    mcqMarks: 30,
    cqMarks: 71,
    practicalMarks: null,
  }), "Marks must be recorded out of 100");
});

test("rejects incomplete components and English entries with a breakdown", () => {
  assert.equal(validateSubjectMarksEntry({
    subject: "Mathematics",
    totalMarks: 100,
    obtainedMarks: 30,
    mcqMarks: 30,
    cqMarks: null,
    practicalMarks: null,
  }), "Enter every mark component for a student");
  assert.equal(validateSubjectMarksEntry({
    subject: "English 1st",
    totalMarks: 100,
    obtainedMarks: 75,
    mcqMarks: 20,
    cqMarks: null,
    practicalMarks: null,
  }), "English results use total marks only");
  assert.equal(validateSubjectMarksEntry({
    subject: "Bangla",
    totalMarks: 100,
    obtainedMarks: 100,
    mcqMarks: 30,
    cqMarks: 70,
    practicalMarks: 1,
  }), "This subject does not accept that mark component");
});

test("allows absent marks and only permits unchanged legacy totals without components", () => {
  const absent = {
    subject: "Biology",
    totalMarks: 100,
    obtainedMarks: -1,
    mcqMarks: null,
    cqMarks: null,
    practicalMarks: null,
  };
  assert.equal(validateSubjectMarksEntry(absent), null);
  assert.equal(validateSubjectMarksEntry({ ...absent, practicalMarks: 0 }), "Absent results cannot include component marks");

  const legacy = {
    subject: "Mathematics",
    totalMarks: 100,
    obtainedMarks: 72,
    mcqMarks: null,
    cqMarks: null,
    practicalMarks: null,
  };
  assert.equal(validateSubjectMarksEntry(legacy), "Enter each mark component before saving");
  assert.equal(validateSubjectMarksEntry(legacy, legacy), null);
  assert.notEqual(validateSubjectMarksEntry({ ...legacy, obtainedMarks: 73 }, legacy), null);
});
