import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateModelTestStandings,
  filterModelTestRoster,
  formatModelTestTabulation,
  getModelTestDraftAcademicGroup,
  resolveModelTestGroupScope,
} from "../shared/model-test-results";
import type { ModelTestSubject } from "../shared/schema";

const subjects: ModelTestSubject[] = [
  {
    name: "Physics",
    totalMarks: 100,
    mcqEnabled: true,
    cqEnabled: true,
    practicalEnabled: true,
    mcqMax: 25,
    cqMax: 50,
    practicalMax: 25,
  },
  {
    name: "English 2nd",
    totalMarks: 50,
    mcqEnabled: false,
    cqEnabled: false,
    practicalEnabled: false,
    mcqMax: 0,
    cqMax: 0,
    practicalMax: 0,
  },
];

function mark(studentId: number, subject: string, obtainedMarks: number, components: Partial<{
  mcqMarks: number | null;
  cqMarks: number | null;
  practicalMarks: number | null;
}> = {}) {
  return {
    studentId,
    subject,
    totalMarks: subject === "English 2nd" ? 50 : 100,
    obtainedMarks,
    mcqMarks: null,
    cqMarks: null,
    practicalMarks: null,
    ...components,
  };
}

test("requires 33 percent in every configured component and total-only subject", () => {
  const standings = calculateModelTestStandings(
    subjects,
    [{ id: 1, name: "A" }, { id: 2, name: "B" }],
    [
      mark(1, "Physics", 51, { mcqMarks: 8, cqMarks: 25, practicalMarks: 18 }),
      mark(1, "English 2nd", 40),
      mark(2, "Physics", 52, { mcqMarks: 9, cqMarks: 25, practicalMarks: 18 }),
      mark(2, "English 2nd", 16),
    ],
  );

  assert.equal(standings.find((student) => student.studentId === 1)?.status, "F");
  assert.equal(standings.find((student) => student.studentId === 2)?.status, "F");
  assert.equal(standings.find((student) => student.studentId === 1)?.subjects[0].componentResults[0].passed, false);
});

test("ranks only passed students by total, gives tied totals shared competition rank", () => {
  const standings = calculateModelTestStandings(
    subjects,
    [{ id: 1, name: "First" }, { id: 2, name: "Tie" }, { id: 3, name: "Failed" }, { id: 4, name: "Next" }],
    [
      mark(1, "English 2nd", 50),
      mark(1, "Physics", 80, { mcqMarks: 25, cqMarks: 40, practicalMarks: 15 }),
      mark(2, "English 2nd", 50),
      mark(2, "Physics", 80, { mcqMarks: 25, cqMarks: 40, practicalMarks: 15 }),
      mark(3, "English 2nd", 50),
      mark(3, "Physics", 83, { mcqMarks: 8, cqMarks: 50, practicalMarks: 25 }),
      mark(4, "English 2nd", 40),
      mark(4, "Physics", 75, { mcqMarks: 25, cqMarks: 35, practicalMarks: 15 }),
    ],
  );
  const byId = new Map(standings.map((student) => [student.studentId, student]));
  assert.equal(byId.get(1)?.meritPosition, "1st");
  assert.equal(byId.get(2)?.meritPosition, "1st");
  assert.equal(byId.get(4)?.meritPosition, "3rd");
  assert.equal(byId.get(3)?.status, "F");
  assert.equal(byId.get(3)?.meritRank, null);
});

test("failed and incomplete students have no rank; group-specific subjects are dynamic", () => {
  const groupSubjects: ModelTestSubject[] = [
    { ...subjects[1], name: "English 2nd", totalMarks: 100, allGroups: true },
    {
      ...subjects[1],
      name: "Accounting",
      totalMarks: 100,
      academicGroup: "Commerce",
      allGroups: false,
    },
  ];
  const standings = calculateModelTestStandings(
    groupSubjects,
    [
      { id: 1, name: "Commerce student", academicGroup: "Commerce" },
      { id: 2, name: "Science student", academicGroup: "Science" },
      { id: 3, name: "Incomplete student", academicGroup: "Science" },
    ],
    [
      mark(1, "English 2nd", 90),
      mark(1, "Accounting", 20),
      mark(2, "English 2nd", 80),
    ],
  );

  const byId = new Map(standings.map((student) => [student.studentId, student]));
  assert.equal(byId.get(1)?.status, "F");
  assert.equal(byId.get(1)?.meritRank, null);
  assert.equal(byId.get(2)?.status, "P");
  assert.equal(byId.get(2)?.totalPossibleMarks, 100);
  assert.equal(byId.get(3)?.status, "Pending");
  assert.equal(byId.get(3)?.meritRank, null);
  assert.equal(byId.get(3)?.totalPossibleMarks, 100);
});

test("absent marks fail the subject and prevent overall merit ranking", () => {
  const standings = calculateModelTestStandings(
    [{ ...subjects[1], totalMarks: 50 }],
    [{ id: 1, name: "Absent" }],
    [mark(1, "English 2nd", -1)],
  );
  assert.equal(standings[0].status, "F");
  assert.equal(standings[0].totalMarksObtained, 0);
  assert.equal(standings[0].meritRank, null);
});

test("formats only draft subjects into grouped tabulation columns and rows", () => {
  const draftSubjects: ModelTestSubject[] = [
    subjects[0],
    {
      ...subjects[1],
      name: "English 2nd",
      totalMarks: 50,
      subjectId: 12,
    },
  ];
  const standings = calculateModelTestStandings(
    draftSubjects,
    [
      { id: 1, name: "Student One", studentCustomId: "S-001" },
      { id: 2, name: "Student Two" },
    ],
    [
      mark(1, "Physics", 80, { mcqMarks: 20, cqMarks: 40, practicalMarks: 20 }),
      mark(1, "English 2nd", 40),
      mark(2, "Physics", 75, { mcqMarks: 20, cqMarks: 40, practicalMarks: 15 }),
      mark(2, "English 2nd", 35),
    ],
  );
  const table = formatModelTestTabulation(draftSubjects, standings);

  assert.deepEqual(table.columns.map((column) => column.label), [
    "Student ID",
    "Student Name",
    "Physics",
    "English 2nd",
    "Total Marks Obtained",
    "Result Status",
    "Merit Rank",
  ]);
  assert.deepEqual(table.columns[2].children?.map(({ label }) => label), [
    "CQ",
    "MCQ",
    "Practical",
    "Total",
  ]);
  assert.deepEqual(table.columns[3].children?.map(({ label }) => label), ["Total"]);
  assert.equal(table.rows[0].studentId, "S-001");
  assert.equal(table.rows[0].subject_1_cq, 40);
  assert.equal(table.rows[0].subject_1_mcq, 20);
  assert.equal(table.rows[0].subject_1_total, 80);
  assert.equal(table.rows[0].subject_12_total, 40);
  assert.equal(table.rows[0].resultStatus, "Passed");
  assert.equal(table.rows[0].meritRank, "1st");
  assert.equal(table.rows[1].studentId, "2");
});

test("tabulation keeps group-only subject cells blank for other groups", () => {
  const draftSubjects: ModelTestSubject[] = [
    { ...subjects[1], name: "English 2nd", totalMarks: 100, allGroups: true },
    {
      ...subjects[1],
      name: "Accounting",
      totalMarks: 100,
      academicGroup: "Commerce",
      allGroups: false,
      subjectId: 25,
    },
  ];
  const standings = calculateModelTestStandings(
    draftSubjects,
    [{ id: 2, name: "Science Student", academicGroup: "Science" }],
    [mark(2, "English 2nd", 80)],
  );
  const table = formatModelTestTabulation(draftSubjects, standings);
  assert.equal(table.columns[3].label, "Accounting");
  assert.equal(table.rows[0].subject_25_total, null);
});

test("group-scoped tabulation includes only that group's students and subjects", () => {
  const mixedSubjects: ModelTestSubject[] = [
    {
      ...subjects[1],
      name: "English 2nd",
      totalMarks: 100,
      allGroups: true,
      draftAcademicGroup: "Arts",
    },
    {
      ...subjects[1],
      name: "History",
      totalMarks: 100,
      academicGroup: "Arts",
      allGroups: false,
      draftAcademicGroup: "Arts",
    },
    {
      ...subjects[1],
      name: "Physics",
      totalMarks: 100,
      academicGroup: "Science",
      allGroups: false,
      draftAcademicGroup: "Arts",
    },
  ];
  const scope = resolveModelTestGroupScope(mixedSubjects);
  assert.equal(scope.academicGroup, "Arts");
  assert.deepEqual(scope.subjects.map((subject) => subject.name), ["English 2nd", "History"]);

  const roster = filterModelTestRoster([
    { id: 1, name: "Arts student", batchId: 9, academicGroup: "Arts" },
    { id: 2, name: "Science student", batchId: 9, academicGroup: "Science" },
    { id: 3, name: "Other class student", batchId: 10, academicGroup: "Arts" },
  ], 9, scope.academicGroup);
  assert.deepEqual(roster.map((student) => student.id), [1]);

  const standings = calculateModelTestStandings(
    scope.subjects,
    roster,
    [
      mark(1, "English 2nd", 80),
      mark(1, "History", 70),
      mark(2, "English 2nd", 99),
      mark(2, "Physics", 99),
    ],
  );
  const table = formatModelTestTabulation(scope.subjects, standings);
  assert.deepEqual(table.columns.map((column) => column.label), [
    "Student ID",
    "Student Name",
    "English 2nd",
    "History",
    "Total Marks Obtained",
    "Result Status",
    "Merit Rank",
  ]);
  assert.deepEqual(table.rows.map((row) => row.studentName), ["Arts student"]);
});

test("common-only drafts retain their selected group and legacy drafts infer one group", () => {
  const commonOnly: ModelTestSubject[] = [{
    ...subjects[1],
    name: "Mathematics",
    totalMarks: 100,
    allGroups: true,
    draftAcademicGroup: "Commerce",
  }];
  assert.equal(getModelTestDraftAcademicGroup(commonOnly), "Commerce");
  assert.equal(resolveModelTestGroupScope(commonOnly).academicGroup, "Commerce");
  assert.deepEqual(filterModelTestRoster([
    { id: 1, name: "Commerce student", batchId: 9, academicGroup: "Commerce" },
    { id: 2, name: "Arts student", batchId: 9, academicGroup: "Arts" },
  ], 9, resolveModelTestGroupScope(commonOnly).academicGroup).map((student) => student.id), [1]);

  const legacy: ModelTestSubject[] = [{
    ...subjects[1],
    name: "Accounting",
    academicGroup: "Commerce",
    allGroups: false,
  }];
  assert.equal(getModelTestDraftAcademicGroup(legacy), "Commerce");
  assert.deepEqual(resolveModelTestGroupScope(legacy).subjects.map((subject) => subject.name), ["Accounting"]);
});

test("legacy drafts with multiple group mappings require an explicit group", () => {
  const mixedLegacySubjects: ModelTestSubject[] = [
    { ...subjects[1], name: "History", academicGroup: "Arts", allGroups: false },
    { ...subjects[1], name: "Physics", academicGroup: "Science", allGroups: false },
    { ...subjects[1], name: "English 2nd", allGroups: true },
  ];
  assert.equal(resolveModelTestGroupScope(mixedLegacySubjects).groupRequired, true);
  const artsScope = resolveModelTestGroupScope(mixedLegacySubjects, "Arts");
  assert.equal(artsScope.error, null);
  assert.deepEqual(artsScope.subjects.map((subject) => subject.name), ["History", "English 2nd"]);
});
