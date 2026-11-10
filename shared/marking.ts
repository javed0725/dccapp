export type MarkComponent = "mcq" | "cq" | "practical" | "total";
export type SubjectMarkingRule = {
  fields: { key: MarkComponent; label: string; max: number }[];
  total: number;
};

const scienceSubjects = new Set(["physics", "chemistry", "biology", "higher math", "higher mathematics"]);
const englishPaperSubjects = new Set([
  "english 1st paper",
  "english first paper",
  "english 2nd paper",
  "english second paper",
]);

export function getSubjectMarkingRule(subject: string): SubjectMarkingRule {
  const normalized = subject.trim().toLowerCase().replace(/[._-]+/g, " ").replace(/\s+/g, " ");
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

  if (englishPaperSubjects.has(normalized)) {
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
