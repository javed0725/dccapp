import assert from "node:assert/strict";
import { inflateSync } from "node:zlib";
import test from "node:test";
import { renderClassResultSheetPdf } from "../server/class-result-pdf";
import { renderStudentMarksheetPdf } from "../server/student-marksheet-pdf";
import type { ModelTestTabulation } from "../shared/model-test-results";

test("keeps one A4 landscape table and encodes Bengali conjuncts as shaped ligature glyphs", async () => {
    const componentSubjects = Array.from({ length: 5 }, (_, index) => ({
      key: `subject_${index + 1}`,
      label: ["গণিত", "বিজ্ঞান", "ইতিহাস", "পৌরনীতি", "পদার্থবিজ্ঞান"][index],
      children: [
        { key: `subject_${index + 1}_cq`, label: "CQ", max: 50 },
        { key: `subject_${index + 1}_mcq`, label: "MCQ", max: 25 },
        { key: `subject_${index + 1}_practical`, label: "Practical", max: 25 },
        { key: `subject_${index + 1}_total`, label: "Total", max: 100 },
      ],
    }));
    const subjectColumns = [
      ...componentSubjects,
      {
        key: "subject_6",
        label: "গণিত",
        children: [{ key: "subject_6_total", label: "Total", max: 50 }],
      },
    ];
    const table: ModelTestTabulation = {
      columns: [
        { key: "studentId", label: "Student ID" },
        { key: "studentName", label: "Student Name" },
        ...subjectColumns,
        { key: "totalMarksObtained", label: "Total Marks Obtained" },
        { key: "resultStatus", label: "Result Status" },
        { key: "meritRank", label: "Merit Rank" },
      ],
      rows: Array.from({ length: 50 }, (_, index) => ({
        studentId: `S-${String(index + 1).padStart(3, "0")}`,
        studentRecordId: index + 1,
        studentName: index === 0 ? "শিক্ষার্থী" : `Student ${index + 1}`,
        subject_1_cq: 40,
        subject_1_mcq: 20,
        subject_1_practical: 20,
        subject_1_total: 80,
        subject_6_total: 40,
        totalMarksObtained: 400,
        resultStatus: "Passed",
        meritRank: `${index + 1}`,
      })),
    };

    const pdf = await renderClassResultSheetPdf({
      examName: "বার্ষিক পরীক্ষা",
      className: "Class 7",
      groupName: "All Groups",
    }, table);

    const raw = pdf.toString("latin1");
    assert.equal((raw.match(/\/Type\s*\/Page\b/g) ?? []).length, 1);
    assert.match(raw, /\/MediaBox\s*\[0 0 841\.89 595\.28\]/);
    assert.match(raw, /\/FontFile2\b/);
    assert.ok(pdf.length > 10_000);
    assert.equal(pdf.subarray(0, 5).toString(), "%PDF-");

    const streams = [...raw.matchAll(/stream\r?\n([\s\S]*?)\r?\nendstream/g)].flatMap((match) => {
      try {
        return [inflateSync(Buffer.from(match[1], "latin1")).toString("latin1")];
      } catch {
        return [];
      }
    });
    const unicodeMaps = streams.filter((stream) => stream.includes("begincmap")).join("\n");
    // জ + ্ + ঞ must be encoded as a single substituted glyph for জ্ঞ.
    // Merely embedding a Unicode font (the old jsPDF path) cannot pass this.
    assert.match(unicodeMaps, /<099c\s+09cd\s+099e>/i);
});

test("renders a professional A5 landscape student marksheet with shaped Bengali text", async () => {
  const pdf = await renderStudentMarksheetPdf({
    student: {
      id: 26,
      studentCustomId: "S-026",
      registrationNumber: "R-026",
      name: "Rafi",
      batchName: "Class 9",
      academicGroup: "Science",
      school: "Dynamic High School",
    },
    examName: "বার্ষিক পরীক্ষা",
    isModelTest: true,
    date: "2026-11-16T00:00:00.000Z",
    meritPosition: "1st in Class/Group",
    results: [
      {
        subject: "গণিত",
        obtainedMarks: 82,
        totalMarks: 100,
        cqMarks: 42,
        mcqMarks: 20,
        practicalMarks: 20,
        markingConfig: {
          totalMarks: 100,
          cqEnabled: true,
          mcqEnabled: true,
          practicalEnabled: true,
          cqMax: 50,
          mcqMax: 25,
          practicalMax: 25,
        },
      },
      {
        subject: "বিজ্ঞান",
        obtainedMarks: 75,
        totalMarks: 100,
        cqMarks: 39,
        mcqMarks: 18,
        practicalMarks: 18,
        markingConfig: {
          totalMarks: 100,
          cqEnabled: true,
          mcqEnabled: true,
          practicalEnabled: true,
          cqMax: 50,
          mcqMax: 25,
          practicalMax: 25,
        },
      },
    ],
  });

  const raw = pdf.toString("latin1");
  assert.equal((raw.match(/\/Type\s*\/Page\b/g) ?? []).length, 1);
  assert.match(raw, /\/MediaBox\s*\[0 0 595\.28 419\.53\]/);
  assert.match(raw, /\/FontFile2\b/);
  assert.ok((raw.match(/\/Subtype\s*\/Image\b/g) ?? []).length >= 2, "PDF embeds the center logo and authority signature");
  assert.ok(pdf.length > 10_000);
  assert.equal(pdf.subarray(0, 5).toString(), "%PDF-");

  const streams = [...raw.matchAll(/stream\r?\n([\s\S]*?)\r?\nendstream/g)].flatMap((match) => {
    try {
      return [inflateSync(Buffer.from(match[1], "latin1")).toString("latin1")];
    } catch {
      return [];
    }
  });
  const unicodeMaps = streams.filter((stream) => stream.includes("begincmap")).join("\n");
  assert.match(unicodeMaps, /<099c\s+09cd\s+099e>/i);
});
