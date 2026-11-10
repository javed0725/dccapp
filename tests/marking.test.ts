import assert from "node:assert/strict";
import test from "node:test";
import { getSubjectMarkingRule, isCommonCoreSubject, validateSubjectMarksEntry } from "../shared/marking";

test("common subjects can be shared across groups without sharing group-only subjects", () => {
  assert.equal(isCommonCoreSubject("English 1st"), true);
  assert.equal(isCommonCoreSubject("English 2nd Paper"), true);
  assert.equal(isCommonCoreSubject("Mathematics"), true);
  assert.equal(isCommonCoreSubject("Physics"), false);
  assert.equal(isCommonCoreSubject("Higher Math"), false);
});

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

test("configured draft subjects use selected components and saved maxima", () => {
  const custom = {
    mcqEnabled: true,
    cqEnabled: false,
    practicalEnabled: true,
    mcqMax: 60,
    cqMax: 0,
    practicalMax: 40,
  };
  assert.deepEqual(
    getSubjectMarkingRule("Custom Science", custom).fields.map(({ key, max }) => [key, max]),
    [["mcq", 60], ["practical", 40]],
  );
  assert.deepEqual(
    getSubjectMarkingRule("Physics", {
      mcqEnabled: false,
      cqEnabled: false,
      practicalEnabled: false,
      mcqMax: 0,
      cqMax: 0,
      practicalMax: 0,
    }).fields,
    [{ key: "total", label: "Total Marks", max: 100 }],
  );
});

test("supports class-specific total-only marks out of 50", () => {
  const config = {
    totalMarks: 50,
    mcqEnabled: false,
    cqEnabled: false,
    practicalEnabled: false,
  };
  assert.deepEqual(getSubjectMarkingRule("English 2nd", config), {
    fields: [{ key: "total", label: "Total Marks", max: 50 }],
    total: 50,
  });
  assert.equal(validateSubjectMarksEntry({
    subject: "English 2nd",
    totalMarks: 50,
    obtainedMarks: 48,
    mcqMarks: null,
    cqMarks: null,
    practicalMarks: null,
  }, undefined, config), null);
});

test("validates configured component totals and individual limits", () => {
  const config = {
    mcqEnabled: true,
    cqEnabled: false,
    practicalEnabled: true,
    mcqMax: 60,
    cqMax: 0,
    practicalMax: 40,
  };
  assert.equal(validateSubjectMarksEntry({
    subject: "Custom Science",
    totalMarks: 100,
    obtainedMarks: 90,
    mcqMarks: 55,
    cqMarks: null,
    practicalMarks: 35,
  }, undefined, config), null);
  assert.equal(validateSubjectMarksEntry({
    subject: "Custom Science",
    totalMarks: 100,
    obtainedMarks: 90,
    mcqMarks: 61,
    cqMarks: null,
    practicalMarks: 29,
  }, undefined, config), "MCQ Marks must be between 0 and 60");
  assert.equal(validateSubjectMarksEntry({
    subject: "Custom Science",
    totalMarks: 100,
    obtainedMarks: 91,
    mcqMarks: 55,
    cqMarks: null,
    practicalMarks: 35,
  }, undefined, config), "Total marks must equal the sum of components");
});

test("validates component totals against a custom class-specific total", () => {
  const config = {
    totalMarks: 50,
    mcqEnabled: true,
    cqEnabled: true,
    practicalEnabled: false,
    mcqMax: 15,
    cqMax: 35,
    practicalMax: 0,
  };
  assert.equal(validateSubjectMarksEntry({
    subject: "Bangla",
    totalMarks: 50,
    obtainedMarks: 47,
    mcqMarks: 14,
    cqMarks: 33,
    practicalMarks: null,
  }, undefined, config), null);
  assert.equal(validateSubjectMarksEntry({
    subject: "Bangla",
    totalMarks: 50,
    obtainedMarks: 51,
    mcqMarks: 15,
    cqMarks: 36,
    practicalMarks: null,
  }, undefined, config), "Marks must be recorded out of 50");
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
  }), "This subject uses total marks only");
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
