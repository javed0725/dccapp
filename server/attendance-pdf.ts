import { access, readFile } from "fs/promises";
import { existsSync } from "fs";
import { execFileSync } from "child_process";
import path from "path";
import puppeteer from "puppeteer";

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

const escapeHtml = (value: unknown, fallback = "") =>
  normalizeText(value, fallback)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

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
  return parts.length === 3 ? `${parts[2]}-${parts[1]}-${parts[0].slice(-2)}` : normalizeText(value);
}

function reportRows(data: AttendancePdfData): string {
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
    return `<tr><td colspan="8" class="empty">No attendance records</td></tr>`;
  }

  return rows
    .map(
      (row, index) => `
        <tr>
          <td class="center">${index + 1}</td>
          <td class="center">${escapeHtml(row.id, "—")}</td>
          <td>${escapeHtml(row.name, "—")}</td>
          <td class="center">${escapeHtml(row.date)}</td>
          <td class="center">${escapeHtml(row.weekday, "—")}</td>
          <td>${escapeHtml(row.subject)}</td>
          <td class="center ${row.status === "PRESENT" ? "present" : "absent"}">${escapeHtml(row.status)}</td>
          <td class="center">${escapeHtml(row.punch)}</td>
        </tr>`,
    )
    .join("");
}

function buildHtml(data: AttendancePdfData, batchName: string, fonts: { regular: string; bold: string }) {
  return `<!doctype html>
<html lang="bn">
  <head>
    <meta charset="UTF-8" />
    <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
    <style>
      @font-face {
        font-family: "Noto Sans Bengali";
        src: url("data:font/ttf;base64,${fonts.regular}") format("truetype");
        font-weight: 400;
        font-style: normal;
        font-display: block;
      }
      @font-face {
        font-family: "Noto Sans Bengali";
        src: url("data:font/ttf;base64,${fonts.bold}") format("truetype");
        font-weight: 700;
        font-style: normal;
        font-display: block;
      }

      @page { size: A4 portrait; margin: 10mm; }
      * {
        box-sizing: border-box;
        font-family: "Noto Sans Bengali", sans-serif !important;
        font-feature-settings: "kern", "liga", "clig", "calt";
        font-kerning: normal;
        font-variant-ligatures: common-ligatures;
        text-rendering: optimizeLegibility;
      }
      html, body {
        margin: 0;
        padding: 0;
        color: #111827;
        background: #fff;
        font-size: 9px;
        line-height: 1.35;
        -webkit-font-smoothing: antialiased;
      }
      h1 { margin: 0 0 3px; text-align: center; font-size: 18px; font-weight: 700; }
      h2 { margin: 0 0 12px; text-align: center; font-size: 10px; font-weight: 400; }
      .meta { text-align: center; margin-bottom: 12px; }
      .meta span { font-weight: 700; }
      table { width: 100%; border-collapse: collapse; table-layout: fixed; }
      th, td {
        border: 1px solid #d1d5db;
        padding: 4px 5px;
        vertical-align: middle;
        overflow-wrap: anywhere;
        word-break: normal;
      }
      th { background: #f3f4f6; font-size: 8px; font-weight: 700; text-align: center; }
      td { font-size: 8px; }
      .center { text-align: center; }
      .present { color: #166534; font-weight: 700; }
      .absent { color: #991b1b; font-weight: 700; }
      .empty { padding: 18px; text-align: center; }
      .footer { margin-top: 8px; color: #6b7280; text-align: right; font-size: 8px; }
    </style>
  </head>
  <body>
    <h1>Dynamic Coaching Center</h1>
    <h2>Smart Attendance Report</h2>
    <div class="meta">
      <p><span>Date Range:</span> ${escapeHtml(data.startDate)} - ${escapeHtml(data.endDate)}</p>
      <p><span>Class:</span> ${escapeHtml(batchName, "All Batches")}</p>
    </div>
    <table>
      <colgroup>
        <col style="width: 5%" /><col style="width: 11%" /><col style="width: 22%" />
        <col style="width: 11%" /><col style="width: 11%" /><col style="width: 19%" />
        <col style="width: 11%" /><col style="width: 10%" />
      </colgroup>
      <thead>
        <tr>
          <th>#</th><th>Student ID</th><th>Student Name</th><th>Date</th>
          <th>Day</th><th>Subject</th><th>Status</th><th>Punch Time</th>
        </tr>
      </thead>
      <tbody>${reportRows(data)}</tbody>
    </table>
    <p class="footer">Generated by Dynamic Coaching Center</p>
  </body>
</html>`;
}

function chromiumExecutable(): string {
  const candidates = [
    process.env.PUPPETEER_EXECUTABLE_PATH?.trim(),
    (() => {
      try {
        return execFileSync(
          "sh",
          ["-lc", "command -v chromium || command -v chromium-browser || command -v google-chrome || true"],
          { encoding: "utf8" },
        ).trim();
      } catch {
        return "";
      }
    })(),
    puppeteer.executablePath(),
  ];
  const executable = candidates.find((candidate) => candidate && existsSync(candidate));
  if (!executable) throw new Error("Chromium executable not found");
  return executable;
}

export async function renderAttendancePdf(
  data: AttendancePdfData,
  batchName: string,
): Promise<Buffer> {
  const fonts = await getFontData();
  const browser = await puppeteer.launch({
    headless: true,
    executablePath: chromiumExecutable(),
    timeout: 30_000,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--no-first-run",
      "--no-zygote",
      "--font-render-hinting=medium",
      "--enable-font-antialiasing",
      "--disable-gpu",
      "--lang=bn-BD",
      "--force-color-profile=srgb",
    ],
  });

  let page: Awaited<ReturnType<typeof browser.newPage>> | undefined;
  let stage = "creating page";
  try {
    page = await browser.newPage();
    stage = "setting UTF-8 HTML content";
    page.setDefaultNavigationTimeout(30_000);
    page.setDefaultTimeout(30_000);
    await page.setContent(buildHtml(data, batchName, fonts), {
      waitUntil: "domcontentloaded",
      timeout: 30_000,
    });
    stage = "loading embedded Bengali fonts";
    await page.evaluate(async () => {
      await document.fonts.ready;
      if (!document.fonts.check('16px "Noto Sans Bengali"')) {
        throw new Error("Embedded Noto Sans Bengali font failed to load");
      }
    });
    stage = "generating PDF";
    return Buffer.from(
      await page.pdf({
        format: "A4",
        printBackground: true,
        preferCSSPageSize: true,
        displayHeaderFooter: false,
        timeout: 0,
      }),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Attendance PDF ${stage} failed: ${message}`, { cause: error });
  } finally {
    await page?.close().catch(() => undefined);
    await browser.close().catch(() => undefined);
  }
}