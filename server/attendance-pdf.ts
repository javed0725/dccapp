import { access, readFile } from "fs/promises";
import path from "path";
import { createRequire } from "module";

const require = createRequire(path.resolve(process.cwd(), "package.json"));
const pdfMake = require("pdfmake") as {
  virtualfs: {
    writeFileSync: (fileName: string, content: string, options?: { encoding?: string } | string) => void;
  };
  setFonts: (fonts: Record<string, unknown>) => void;
  createPdf: (definition: Record<string, unknown>) => { getBuffer: () => Promise<Buffer> };
};

type SmartStudent = {
  studentCustomId?: string | number | null;
  name?: string | null;
  status?: string | null;
  punchTime?: string | null;
};

type SmartSlot = {
  subject?: string | null;
  students?: SmartStudent[];
};

type SmartDay = {
  date: string;
  dayOfWeek?: string | null;
  offDay?: boolean;
  noRoutine?: boolean;
  slots?: SmartSlot[];
};

export type AttendancePdfData = {
  startDate: string;
  endDate: string;
  days: SmartDay[];
};

let fontDataPromise: Promise<{ regular: string; bold: string }> | undefined;

const normalizeText = (value: unknown, fallback = "") =>
  String(value ?? fallback).normalize("NFC");

async function readFont(fileName: string): Promise<string> {
  const candidates = [
    path.resolve(process.cwd(), "client/public/fonts", fileName),
    path.resolve(process.cwd(), "dist/public/fonts", fileName),
  ];

  for (const candidate of candidates) {
    try {
      await access(candidate);
      return (await readFile(candidate)).toString("base64");
    } catch {
      // Try the next location.
    }
  }

  throw new Error(`Bengali font asset is missing: ${fileName}`);
}

async function getFontData() {
  fontDataPromise ??= Promise.all([
    readFont("NotoSansBengali-Regular.ttf"),
    readFont("NotoSansBengali-Bold.ttf"),
  ]).then(([regular, bold]) => ({ regular, bold }));
  return fontDataPromise;
}

function dhakaTime(value: unknown): string {
  if (!value) return "—";
  const date = new Date(normalizeText(value));
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleTimeString("en-US", {
    timeZone: "Asia/Dhaka",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

function shortDate(value: unknown): string {
  const parts = normalizeText(value).split("-");
  return parts.length === 3
    ? `${parts[2]}-${parts[1]}-${parts[0].slice(-2)}`
    : normalizeText(value);
}

type PdfCell = {
  text: string;
  style?: string;
  color?: string;
  bold?: boolean;
  alignment?: "left" | "center" | "right";
  colSpan?: number;
};

function cell(value: unknown, fallback = "—", alignment: PdfCell["alignment"] = "left"): PdfCell {
  return { text: normalizeText(value, fallback), alignment };
}

function reportRows(data: AttendancePdfData): PdfCell[][] {
  const rows = data.days
    .filter((day) => !day.noRoutine && !day.offDay)
    .flatMap((day) =>
      (day.slots ?? [])
        .filter((slot) => !slot.subject || slot.subject !== "Off Day")
        .flatMap((slot) =>
          (slot.students ?? []).map((student) => ({
            id: student.studentCustomId,
            name: student.name,
            date: shortDate(day.date),
            weekday: day.dayOfWeek,
            subject: slot.subject || "—",
            status: normalizeText(student.status, "Absent").toUpperCase(),
            punch: dhakaTime(student.punchTime),
          })),
        ),
    );

  if (!rows.length) {
    return [[{ text: "No attendance records", colSpan: 8, alignment: "center" }]];
  }

  return rows.map((row, index) => [
    cell(index + 1, "—", "center"),
    cell(row.id, "—", "center"),
    cell(row.name),
    cell(row.date, "—", "center"),
    cell(row.weekday, "—", "center"),
    cell(row.subject),
    {
      ...cell(row.status, "ABSENT", "center"),
      color: row.status === "PRESENT" ? "#166534" : "#991b1b",
      bold: true,
    },
    cell(row.punch, "—", "center"),
  ]);
}

function configureFonts(fonts: { regular: string; bold: string }) {
  // pdfmake's virtual file system accepts the Base64 font payload directly.
  // The document definition then references only these in-memory font files.
  pdfMake.virtualfs.writeFileSync("NotoSansBengali-Regular.ttf", fonts.regular, "base64");
  pdfMake.virtualfs.writeFileSync("NotoSansBengali-Bold.ttf", fonts.bold, "base64");
  pdfMake.setFonts({
    "Noto Sans Bengali": {
      normal: "NotoSansBengali-Regular.ttf",
      bold: "NotoSansBengali-Bold.ttf",
    },
  });
}

function buildDocument(
  data: AttendancePdfData,
  batchName: string,
): Record<string, unknown> {
  const header: PdfCell[] = [
    { text: "#", alignment: "center", bold: true },
    { text: "Student ID", alignment: "center", bold: true },
    { text: "Student Name", alignment: "center", bold: true },
    { text: "Date", alignment: "center", bold: true },
    { text: "Day", alignment: "center", bold: true },
    { text: "Subject", alignment: "center", bold: true },
    { text: "Status", alignment: "center", bold: true },
    { text: "Punch Time", alignment: "center", bold: true },
  ];

  return {
    info: {
      title: "Smart Attendance Report",
      subject: "Attendance report",
      author: "Dynamic Coaching Center",
      creator: "Dynamic Coaching Center",
      producer: "pdfmake",
    },
    language: "bn-BD",
    pageSize: "A4",
    pageMargins: [28, 28, 28, 28],
    defaultStyle: {
      font: "Noto Sans Bengali",
      fontSize: 8,
      color: "#111827",
    },
    styles: {
      title: { fontSize: 18, bold: true, alignment: "center", margin: [0, 0, 0, 3] },
      subtitle: { fontSize: 10, alignment: "center", margin: [0, 0, 0, 10] },
      meta: { fontSize: 9, alignment: "center", margin: [0, 0, 0, 10] },
      footer: { fontSize: 8, color: "#6b7280", alignment: "right", margin: [0, 8, 0, 0] },
    },
    content: [
      { text: "Dynamic Coaching Center", style: "title" },
      { text: "Smart Attendance Report", style: "subtitle" },
      {
        text: [
          { text: "Date Range: ", bold: true },
          `${normalizeText(data.startDate)} - ${normalizeText(data.endDate)}   `,
          { text: "Class: ", bold: true },
          normalizeText(batchName, "All Batches"),
        ],
        style: "meta",
      },
      {
        table: {
          headerRows: 1,
          widths: ["5%", "11%", "22%", "11%", "11%", "19%", "11%", "10%"],
          body: [header, ...reportRows(data)],
        },
        layout: {
          fillColor: (rowIndex: number) => (rowIndex === 0 ? "#f3f4f6" : undefined),
          hLineColor: () => "#d1d5db",
          vLineColor: () => "#d1d5db",
          paddingLeft: () => 4,
          paddingRight: () => 4,
          paddingTop: () => 4,
          paddingBottom: () => 4,
        },
      },
      { text: "Generated by Dynamic Coaching Center", style: "footer" },
    ],
  };
}

export async function renderAttendancePdf(
  data: AttendancePdfData,
  batchName: string,
): Promise<Buffer> {
  const fonts = await getFontData();
  configureFonts(fonts);
  return pdfMake.createPdf(buildDocument(data, batchName)).getBuffer();
}