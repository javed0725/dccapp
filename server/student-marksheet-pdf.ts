import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { getStudentMarksheetData, type StudentMarksheetResult } from "../shared/student-marksheet.js";

type PdfCell = {
  text?: string;
  bold?: boolean;
  color?: string;
  fillColor?: string;
  alignment?: string;
  fontSize?: number;
  margin?: number[];
};

export type StudentMarksheetPdfInput = {
  student: {
    id: number;
    studentCustomId: string | null;
    registrationNumber: string | null;
    name: string;
    batchName: string | null;
    academicGroup: string | null;
    school: string | null;
  };
  examName: string;
  isModelTest: boolean;
  date: string | Date | null;
  results: StudentMarksheetResult[];
};

const require = createRequire(path.resolve(process.cwd(), "package.json"));
let fontPromise: Promise<{ regular: string; bold: string }> | undefined;
let imagePromise: Promise<{ logo: string; signature: string }> | undefined;

async function readFont(filename: string): Promise<string> {
  for (const directory of ["client/public/fonts", "dist/public/fonts"]) {
    try {
      return (await readFile(path.resolve(process.cwd(), directory, filename))).toString("base64");
    } catch (error: any) {
      if (error.code !== "ENOENT") throw error;
    }
  }
  throw new Error(`Missing Bengali PDF font: ${filename}`);
}

async function getPdfEngine() {
  const imported = require("pdfmake");
  const engine = imported.default ?? imported;
  fontPromise ??= Promise.all([
    readFont("NotoSansBengali-Regular.ttf"),
    readFont("NotoSansBengali-Bold.ttf"),
  ]).then(([regular, bold]) => ({ regular, bold })).catch((error) => {
    fontPromise = undefined;
    throw error;
  });
  const fonts = await fontPromise;
  const fontStore = engine.sharedVirtualfs ?? engine.virtualfs;
  fontStore.writeFileSync("NotoSansBengali-Regular.ttf", fonts.regular, "base64");
  fontStore.writeFileSync("NotoSansBengali-Bold.ttf", fonts.bold, "base64");
  engine.setFonts({
    "Noto Sans Bengali": {
      normal: "NotoSansBengali-Regular.ttf",
      bold: "NotoSansBengali-Bold.ttf",
      italics: "NotoSansBengali-Regular.ttf",
      bolditalics: "NotoSansBengali-Bold.ttf",
    },
  });
  engine.setUrlAccessPolicy(() => false);
  engine.setLocalAccessPolicy(() => false);
  return engine;
}

async function readImage(filename: string): Promise<string> {
  for (const directory of ["client/public/marksheet", "dist/public/marksheet"]) {
    try {
      return (await readFile(path.resolve(process.cwd(), directory, filename))).toString("base64");
    } catch (error: any) {
      if (error.code !== "ENOENT") throw error;
    }
  }
  throw new Error(`Missing marksheet image: ${filename}`);
}

async function getMarksheetImages() {
  imagePromise ??= Promise.all([
    readImage("center-logo.png"),
    readImage("authority-signature.png"),
  ]).then(([logo, signature]) => ({ logo, signature })).catch((error) => {
    imagePromise = undefined;
    throw error;
  });
  const images = await imagePromise;
  return {
    logo: `data:image/png;base64,${images.logo}`,
    signature: `data:image/png;base64,${images.signature}`,
  };
}

function cleanText(value: unknown) {
  return String(value ?? "—").normalize("NFC");
}

function safeFilename(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[^\w.-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80) || "Student_Marksheet";
}

export async function renderStudentMarksheetPdf(input: StudentMarksheetPdfInput): Promise<Buffer> {
  const engine = await getPdfEngine();
  const images = await getMarksheetImages();
  const marksheet = getStudentMarksheetData(input.results);
  const date = input.date ? new Date(input.date) : null;
  const publishedDate = date && !Number.isNaN(date.getTime())
    ? date.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
    : "Not recorded";
  const componentColumns = marksheet.componentColumns;
  const fixedColumnCount = 4 + componentColumns.length;
  const fixedWidth = 46 * fixedColumnCount;
  const subjectWidth = Math.max(110, 551 - fixedWidth);
  const tablePadding = 3;
  const tableLineWidth = 0.45;
  const widthAllowance = tablePadding * 2 + tableLineWidth;
  const componentLabel = (key: string) =>
    key === "cq" ? "CQ" : key === "mcq" ? "MCQ" : "Practical";
  const header = (text: string): PdfCell => ({
    text: cleanText(text),
    bold: true,
    color: "#ffffff",
    fillColor: "#243b63",
    alignment: "center",
    fontSize: 7.5,
  });
  const infoCell = (label: string, value: string): PdfCell => ({
    text: `${label.toUpperCase()}\n${cleanText(value)}`,
    color: "#172033",
    fontSize: 7.5,
    margin: [5, 4, 5, 4],
  });

  const subjectTable: PdfCell[][] = [
    [
      header("Subject"),
      header("Full Marks"),
      header("Obtained"),
      ...componentColumns.map((column) => header(componentLabel(column))),
      header("Grade Point"),
      header("Letter Grade"),
    ],
    ...marksheet.rows.map(({ result, grade, point, isAbsent, components }) => [
      {
        text: cleanText(result.subject),
        bold: true,
        alignment: "left",
        fontSize: 7.5,
      },
      { text: cleanText(result.totalMarks), alignment: "center", fontSize: 7.5 },
      {
        text: isAbsent ? "Absent" : cleanText(result.obtainedMarks),
        alignment: "center",
        bold: true,
        fontSize: 7.5,
        color: isAbsent ? "#b91c1c" : "#172033",
      },
      ...componentColumns.map((column) => ({
        text: isAbsent ? "—" : cleanText(components[column] ?? "—"),
        alignment: "center",
        fontSize: 7.5,
      })),
      { text: point === null ? "—" : point.toFixed(2), alignment: "center", fontSize: 7.5 },
      {
        text: grade,
        alignment: "center",
        bold: true,
        fontSize: 7.5,
        color: grade === "F" ? "#b91c1c" : "#166534",
      },
    ]),
  ];

  const infoRows: PdfCell[][] = [
    [
      infoCell("Student Name", input.student.name),
      infoCell("Student ID", input.student.studentCustomId || String(input.student.id)),
      infoCell("Class", input.student.batchName || "—"),
    ],
    [
      infoCell("Group", input.student.academicGroup || "—"),
      infoCell("Roll / Registration", input.student.registrationNumber || input.student.studentCustomId || "—"),
      infoCell("School", input.student.school || "—"),
    ],
  ];
  const passed = marksheet.passed;

  return engine.createPdf({
    info: {
      title: `${input.examName} - ${input.student.name} Marksheet`,
      author: "Dynamic Coaching Center",
      producer: "PDFKit / fontkit OpenType",
    },
    language: "bn-BD",
    pageSize: "A5",
    pageOrientation: "landscape",
    pageMargins: [22, 18, 22, 62],
    background: (_page: number, size: { width: number; height: number }) => ({
      stack: [
        {
          canvas: [
            { type: "rect", x: 8, y: 8, w: size.width - 16, h: size.height - 16, lineColor: "#a88a52", lineWidth: 1.2 },
            { type: "rect", x: 12, y: 12, w: size.width - 24, h: size.height - 24, lineColor: "#d9c89f", lineWidth: 0.45 },
          ],
        },
        {
          image: images.logo,
          width: 110,
          opacity: 0.075,
          absolutePosition: { x: (size.width - 110) / 2, y: (size.height - 110) / 2 },
        },
      ],
    }),
    defaultStyle: { font: "Noto Sans Bengali", fontSize: 7.5, color: "#172033" },
    content: [
      { text: "Dynamic Coaching Center", alignment: "center", color: "#182b4b", bold: true, fontSize: 19, margin: [0, 0, 0, 2] },
      { text: "COME TO LEARN, LEAVE TO SHINE", alignment: "center", color: "#64748b", bold: true, fontSize: 6.5, characterSpacing: 1, margin: [0, 0, 0, 5] },
      { canvas: [{ type: "line", x1: 0, y1: 0, x2: 551, y2: 0, lineWidth: 0.8, lineColor: "#a88a52" }], margin: [0, 0, 0, 5] },
      { text: cleanText(input.examName), alignment: "center", color: "#243b63", bold: true, fontSize: 11, margin: [0, 0, 0, 2] },
      { text: input.isModelTest ? "Model Test" : "Examination", alignment: "center", color: "#475569", fontSize: 7, margin: [0, 0, 0, 7] },
      {
        table: { widths: ["*", "*", "*"], body: infoRows },
        layout: {
          hLineWidth: () => 0.4,
          vLineWidth: () => 0.4,
          hLineColor: () => "#d5dce6",
          vLineColor: () => "#d5dce6",
          fillColor: (row: number) => row % 2 === 0 ? "#f7f8fb" : "#ffffff",
        },
        margin: [0, 0, 0, 7],
      },
      {
        table: {
          headerRows: 1,
          dontBreakRows: true,
          widths: [
            subjectWidth - widthAllowance,
            ...Array(fixedColumnCount).fill(46 - widthAllowance),
          ],
          body: subjectTable,
        },
        layout: {
          hLineWidth: () => tableLineWidth,
          vLineWidth: () => tableLineWidth,
          hLineColor: () => "#aeb9c8",
          vLineColor: () => "#aeb9c8",
          paddingLeft: () => tablePadding,
          paddingRight: () => tablePadding,
          paddingTop: () => 3.5,
          paddingBottom: () => 3.5,
        },
      },
      {
        table: {
          widths: ["*", "*", "*"],
          body: [[
            { text: `TOTAL MARKS\n${marksheet.totalObtained} / ${marksheet.totalFull}`, bold: true, fontSize: 8.5, alignment: "center", margin: [5, 4, 5, 4] },
            { text: `GPA\n${marksheet.gpa === null ? "—" : `${marksheet.gpa.toFixed(2)} / 5.00`}`, bold: true, fontSize: 8.5, alignment: "center", margin: [5, 4, 5, 4] },
            { text: `FINAL RESULT\n${passed ? "PASSED" : "FAILED"}`, bold: true, color: passed ? "#166534" : "#b91c1c", fontSize: 8.5, alignment: "center", margin: [5, 4, 5, 4] },
          ]],
        },
        layout: {
          hLineWidth: () => 0.65,
          vLineWidth: () => 0.65,
          hLineColor: () => "#a88a52",
          vLineColor: () => "#d5c7a2",
          fillColor: () => "#fbfaf6",
        },
        margin: [0, 6, 0, 0],
      },
    ],
    footer: () => ({
      margin: [22, 4, 22, 7],
      columns: [
        {
          text: `Published Date: ${publishedDate}`,
          alignment: "left",
          color: "#475569",
          fontSize: 7.5,
          margin: [0, 28, 0, 0],
        },
        {
          width: 150,
          stack: [
            { image: images.signature, fit: [112, 36], alignment: "center", margin: [0, 0, 0, 1] },
            { canvas: [{ type: "line", x1: 20, y1: 0, x2: 130, y2: 0, lineWidth: 0.55, lineColor: "#334155" }] },
            { text: "Authority", alignment: "center", bold: true, fontSize: 8, margin: [0, 2, 0, 0] },
          ],
        },
      ],
    }),
  }).getBuffer();
}

export function studentMarksheetFilename(studentName: string, examName: string) {
  return `${safeFilename(studentName)}_${safeFilename(examName)}_Marksheet.pdf`;
}
