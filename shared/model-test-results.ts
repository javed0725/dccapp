import type { ModelTestSubject } from "./schema.js";
import { getSubjectMarkingRule } from "./marking.js";

export type ModelTestRosterStudent = {
  id: number;
  name: string;
  academicGroup?: string | null;
  studentCustomId?: string | null;
};

export type ModelTestMark = {
  studentId: number;
  subject: string;
  totalMarks: number;
  obtainedMarks: number;
  mcqMarks: number | null;
  cqMarks: number | null;
  practicalMarks: number | null;
  [key: string]: unknown;
};

export type SubjectStanding = {
  subject: string;
  status: "P" | "F" | "Pending";
  obtainedMarks: number | null;
  totalMarks: number;
  componentResults: Array<{
    component: string;
    obtainedMarks: number | null;
    totalMarks: number;
    passed: boolean | null;
  }>;
};

export type StudentStanding = {
  studentId: number;
  studentCode: string;
  studentName: string;
  academicGroup: string | null;
  totalMarksObtained: number;
  totalPossibleMarks: number;
  status: "P" | "F" | "Pending";
  passed: boolean;
  meritRank: number | null;
  meritPosition: string | null;
  completedSubjects: number;
  subjectCount: number;
  subjects: SubjectStanding[];
};

function normalize(value: string): string {
  return value.trim().toLocaleLowerCase().replace(/\s+/g, " ");
}

function uniqueGroupNames(values: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const groups: string[] = [];
  for (const value of values) {
    const group = value?.trim();
    if (!group) continue;
    const key = normalize(group);
    if (seen.has(key)) continue;
    seen.add(key);
    groups.push(group);
  }
  return groups;
}

export function sameAcademicGroup(left: string | null | undefined, right: string | null | undefined): boolean {
  return normalize(left ?? "") === normalize(right ?? "");
}

export function getModelTestDraftAcademicGroup(subjects: ModelTestSubject[]): string | null {
  const storedScopes = uniqueGroupNames(subjects.map((subject) => subject.draftAcademicGroup));
  if (storedScopes.length === 1) return storedScopes[0];
  if (storedScopes.length > 1) return null;

  const subjectGroups = uniqueGroupNames(subjects
    .filter((subject) => !subject.allGroups)
    .map((subject) => subject.academicGroup));
  return subjectGroups.length === 1 ? subjectGroups[0] : null;
}

export function resolveModelTestGroupScope(subjects: ModelTestSubject[], requestedGroup?: string | null) {
  const configuredGroup = getModelTestDraftAcademicGroup(subjects);
  const requested = requestedGroup?.trim() || null;
  const availableGroups = uniqueGroupNames(subjects
    .filter((subject) => !subject.allGroups)
    .map((subject) => subject.academicGroup));

  if (configuredGroup && requested && !sameAcademicGroup(configuredGroup, requested)) {
    return {
      academicGroup: configuredGroup,
      subjects: [] as ModelTestSubject[],
      groupRequired: false,
      error: `This draft is scoped to ${configuredGroup}`,
    };
  }

  const academicGroup = configuredGroup || requested || (availableGroups.length === 1 ? availableGroups[0] : null);
  if (!academicGroup && availableGroups.length > 1) {
    return {
      academicGroup: null,
      subjects: [] as ModelTestSubject[],
      groupRequired: true,
      error: "Select an academic group for this draft",
    };
  }

  const scopedSubjects = academicGroup
    ? subjects.filter((subject) =>
      subject.allGroups
      || !subject.academicGroup?.trim()
      || sameAcademicGroup(subject.academicGroup, academicGroup)
    )
    : subjects;
  return {
    academicGroup,
    subjects: scopedSubjects,
    groupRequired: false,
    error: null,
  };
}

export function filterModelTestRoster<T extends {
  batchId: number;
  isActive?: boolean;
  academicGroup?: string | null;
}>(
  students: T[],
  batchId: number,
  academicGroup: string | null,
): T[] {
  return students.filter((student) =>
    student.batchId === batchId
    && student.isActive !== false
    && (!academicGroup || sameAcademicGroup(student.academicGroup, academicGroup))
  );
}

function rankLabel(rank: number): string {
  const lastTwoDigits = rank % 100;
  const suffix = lastTwoDigits >= 11 && lastTwoDigits <= 13
    ? "th"
    : ({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[rank % 10] ?? "th";
  return `${rank}${suffix}`;
}

function subjectAppliesToStudent(subject: ModelTestSubject, student: ModelTestRosterStudent): boolean {
  if (subject.allGroups || !subject.academicGroup?.trim()) return true;
  return normalize(subject.academicGroup) === normalize(student.academicGroup ?? "");
}

function scoreSubject(
  subject: ModelTestSubject,
  mark: ModelTestMark | undefined,
): SubjectStanding {
  const rule = getSubjectMarkingRule(subject.name, subject);
  if (!mark) {
    return {
      subject: subject.name,
      status: "Pending",
      obtainedMarks: null,
      totalMarks: rule.total,
      componentResults: rule.fields.map((field) => ({
        component: field.key,
        obtainedMarks: null,
        totalMarks: field.max,
        passed: null,
      })),
    };
  }

  if (mark.obtainedMarks === -1) {
    return {
      subject: subject.name,
      status: "F",
      obtainedMarks: 0,
      totalMarks: rule.total,
      componentResults: rule.fields.map((field) => ({
        component: field.key,
        obtainedMarks: null,
        totalMarks: field.max,
        passed: false,
      })),
    };
  }

  const isTotalOnly = rule.fields.length === 1 && rule.fields[0].key === "total";
  if (isTotalOnly) {
    const passed = mark.obtainedMarks >= Math.ceil(rule.total * 0.33);
    return {
      subject: subject.name,
      status: passed ? "P" : "F",
      obtainedMarks: mark.obtainedMarks,
      totalMarks: rule.total,
      componentResults: [{
        component: "total",
        obtainedMarks: mark.obtainedMarks,
        totalMarks: rule.total,
        passed,
      }],
    };
  }

  const values: Record<string, number | null> = {
    mcq: mark.mcqMarks,
    cq: mark.cqMarks,
    practical: mark.practicalMarks,
  };
  const componentResults = rule.fields.map((field) => {
    const obtainedMarks = values[field.key];
    return {
      component: field.key,
      obtainedMarks,
      totalMarks: field.max,
      passed: obtainedMarks === null ? null : obtainedMarks >= Math.ceil(field.max * 0.33),
    };
  });

  if (componentResults.some((component) => component.passed === null)) {
    return {
      subject: subject.name,
      status: "Pending",
      obtainedMarks: mark.obtainedMarks,
      totalMarks: rule.total,
      componentResults,
    };
  }

  return {
    subject: subject.name,
    status: componentResults.every((component) => component.passed) ? "P" : "F",
    obtainedMarks: mark.obtainedMarks,
    totalMarks: rule.total,
    componentResults,
  };
}

/**
 * Computes current standings from a draft's configured subjects and saved marks.
 * Derived totals and ranks intentionally stay calculated from source marks, so
 * editing or removing a subject immediately updates the result.
 */
export function calculateModelTestStandings(
  subjects: ModelTestSubject[],
  students: ModelTestRosterStudent[],
  marks: ModelTestMark[],
): StudentStanding[] {
  const marksByStudent = new Map<number, Map<string, ModelTestMark>>();
  for (const mark of marks) {
    const studentMarks = marksByStudent.get(mark.studentId) ?? new Map<string, ModelTestMark>();
    studentMarks.set(normalize(mark.subject), mark);
    marksByStudent.set(mark.studentId, studentMarks);
  }

  const standings = students.flatMap((student): StudentStanding[] => {
    const applicableSubjects = subjects.filter((subject) => subjectAppliesToStudent(subject, student));
    if (applicableSubjects.length === 0) return [];

    const studentMarks = marksByStudent.get(student.id);
    const subjectResults = applicableSubjects.map((subject) =>
      scoreSubject(subject, studentMarks?.get(normalize(subject.name)))
    );
    const hasFailure = subjectResults.some((subject) => subject.status === "F");
    const hasPending = subjectResults.some((subject) => subject.status === "Pending");
    const status: StudentStanding["status"] = hasFailure ? "F" : hasPending ? "Pending" : "P";

    return [{
      studentId: student.id,
      studentCode: student.studentCustomId?.trim() || String(student.id),
      studentName: student.name,
      academicGroup: student.academicGroup ?? null,
      totalMarksObtained: subjectResults.reduce((sum, subject) => sum + (subject.obtainedMarks ?? 0), 0),
      totalPossibleMarks: subjectResults.reduce((sum, subject) => sum + subject.totalMarks, 0),
      status,
      passed: status === "P",
      meritRank: null,
      meritPosition: null,
      completedSubjects: subjectResults.filter((subject) => subject.obtainedMarks !== null).length,
      subjectCount: applicableSubjects.length,
      subjects: subjectResults,
    }];
  });

  // Only fully passed students receive merit positions. Ties share a place,
  // with the next place following standard competition ranking (1, 1, 3).
  const passedStudents = standings
    .filter((standing) => standing.status === "P")
    .sort((a, b) => b.totalMarksObtained - a.totalMarksObtained);
  let previousTotal: number | null = null;
  let previousRank = 0;
  passedStudents.forEach((standing, index) => {
    if (standing.totalMarksObtained !== previousTotal) {
      previousRank = index + 1;
      previousTotal = standing.totalMarksObtained;
    }
    standing.meritRank = previousRank;
    standing.meritPosition = rankLabel(previousRank);
  });

  return standings.sort((a, b) => {
    if (a.status === "P" && b.status !== "P") return -1;
    if (b.status === "P" && a.status !== "P") return 1;
    if (a.status === "P" && b.status === "P") return (a.meritRank ?? Infinity) - (b.meritRank ?? Infinity);
    if (a.status === "F" && b.status !== "F") return -1;
    if (b.status === "F" && a.status !== "F") return 1;
    return b.totalMarksObtained - a.totalMarksObtained;
  });
}

export type TabulationColumn = {
  key: string;
  label: string;
  max?: number;
  children?: Array<{ key: string; label: string; max: number }>;
};

export type ModelTestTabulation = {
  columns: TabulationColumn[];
  rows: Array<Record<string, string | number | null>>;
};

const componentOrder = ["cq", "mcq", "practical", "total"] as const;
const componentLabels: Record<(typeof componentOrder)[number], string> = {
  cq: "CQ",
  mcq: "MCQ",
  practical: "Practical",
  total: "Total",
};

/** Build a flat-row, grouped-column table using only subjects in this draft. */
export function formatModelTestTabulation(
  subjects: ModelTestSubject[],
  standings: StudentStanding[],
): ModelTestTabulation {
  const columns: TabulationColumn[] = [
    { key: "studentId", label: "Student ID" },
    { key: "studentName", label: "Student Name" },
  ];
  const subjectColumnKeys = subjects.map((subject, index) => {
    const subjectKey = `subject_${subject.subjectId ?? index + 1}`;
    const rule = getSubjectMarkingRule(subject.name, subject);
    const configuredComponents = new Set(rule.fields.map((field) => field.key));
    const orderedComponents = componentOrder.filter((component) => configuredComponents.has(component));
    const fields = orderedComponents.map((component) => {
      const field = rule.fields.find((candidate) => candidate.key === component)!;
      return {
        key: `${subjectKey}_${component}`,
        label: componentLabels[component],
        max: field.max,
      };
    });
    if (!configuredComponents.has("total")) {
      fields.push({ key: `${subjectKey}_total`, label: "Total", max: rule.total });
    }
    columns.push({
      key: subjectKey,
      label: subject.name,
      children: fields,
    });
    return { subject, subjectKey, fields };
  });

  columns.push(
    { key: "totalMarksObtained", label: "Total Marks Obtained" },
    { key: "resultStatus", label: "Result Status" },
    { key: "meritRank", label: "Merit Rank" },
  );

  const rows = standings.map((standing) => {
    const row: Record<string, string | number | null> = {
      studentId: standing.studentCode,
      studentRecordId: standing.studentId,
      studentName: standing.studentName,
    };
    for (const { subject, fields } of subjectColumnKeys) {
      const subjectStanding = standing.subjects.find((candidate) =>
        candidate.subject.trim().toLocaleLowerCase() === subject.name.trim().toLocaleLowerCase()
      );
      for (const field of fields) {
        const component = field.key.slice(field.key.lastIndexOf("_") + 1);
        if (!subjectStanding) {
          row[field.key] = null;
        } else if (component === "total") {
          row[field.key] = subjectStanding.obtainedMarks;
        } else {
          row[field.key] = subjectStanding.componentResults.find((result) => result.component === component)?.obtainedMarks ?? null;
        }
      }
    }
    row.totalMarksObtained = standing.totalMarksObtained;
    row.resultStatus = standing.status === "P"
      ? "Passed"
      : standing.status === "F"
        ? "Failed"
        : "Pending";
    row.meritRank = standing.meritPosition;
    return row;
  });

  return { columns, rows };
}
