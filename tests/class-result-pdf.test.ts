import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createClassResultSheetPdf } from "../client/src/lib/class-result-pdf";
import type { ModelTestTabulation } from "../shared/model-test-results";

test("keeps all subject columns on one A4 landscape page with an embedded Bengali font", async () => {
  const [regularFont, boldFont] = await Promise.all([
    readFile(new URL("../client/public/fonts/NotoSansBengali-Regular.ttf", import.meta.url)),
    readFile(new URL("../client/public/fonts/NotoSansBengali-Bold.ttf", import.meta.url)),
  ]);
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const font = String(input).endsWith("Bold.ttf") ? boldFont : regularFont;
    return new Response(font, { status: 200 });
  }) as typeof fetch;

  try {
    const componentSubjects = Array.from({ length: 5 }, (_, index) => ({
      key: `subject_${index + 1}`,
      label: `Subject ${index + 1}`,
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

    const doc = await createClassResultSheetPdf({
      groupId: "sample",
      examName: "বার্ষিক পরীক্ষা",
      className: "Class 7",
      groupName: "All Groups",
    }, table);

    assert.equal(Math.round(doc.internal.pageSize.getWidth()), 297);
    assert.equal(Math.round(doc.internal.pageSize.getHeight()), 210);
    assert.equal(doc.getNumberOfPages(), 1);
    assert.ok(Object.keys(doc.getFontList()).includes("NotoSansBengali"));
    const pdfBytes = doc.output("arraybuffer") as ArrayBuffer;
    assert.ok(pdfBytes.byteLength > 10_000);
    assert.equal(new TextDecoder().decode(pdfBytes.slice(0, 5)), "%PDF-");
  } finally {
    globalThis.fetch = originalFetch;
  }
});
