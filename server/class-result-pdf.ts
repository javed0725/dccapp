import { readFile } from "node:fs/promises";
import path from "node:path";
import type { ModelTestTabulation } from "../shared/model-test-results.js";

export type ClassResultPdfInfo = {
  examName: string;
  className: string;
  groupName: string;
};

type Column = ModelTestTabulation["columns"][number];
type Cell = {
  text?: string;
  rowSpan?: number;
  colSpan?: number;
  bold?: boolean;
  color?: string;
  fillColor?: string;
  alignment?: string;
  fontSize?: number;
};

// pdfmake uses PDFKit/fontkit's OpenType layout engine. Unlike jsPDF's
// character-by-character TTF encoding, this applies Bengali GSUB/GPOS shaping.
let fontPromise: Promise<{ regular: string; bold: string }> | undefined;

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
  // pdfmake 0.3.14 renamed the shared font store; support both 0.3 APIs.
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

const text = (value: unknown) => String(value ?? "—").normalize("NFC");

function subjectValueColumns(subject: Column): NonNullable<Column["children"]> {
  const children = subject.children ?? [];
  const components = children.filter((column) =>
    column.label.trim().toLowerCase() !== "total" && !/(^|_)total$/i.test(column.key)
  );
  return components.length ? components : children.slice(0, 1);
}

export async function renderClassResultSheetPdf(
  draft: ClassResultPdfInfo,
  tabulation: ModelTestTabulation,
): Promise<Buffer> {
  const engine = await getPdfEngine();
  const metadata = tabulation.columns.filter((column) => ["studentId", "studentName"].includes(column.key));
  const subjects = tabulation.columns.filter((column) => column.children?.length);
  const subjectCells = subjects.map(subjectValueColumns);
  const components = subjectCells.flat();
  const summary = ["resultStatus", "meritRank", "totalMarksObtained"]
    .map((key) => tabulation.columns.find((column) => column.key === key))
    .filter((column): column is Column => !!column);
  const columns = [...metadata, ...components, ...summary];
  const margin = 17;
  const padding = 0.8;
  const lineWidth = 0.35;
  const tableWidth = 841.89 - margin * 2;
  const fixedWidths: Record<string, number> = {
    studentId: 45, studentName: 88, resultStatus: 45, meritRank: 37, totalMarksObtained: 57,
  };
  const fixedWidth = [...metadata, ...summary].reduce((sum, column) => sum + fixedWidths[column.key], 0);
  const componentWidth = components.length ? (tableWidth - fixedWidth) / components.length : 0;
  const widths = columns.map((column) =>
    (fixedWidths[column.key] ?? componentWidth) - padding * 2 - lineWidth
  );
  const rowBudget = 420 / Math.max(3, tabulation.rows.length + 2);
  const fontSize = Math.max(
    2.6,
    Math.min(10, componentWidth ? componentWidth * 0.23 : 10, (rowBudget - 2.4) / 1.25),
  );
  const headerFontSize = Math.max(
    6.5,
    Math.min(9, componentWidth ? componentWidth * 0.2 : 9, rowBudget * 0.44),
  );
  const verticalPadding = Math.max(1.2, Math.min(5.5, (rowBudget - fontSize * 1.15) / 2));
  const header = (value: unknown, extra: Partial<Cell> = {}): Cell => ({
    text: text(value), bold: true, color: "#ffffff", fillColor: "#253657",
    alignment: "center", fontSize: headerFontSize, ...extra,
  });
  const top: Cell[] = metadata.map((column) => header(column.label, { rowSpan: 2 }));
  subjects.forEach((subject, index) => {
    top.push(header(subject.label, { colSpan: subjectCells[index].length }));
    for (let cell = 1; cell < subjectCells[index].length; cell++) top.push({});
  });
  top.push(...summary.map((column) => header(column.label, { rowSpan: 2 })));
  const sub: Cell[] = [
    ...metadata.map(() => ({})),
    ...components.map((column) => header(column.label.toLowerCase() === "total" ? "Marks" : column.label)),
    ...summary.map(() => ({})),
  ];
  const rows: Cell[][] = tabulation.rows.map((row) => columns.map((column) => ({
    text: text(row[column.key]),
    alignment: column.key === "studentName" ? "left" : "center",
    bold: ["resultStatus", "totalMarksObtained"].includes(column.key),
    fontSize,
    ...(column.key === "resultStatus" ? {
      color: row.resultStatus === "Passed" ? "#166534" : row.resultStatus === "Failed" ? "#b91c1c" : "#a16207",
    } : {}),
  })));
  if (!rows.length) {
    rows.push([{ text: "No student results available", colSpan: columns.length, alignment: "center" },
      ...columns.slice(1).map(() => ({}))]);
  }
  const counts = ["Passed", "Failed", "Pending"]
    .map((status) => `${status}: ${tabulation.rows.filter((row) => row.resultStatus === status).length}`)
    .join("    ");

  return engine.createPdf({
    info: { title: text(draft.examName), author: "Dynamic Coaching Center", producer: "PDFKit / fontkit OpenType" },
    language: "bn-BD",
    pageSize: "A4",
    pageOrientation: "landscape",
    pageMargins: [margin, 16, margin, 22],
    defaultStyle: { font: "Noto Sans Bengali", fontSize, color: "#182237" },
    content: [
      { text: "Dynamic Coaching Center", bold: true, fontSize: 14, alignment: "center", margin: [0, 0, 0, 3] },
      { text: text(draft.examName), bold: true, fontSize: 10, alignment: "center", margin: [0, 0, 0, 4] },
      { text: `Class: ${text(draft.className)}    |    Group: ${text(draft.groupName)}`,
        fontSize: 7, alignment: "center", margin: [0, 0, 0, 10] },
      {
        table: { headerRows: 2, dontBreakRows: true, widths, body: [top, sub, ...rows] },
        layout: {
          hLineWidth: () => lineWidth,
          vLineWidth: () => lineWidth,
          hLineColor: () => "#b9c0cc",
          vLineColor: () => "#b9c0cc",
          paddingLeft: () => padding,
          paddingRight: () => padding,
          paddingTop: () => verticalPadding,
          paddingBottom: () => verticalPadding,
          fillColor: (rowIndex: number) => rowIndex > 1 && rowIndex % 2 === 0 ? "#f6f8fc" : undefined,
        },
      },
    ],
    footer: (page: number, totalPages: number) => ({
      columns: [
        { text: counts },
        { text: totalPages > 1 ? `Page ${page}/${totalPages}` : "", alignment: "right" },
      ],
      fontSize: 6.5,
      color: "#4b5563",
      margin: [margin, 4, margin, 0],
    }),
  }).getBuffer();
}
