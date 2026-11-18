import { readFile } from "node:fs/promises";
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
  noWrap?: boolean;
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
  meritPosition?: string | null;
  results: StudentMarksheetResult[];
};

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
  const imported: any = await import("pdfmake");
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

function buildStudentMarksheetContent(input: StudentMarksheetPdfInput, pageBreakBefore: boolean): any[] {
  const marksheet = getStudentMarksheetData(input.results);
  const componentColumns = marksheet.componentColumns;
  const fixedColumnCount = 4 + componentColumns.length;
  const tablePadding = 2;
  const tableLineWidth = 0.35;
  const widthAllowance = tablePadding * 2 + tableLineWidth;
  const tableColumnCount = fixedColumnCount + 1;
  const totalContentWidth = 551 - tableColumnCount * widthAllowance;
  const subjectColumnWidth = Math.max(115, totalContentWidth * 0.27);
  const otherColumnWidth = (totalContentWidth - subjectColumnWidth) / fixedColumnCount;
  // Reserve space for the header, student details, summary, and footer. Scale
  // the subject rows to the remaining A5 landscape height so larger class
  // subject lists stay on the same page instead of being split by the engine.
  const pageContentHeight = 419.53 - 18 - 78;
  const fixedContentHeight = 145;
  const subjectRowHeight = Math.min(
    15.5,
    Math.max(0.55, (pageContentHeight - fixedContentHeight) / (marksheet.rows.length + 1)),
  );
  const subjectFontSize = Math.max(0.35, Math.min(7.5, (subjectRowHeight - tableLineWidth) / 1.8));
  const subjectCellPadding = Math.max(
    0,
    (subjectRowHeight - tableLineWidth - subjectFontSize * 1.2) / 2,
  );
  const compactScale = Math.min(1, Math.max(0.5, subjectFontSize / 7.5));
  const componentLabel = (key: string) =>
    key === "cq" ? "CQ" : key === "mcq" ? "MCQ" : "Practical";
  const header = (text: string): PdfCell => ({
    text: cleanText(text),
    bold: true,
    color: "#ffffff",
    fillColor: "#243b63",
    alignment: "center",
    fontSize: Math.min(6.5, subjectFontSize),
    noWrap: true,
  });
  const infoCell = (label: string, value: string): PdfCell => ({
    text: `${label.toUpperCase()}\n${cleanText(value)}`,
    color: "#172033",
    fontSize: Math.max(5, 7.5 * compactScale),
    margin: [5 * compactScale, 4 * compactScale, 5 * compactScale, 4 * compactScale],
  });

  const subjectTable: any[][] = [
    [
      header("Subject"),
      header("Full Marks"),
      header("Obtained"),
      ...componentColumns.map((column) => header(componentLabel(column))),
      header("Grade Point"),
      header("Letter Grade"),
    ],
    ...marksheet.rows.map(({ result, grade, point, isAbsent, isPending, components }) => [
      {
        text: cleanText(result.subject),
        bold: true,
        alignment: "left",
        fontSize: subjectFontSize,
        noWrap: true,
      },
      { text: cleanText(result.totalMarks), alignment: "center", fontSize: subjectFontSize, noWrap: true },
      {
        text: isPending ? "—" : isAbsent ? "Absent" : cleanText(result.obtainedMarks),
        alignment: "center",
        bold: true,
        fontSize: subjectFontSize,
        color: isAbsent ? "#b91c1c" : "#172033",
        noWrap: true,
      },
      ...componentColumns.map((column) => ({
        text: isAbsent ? "—" : cleanText(components[column] ?? "—"),
        alignment: "center",
        fontSize: subjectFontSize,
        noWrap: true,
      })),
      { text: point === null ? "—" : point.toFixed(2), alignment: "center", fontSize: subjectFontSize, noWrap: true },
      {
        text: grade,
        alignment: "center",
        bold: true,
        fontSize: subjectFontSize,
        color: grade === "F" ? "#b91c1c" : "#166534",
        noWrap: true,
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

  const content = [
      {
        text: "Dynamic Coaching Center",
        alignment: "center",
        color: "#182b4b",
        bold: true,
        fontSize: Math.max(12, 19 * compactScale),
        margin: [0, 0, 0, 2 * compactScale],
      },
      { text: "COME TO LEARN, LEAVE TO SHINE", alignment: "center", color: "#64748b", bold: true, fontSize: 6.5 * compactScale, characterSpacing: 1, margin: [0, 0, 0, 5 * compactScale] },
      { canvas: [{ type: "line", x1: 0, y1: 0, x2: 551, y2: 0, lineWidth: 0.8, lineColor: "#a88a52" }], margin: [0, 0, 0, 5 * compactScale] },
      { text: cleanText(input.examName), alignment: "center", color: "#243b63", bold: true, fontSize: 11 * compactScale, margin: [0, 0, 0, 2 * compactScale] },
      { text: input.isModelTest ? "Model Test" : "Examination", alignment: "center", color: "#475569", fontSize: 7 * compactScale, margin: [0, 0, 0, 7 * compactScale] },
      {
        table: { widths: ["*", "*", "*"], body: infoRows },
        layout: {
          hLineWidth: () => 0.4,
          vLineWidth: () => 0.4,
          hLineColor: () => "#d5dce6",
          vLineColor: () => "#d5dce6",
          fillColor: (row: number) => row % 2 === 0 ? "#f7f8fb" : "#ffffff",
        },
        margin: [0, 0, 0, 7 * compactScale],
      },
      {
        table: {
          headerRows: 1,
          dontBreakRows: true,
          widths: [
            subjectColumnWidth,
            ...Array(fixedColumnCount).fill(otherColumnWidth),
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
          paddingTop: () => subjectCellPadding,
          paddingBottom: () => subjectCellPadding,
        },
      },
      {
        table: {
          widths: ["*", "*", "*", "*"],
          body: [[
            {
              text: `MERIT: ${shortMerit(input.meritPosition, marksheet.pending, marksheet.passed)}`,
              bold: true,
              color: input.meritPosition ? "#243b63" : "#64748b",
              fontSize: Math.max(5, 8 * compactScale),
              alignment: "center",
              noWrap: true,
              margin: [4 * compactScale, 3 * compactScale, 4 * compactScale, 3 * compactScale],
            },
            {
              text: `GPA: ${marksheet.gpa === null ? "—" : `${marksheet.gpa.toFixed(2)} / 5.00`}`,
              bold: true,
              fontSize: Math.max(5, 8 * compactScale),
              alignment: "center",
              noWrap: true,
              margin: [4 * compactScale, 3 * compactScale, 4 * compactScale, 3 * compactScale],
            },
            {
              text: marksheet.pending ? "PENDING" : passed ? "PASSED" : "FAILED",
              bold: true,
              color: marksheet.pending ? "#a16207" : passed ? "#166534" : "#b91c1c",
              fontSize: Math.max(5, 8 * compactScale),
              alignment: "center",
              noWrap: true,
              margin: [4 * compactScale, 3 * compactScale, 4 * compactScale, 3 * compactScale],
            },
            {
              text: `TOTAL: ${marksheet.totalObtained} / ${marksheet.totalFull}`,
              bold: true,
              color: "#172033",
              fontSize: Math.max(5, 8 * compactScale),
              alignment: "center",
              noWrap: true,
              margin: [4 * compactScale, 3 * compactScale, 4 * compactScale, 3 * compactScale],
            },
          ]],
        },
        layout: {
          hLineWidth: () => 0.65,
          vLineWidth: () => 0.65,
          hLineColor: () => "#a88a52",
          vLineColor: () => "#d5c7a2",
          fillColor: () => "#fbfaf6",
        },
        margin: [0, 4 * compactScale, 0, 0],
      },
    ];
  return [{
    // The stack keeps a student's header, marks table, and summary together.
    // Each subsequent student begins on a fresh page.
    unbreakable: true,
    pageBreak: pageBreakBefore ? "before" : undefined,
    stack: content,
  }];
}

function shortMerit(value: string | null | undefined, pending: boolean, passed: boolean) {
  if (!value) return pending ? "Pending" : passed ? "Not ranked" : "Failed";
  if (/failed|not ranked/i.test(value)) return "Failed";
  const rank = value.match(/\b\d+(?:st|nd|rd|th)\b/i)?.[0];
  return rank ?? cleanText(value).trim();
}

function buildStudentMarksheetFooter(input: StudentMarksheetPdfInput, images: { logo: string; signature: string }) {
  const date = input.date ? new Date(input.date) : null;
  const publishedDate = date && !Number.isNaN(date.getTime())
    ? date.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
    : "Not recorded";
  return {
      margin: [22, 0, 22, 15],
      columns: [
        {
          text: `Published Date: ${publishedDate}`,
          alignment: "left",
          color: "#475569",
          fontSize: 7.5,
          margin: [0, 30, 0, 0],
        },
        {
          width: 138,
          stack: [
            { image: images.signature, fit: [96, 24], alignment: "center", margin: [0, 0, 0, 1] },
            { canvas: [{ type: "line", x1: 14, y1: 0, x2: 124, y2: 0, lineWidth: 0.55, lineColor: "#334155" }] },
            { text: "Authority", alignment: "center", bold: true, fontSize: 7.5, margin: [0, 2, 0, 0] },
          ],
        },
      ],
    };
}

async function buildStudentMarksheetsPdf(inputs: StudentMarksheetPdfInput[]): Promise<Buffer> {
  if (inputs.length === 0) throw new Error("At least one student is required for PDF export");
  const engine = await getPdfEngine();
  const images = await getMarksheetImages();
  const first = inputs[0];
  return engine.createPdf({
    info: {
      title: inputs.length === 1
        ? `${first.examName} - ${first.student.name} Marksheet`
        : `${first.examName} - Individual Student Marksheets`,
      author: "Dynamic Coaching Center",
      producer: "PDFKit / fontkit OpenType",
    },
    language: "bn-BD",
    pageSize: "A5",
    pageOrientation: "landscape",
    pageMargins: [22, 18, 22, 78],
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
          width: 230,
          opacity: 0.045,
          absolutePosition: { x: (size.width - 230) / 2, y: (size.height - 230) / 2 },
        },
        {
          text: "Generated from DCC App | Dynamic Coaching Center",
          font: "Noto Sans Bengali",
          fontSize: 4.2,
          color: "#94a3b8",
          alignment: "center",
          absolutePosition: { x: 0, y: size.height - 7.2 },
          width: size.width,
        },
      ],
    }),
    defaultStyle: { font: "Noto Sans Bengali", fontSize: 7.5, color: "#172033" },
    content: inputs.flatMap((input, index) => buildStudentMarksheetContent(input, index > 0)),
    footer: (currentPage: number) =>
      buildStudentMarksheetFooter(inputs[Math.min(currentPage - 1, inputs.length - 1)] ?? first, images),
  }).getBuffer();
}

export async function renderStudentMarksheetPdf(input: StudentMarksheetPdfInput): Promise<Buffer> {
  return buildStudentMarksheetsPdf([input]);
}

export async function renderStudentMarksheetsPdf(inputs: StudentMarksheetPdfInput[]): Promise<Buffer> {
  return buildStudentMarksheetsPdf(inputs);
}

export function studentMarksheetFilename(studentName: string, examName: string) {
  return `${safeFilename(studentName)}_${safeFilename(examName)}_Marksheet.pdf`;
}
