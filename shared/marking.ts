export type MarkComponent = "mcq" | "cq" | "practical" | "total";
export type SubjectMarkingRule = {
  fields: { key: MarkComponent; label: string; max: number }[];
  total: number;
};
import type { ModelTestSubject } from "./schema";

export type { ModelTestSubject } from "./schema";

export type SubjectMarkingConfig = Pick<
  ModelTestSubject,
  "mcqEnabled" | "cqEnabled" | "practicalEnabled" | "mcqMax" | "cqMax" | "practicalMax"
>;

export function isCommonCoreSubject(subject: string): boolean {
  const normalized = subject.trim().toLowerCase().replace(/[._-]+/g, " ").replace(/\s+/g, " ");
  return normalized.includes("english") || ["math", "mathematics"].includes(normalized);
}

export type SubjectMarksEntry = {
  subject: string;
  totalMarks: number;
  obtainedMarks: number;
  mcqMarks: number | null;
  cqMarks: number | null;
  practicalMarks: number | null;
};

const scienceSubjects = new Set(["physics", "chemistry", "biology", "higher math", "higher mathematics"]);
export function getSubjectMarkingRule(subject: string, config?: SubjectMarkingConfig): SubjectMarkingRule {
  const normalized = subject.trim().toLowerCase().replace(/[._-]+/g, " ").replace(/\s+/g, " ");
  if (config && (
    config.mcqEnabled !== undefined
    || config.cqEnabled !== undefined
    || config.practicalEnabled !== undefined
  )) {
    const fields: SubjectMarkingRule["fields"] = [];
    if (config.mcqEnabled) fields.push({ key: "mcq", label: "MCQ Marks", max: config.mcqMax ?? 0 });
    if (config.cqEnabled) fields.push({ key: "cq", label: "CQ Marks", max: config.cqMax ?? 0 });
    if (config.practicalEnabled) fields.push({ key: "practical", label: "Practical Marks", max: config.practicalMax ?? 0 });
    return {
      fields: fields.length ? fields : [{ key: "total", label: "Total Marks", max: 100 }],
      total: 100,
    };
  }

  if (scienceSubjects.has(normalized)) {
    return {
      fields: [
        { key: "mcq", label: "MCQ Marks", max: 25 },
        { key: "cq", label: "CQ Marks", max: 50 },
        { key: "practical", label: "Practical Marks", max: 25 },
      ],
      total: 100,
    };
  }

  if (normalized.includes("english")) {
    return {
      fields: [{ key: "total", label: "Total Marks", max: 100 }],
      total: 100,
    };
  }

  return {
    fields: [
      { key: "mcq", label: "MCQ Marks", max: 30 },
      { key: "cq", label: "CQ Marks", max: 70 },
    ],
    total: 100,
  };
}

export function validateSubjectMarksEntry(
  entry: SubjectMarksEntry,
  unchangedLegacyResult?: Pick<SubjectMarksEntry, "totalMarks" | "obtainedMarks" | "mcqMarks" | "cqMarks" | "practicalMarks">,
  config?: SubjectMarkingConfig,
): string | null {
  if (entry.totalMarks !== 100 || !Number.isInteger(entry.obtainedMarks) || entry.obtainedMarks < -1 || entry.obtainedMarks > 100) {
    return "Marks must be recorded out of 100";
  }

  const hasAnyComponent = entry.mcqMarks !== null || entry.cqMarks !== null || entry.practicalMarks !== null;
  if (entry.obtainedMarks === -1) {
    return hasAnyComponent ? "Absent results cannot include component marks" : null;
  }

  const rule = getSubjectMarkingRule(entry.subject, config);
  const isTotalOnly = rule.fields[0]?.key === "total";
  if (isTotalOnly) {
    return hasAnyComponent ? "This subject uses total marks only" : null;
  }

  const fields = rule.fields.filter((field) => field.key !== "total");
  const supportedKeys = new Set(fields.map((field) => field.key));
  if ((!supportedKeys.has("mcq") && entry.mcqMarks !== null)
    || (!supportedKeys.has("cq") && entry.cqMarks !== null)
    || (!supportedKeys.has("practical") && entry.practicalMarks !== null)) {
    return "This subject does not accept that mark component";
  }

  const values: Record<string, number | null> = {
    mcq: entry.mcqMarks,
    cq: entry.cqMarks,
    practical: entry.practicalMarks,
  };
  const supplied = fields.map((field) => values[field.key]);
  const allNull = supplied.every((value) => value === null);

  if (allNull) {
    const unchanged = unchangedLegacyResult
      && unchangedLegacyResult.totalMarks === entry.totalMarks
      && unchangedLegacyResult.obtainedMarks === entry.obtainedMarks
      && unchangedLegacyResult.mcqMarks === null
      && unchangedLegacyResult.cqMarks === null
      && unchangedLegacyResult.practicalMarks === null;
    return unchanged ? null : "Enter each mark component before saving";
  }

  if (supplied.some((value) => value === null)) {
    return "Enter every mark component for a student";
  }

  for (const field of fields) {
    const value = values[field.key];
    if (value === null || !Number.isInteger(value) || value < 0 || value > field.max) {
      return `${field.label} must be between 0 and ${field.max}`;
    }
  }

  const sum = supplied.reduce<number>((total, value) => total + (value ?? 0), 0);
  return sum === entry.obtainedMarks ? null : "Total marks must equal the sum of components";
}
