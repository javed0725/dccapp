import { useState, useMemo, useEffect, useRef, type CSSProperties, type RefObject } from "react";
import { Layout } from "@/components/Layout";
import { useStudents, useBatches } from "@/hooks/use-finance";
import { useQuery } from "@tanstack/react-query";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { type User } from "@/lib/schemas";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { CalendarDays, CloudDownload, Download, Fingerprint, Loader2, Search, X, SlidersHorizontal, BookOpen, CheckCircle2, XCircle, Percent, Moon } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

type ZktecoLogRow = {
  id: number;
  deviceUserId: string;
  deviceId: string;
  punchTime: string;
  createdAt: string;
};

type DisplayRow =
  | { kind: "present";  log: ZktecoLogRow; match: { name: string; kind: "student" | "staff"; batchId?: number; group?: string; shift?: string } }
  | { kind: "unlinked"; log: ZktecoLogRow }
  | { kind: "absent";   studentId: string; name: string; group?: string; shift?: string };

type SmartStudentRow = {
  studentId: number;
  studentCustomId: string;
  name: string;
  group: string | null;
  shift: string | null;
  status: "Present" | "Absent";
  punchTime: string | null;
};

type SmartSlot = {
  routineId: number;
  subject: string;
  startTime: string;
  endTime: string;
  isOffDay: boolean;
  shift: string | null;
  academicGroup: string | null;
  presentCount: number;
  absentCount: number;
  students: SmartStudentRow[];
};

type SmartDayResult = {
  date: string;
  dayOfWeek: string;
  offDay: boolean;
  noRoutine: boolean;
  slots: SmartSlot[];
};

type MultiSmartAttendanceResponse = {
  startDate: string;
  endDate: string;
  batchId: number;
  days: SmartDayResult[];
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const todayISO = () => new Date().toISOString().slice(0, 10);

const PRESETS = [
  { id: "today",     label: "Today" },
  { id: "yesterday", label: "Yesterday" },
  { id: "week",      label: "This Week" },
  { id: "month",     label: "This Month" },
] as const;

function getPresetRange(preset: string): { from: string; to: string } {
  const today = new Date();
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  switch (preset) {
    case "today":
      return { from: iso(today), to: iso(today) };
    case "yesterday": {
      const y = new Date(today);
      y.setDate(y.getDate() - 1);
      return { from: iso(y), to: iso(y) };
    }
    case "week": {
      const mon = new Date(today);
      mon.setDate(today.getDate() - (today.getDay() === 0 ? 6 : today.getDay() - 1));
      return { from: iso(mon), to: iso(today) };
    }
    case "month": {
      const first = new Date(today.getFullYear(), today.getMonth(), 1);
      return { from: iso(first), to: iso(today) };
    }
    default:
      return { from: iso(today), to: iso(today) };
  }
}

function activePreset(from: string, to: string): string | null {
  for (const p of PRESETS) {
    const r = getPresetRange(p.id);
    if (r.from === from && r.to === to) return p.id;
  }
  return null;
}

function fmtPunchTime(isoStr: string): string {
  return new Date(isoStr).toLocaleTimeString("en-US", {
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    hour12: true, timeZone: "Asia/Dhaka",
  });
}

function sanitizeReportPart(value: string, fallback = "Report"): string {
  const cleaned = value
    .normalize("NFKD")
    .replace(/[^\w\u0980-\u09FF-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_");
  return cleaned || fallback;
}

function reportTimestamp(): string {
  return new Date().toLocaleString("sv-SE", {
    timeZone: "Asia/Dhaka",
    hour12: false,
  }).replace("T", " ");
}

function reportDateLabel(date: string): string {
  return new Date(`${date}T12:00:00`).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function reportWeekday(date: string): string {
  return new Date(`${date}T12:00:00`).toLocaleDateString("en-US", {
    weekday: "long",
  });
}

function reportShortDate(date: string): string {
  const [year, month, day] = date.split("-");
  return `${day}-${month}-${year.slice(-2)}`;
}

function SmartAttendancePrintReport({
  data,
  batchName,
  startDate,
  endDate,
  shift,
  group,
  reportRef,
}: {
  data: MultiSmartAttendanceResponse;
  batchName: string;
  startDate: string;
  endDate: string;
  shift?: string;
  group?: string;
  reportRef: RefObject<HTMLDivElement>;
}) {
  const activeDays = data.days.filter((day) => !day.noRoutine && !day.offDay);
  const sessions = activeDays.flatMap((day) =>
    day.slots
      .filter((slot) => !slot.isOffDay)
      .map((slot) => ({ day, slot })),
  );
  const totalPresent = sessions.reduce((sum, { slot }) => sum + slot.presentCount, 0);
  const totalAbsent = sessions.reduce((sum, { slot }) => sum + slot.absentCount, 0);
  const totalRecords = totalPresent + totalAbsent;
  const attendanceRate = totalRecords > 0 ? Math.round((totalPresent / totalRecords) * 100) : 0;
  const subjects = Array.from(new Set(sessions.map(({ slot }) => slot.subject).filter(Boolean)));
  const timeWindows = Array.from(new Set(
    sessions
      .map(({ slot }) => slot.startTime || slot.endTime ? `${slot.startTime || "—"} – ${slot.endTime || "—"}` : "")
      .filter(Boolean),
  ));
  const isMultiDay = startDate !== endDate;
  const consolidatedRows = sessions.flatMap(({ day, slot }) =>
    slot.students.map((student, index) => ({
      key: `${day.date}-${slot.routineId}-${student.studentCustomId}-${index}`,
      day,
      slot,
      student,
    })),
  );

  const cellStyle: CSSProperties = {
    border: "1px solid #E5E7EB",
    padding: "10px 12px",
    fontSize: "14px",
    lineHeight: 1.35,
  };

  return (
    <div
      ref={reportRef}
      aria-hidden="true"
      data-testid="attendance-print-report"
      className="utf8-text-support"
      style={{
        position: "absolute",
        left: "-10000px",
        top: 0,
        width: "1000px",
        maxWidth: "1000px",
        margin: "0 auto",
        padding: "30px",
        background: "#F9FAFB",
        color: "#111827",
        fontFamily: "'Kalpurush', 'Noto Sans Bengali', 'Noto Sans Bengali UI', 'Vrinda', sans-serif",
        boxSizing: "border-box",
      }}
    >
      <div style={{
        width: "100%",
        padding: "22px 24px 24px",
        border: "1px solid #DDD6FE",
        borderRadius: "14px",
        background: "linear-gradient(135deg, #EDE9FE 0%, #FFFFFF 72%)",
        boxShadow: "0 4px 14px rgba(45, 54, 131, 0.08)",
        boxSizing: "border-box",
      }}>
        <div style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: "20px",
        }}>
          <div style={{
            color: "#2D3683",
            fontFamily: "Georgia, 'Times New Roman', serif",
            fontSize: "24px",
            fontWeight: 700,
            lineHeight: 1.2,
          }}>
            Dynamic Coaching Center
          </div>
          <div style={{
            color: "#4B5563",
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
            fontSize: "11px",
            lineHeight: 1.4,
            textAlign: "right",
            whiteSpace: "nowrap",
          }}>
            Generated: {reportTimestamp()}
          </div>
        </div>

        <div style={{ textAlign: "center", marginTop: "12px" }}>
          <div style={{
            color: "#111827",
            fontFamily: "Arial, Helvetica, sans-serif",
            fontSize: "16px",
            fontWeight: 700,
            lineHeight: 1.3,
          }}>
            Smart Attendance Report
          </div>
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
            gap: 0,
            margin: "12px auto 0",
            maxWidth: "860px",
            border: "1px solid #A1A1AA",
            borderRadius: "10px",
            background: "rgba(255, 255, 255, 0.82)",
            textAlign: "left",
            overflow: "hidden",
            fontSize: "13px",
            lineHeight: 1.35,
          }}>
            <div style={{ padding: "9px 12px", borderRight: "1px solid #D1D5DB" }}>
              <div style={{ color: "#374151", fontWeight: 700 }}>Class / Batch:</div>
              <div style={{ color: "#111827", marginTop: "3px", fontWeight: 800 }}>{batchName || "All Batches"}</div>
            </div>
            <div style={{ padding: "9px 12px", borderRight: "1px solid #D1D5DB" }}>
              <div style={{ color: "#374151", fontWeight: 700 }}>Subject:</div>
              <div className="utf8-text-support" style={{ color: "#111827", marginTop: "3px", fontWeight: 800 }}>
                {subjects.length > 0 ? subjects.join(" · ") : "বাংলাদেশ ও বিশ্বপরিচয়"}
              </div>
            </div>
            <div style={{ padding: "9px 12px", borderRight: "1px solid #D1D5DB" }}>
              <div style={{ color: "#374151", fontWeight: 700 }}>Date Range:</div>
              <div style={{ color: "#111827", marginTop: "3px", fontWeight: 800 }}>
                {startDate}{startDate !== endDate ? ` → ${endDate}` : ""}
              </div>
            </div>
            <div style={{ padding: "9px 12px" }}>
              <div style={{ color: "#374151", fontWeight: 700 }}>Time Window:</div>
              <div style={{ color: "#111827", marginTop: "3px", fontWeight: 800 }}>
                {timeWindows.length > 0 ? timeWindows.join(" · ") : "All scheduled times"}
              </div>
            </div>
            {(shift || group) && (
              <div style={{ gridColumn: "1 / -1", padding: "7px 12px", borderTop: "1px solid #D1D5DB" }}>
                {shift && <><span style={{ color: "#6B7280", fontWeight: 700 }}>Shift: </span>{shift}</>}
                {shift && group && "  ·  "}
                {group && <><span style={{ color: "#6B7280", fontWeight: 700 }}>Group: </span>{group}</>}
              </div>
            )}
          </div>
        </div>
      </div>

      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
        gap: "12px",
        marginTop: "18px",
        textAlign: "center",
      }}>
        <div style={{
          minHeight: isMultiDay ? "104px" : "88px",
          padding: "11px 13px",
          borderRadius: "12px",
          background: "#8DC8C7",
          color: "#064E4E",
          boxShadow: "0 7px 12px rgba(15, 23, 42, 0.16)",
          boxSizing: "border-box",
          textAlign: "left",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "12px", lineHeight: 1.2 }}>
            <span>Total<br />Present:</span>
            <CheckCircle2 style={{ width: "16px", height: "16px", color: "#FFFFFF", background: "rgba(6, 78, 78, 0.25)", borderRadius: "50%", padding: "2px" }} />
          </div>
          <div style={{ marginTop: "5px", fontSize: isMultiDay ? "29px" : "26px", fontWeight: 800, lineHeight: 1 }}>{totalPresent}</div>
        </div>
        <div style={{
          minHeight: isMultiDay ? "104px" : "88px",
          padding: "11px 13px",
          borderRadius: "12px",
          background: "#D99AA0",
          color: "#7F1D1D",
          boxShadow: "0 7px 12px rgba(15, 23, 42, 0.16)",
          boxSizing: "border-box",
          textAlign: "left",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "12px", lineHeight: 1.2 }}>
            <span>Total<br />Absent:</span>
            <XCircle style={{ width: "16px", height: "16px", color: "#FFFFFF", background: "rgba(127, 29, 29, 0.22)", borderRadius: "50%", padding: "2px" }} />
          </div>
          <div style={{ marginTop: "5px", fontSize: isMultiDay ? "29px" : "26px", fontWeight: 800, lineHeight: 1 }}>{totalAbsent}</div>
        </div>
        <div style={{
          minHeight: isMultiDay ? "104px" : "88px",
          padding: "11px 13px",
          borderRadius: "12px",
          background: "#7D80C3",
          color: "#1E1B4B",
          boxShadow: "0 7px 12px rgba(15, 23, 42, 0.16)",
          boxSizing: "border-box",
          textAlign: "left",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "12px", lineHeight: 1.2 }}>
            <span>Attendance<br />Rate:</span>
            <Percent style={{ width: "16px", height: "16px", color: "#FFFFFF", background: "rgba(30, 27, 75, 0.25)", borderRadius: "50%", padding: "2px" }} />
          </div>
          <div style={{ marginTop: "5px", fontSize: isMultiDay ? "29px" : "26px", fontWeight: 800, lineHeight: 1 }}>{attendanceRate}%</div>
        </div>
        <div style={{
          minHeight: isMultiDay ? "104px" : "88px",
          padding: "11px 13px",
          borderRadius: "12px",
          background: "#E5E7EB",
          color: "#111827",
          boxShadow: "0 7px 12px rgba(15, 23, 42, 0.16)",
          boxSizing: "border-box",
          textAlign: "left",
        }}>
          <div style={{ fontSize: "15px", fontWeight: 800, lineHeight: 1.2 }}>
            {isMultiDay ? `${reportShortDate(startDate)} – ${reportShortDate(endDate)}` : reportDateLabel(startDate)}
          </div>
          <div style={{ marginTop: "3px", fontSize: "12px", lineHeight: 1.25, fontWeight: 700 }}>
            {isMultiDay ? `${activeDays.length} class days` : reportWeekday(startDate)}
          </div>
          <div className="utf8-text-support" style={{ marginTop: "3px", fontSize: "12px", lineHeight: 1.25 }}>
            {subjects[0] || "Smart Attendance"}
          </div>
          <div style={{ marginTop: "3px", fontSize: "10px", lineHeight: 1.2 }}>
            {timeWindows[0] || "All scheduled times"}
          </div>
        </div>
      </div>

      {isMultiDay ? (
        <div style={{ marginTop: "24px" }}>
          <div style={{
            color: "#2D3683",
            fontSize: "16px",
            fontWeight: 800,
            marginBottom: "9px",
            textAlign: "center",
          }}>
            Consolidated Attendance · {reportShortDate(startDate)} – {reportShortDate(endDate)}
          </div>
          <div style={{ width: "100%", overflow: "hidden", border: "1px solid #334155", borderRadius: "10px" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
              <colgroup>
                <col style={{ width: "45px" }} />
                <col style={{ width: "110px" }} />
                <col style={{ width: "190px" }} />
                <col style={{ width: "100px" }} />
                <col style={{ width: "75px" }} />
                <col style={{ width: "160px" }} />
                <col style={{ width: "125px" }} />
                <col style={{ width: "125px" }} />
              </colgroup>
              <thead>
                <tr style={{ background: "#4F46E5", color: "#FFFFFF" }}>
                  {["#", "Student ID", "Student Name", "Date", "Day", "Subject", "Status", "Punch Time"].map((heading) => (
                    <th
                      key={heading}
                      style={{
                        ...cellStyle,
                        borderColor: "#334155",
                        fontSize: "14px",
                        fontWeight: 800,
                        textAlign: heading === "Student Name" ? "left" : "center",
                      }}
                    >
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {consolidatedRows.map(({ key, day, slot, student }, index) => (
                  <tr key={key} style={{ background: index % 2 === 1 ? "#F9FAFB" : "#FFFFFF" }}>
                    <td style={{ ...cellStyle, borderColor: "#64748B", textAlign: "center" }}>{index + 1}</td>
                    <td style={{ ...cellStyle, borderColor: "#64748B", textAlign: "center", fontFamily: "Arial, Helvetica, sans-serif", fontWeight: 800 }}>
                      {student.studentCustomId}
                    </td>
                    <td style={{ ...cellStyle, borderColor: "#64748B", textAlign: "left", fontWeight: 600 }}>
                      {student.name}
                    </td>
                    <td style={{ ...cellStyle, borderColor: "#64748B", textAlign: "center", fontWeight: 700, whiteSpace: "nowrap" }}>
                      {reportShortDate(day.date)}
                    </td>
                    <td style={{ ...cellStyle, borderColor: "#64748B", textAlign: "center", fontWeight: 600 }}>
                      {day.dayOfWeek.slice(0, 3)}
                    </td>
                    <td className="utf8-text-support" style={{ ...cellStyle, borderColor: "#64748B", textAlign: "center", fontWeight: 600 }}>
                      {slot.subject || "—"}
                    </td>
                    <td style={{ ...cellStyle, borderColor: "#64748B", textAlign: "center" }}>
                      <span style={{
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "4px",
                        borderRadius: "999px",
                        padding: "5px 8px",
                        fontSize: "12px",
                        fontWeight: 800,
                        whiteSpace: "nowrap",
                        background: student.status === "Present" ? "#14B8A6" : "#E11D48",
                        color: "#FFFFFF",
                      }}>
                        {student.status === "Present"
                          ? <CheckCircle2 style={{ width: "13px", height: "13px" }} />
                          : <XCircle style={{ width: "13px", height: "13px" }} />}
                        [{student.status}]
                      </span>
                    </td>
                    <td style={{ ...cellStyle, borderColor: "#64748B", textAlign: "center", fontFamily: "Arial, Helvetica, sans-serif", whiteSpace: "nowrap" }}>
                      {student.punchTime ? fmtPunchTime(student.punchTime) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : sessions.map(({ day, slot }, sessionIndex) => (
        <div key={`${day.date}-${slot.routineId}-${sessionIndex}`} style={{ marginTop: "22px" }}>
          <div style={{ color: "#4338CA", fontSize: "14px", fontWeight: 800, marginBottom: "8px", textAlign: "center" }}>
            {reportDateLabel(day.date)} · {day.dayOfWeek} · {slot.subject || "Class"}
            {(slot.startTime || slot.endTime) && ` · ${slot.startTime || "—"} – ${slot.endTime || "—"}`}
          </div>
          <div style={{ width: "100%", overflow: "hidden", border: "1px solid #334155", borderRadius: "10px" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
            <colgroup>
              <col style={{ width: "45px" }} />
              <col style={{ width: "130px" }} />
              <col />
              <col style={{ width: "145px" }} />
              <col style={{ width: "110px" }} />
            </colgroup>
            <thead>
              <tr style={{ background: "#4F46E5", color: "#FFFFFF" }}>
                {["#", "Student ID", "Student Name", "Punch Time", "Status"].map((heading) => (
                  <th key={heading} style={{ ...cellStyle, borderColor: "#334155", fontSize: "14px", fontWeight: 800, textAlign: heading === "Student Name" ? "left" : "center" }}>
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {slot.students.map((student, index) => (
                <tr key={`${student.studentCustomId}-${index}`} style={{ background: index % 2 === 1 ? "#F9FAFB" : "#FFFFFF" }}>
                   <td style={{ ...cellStyle, borderColor: "#64748B", textAlign: "center" }}>{index + 1}</td>
                   <td style={{ ...cellStyle, borderColor: "#64748B", textAlign: "center", fontFamily: "monospace", fontWeight: 700 }}>{student.studentCustomId}</td>
                   <td style={{ ...cellStyle, borderColor: "#64748B", textAlign: "left" }}>{student.name}</td>
                   <td style={{ ...cellStyle, borderColor: "#64748B", textAlign: "center", fontFamily: "monospace" }}>
                    {student.punchTime ? fmtPunchTime(student.punchTime) : "—"}
                  </td>
                   <td style={{ ...cellStyle, borderColor: "#64748B", textAlign: "center" }}>
                    <span style={{
                       display: "inline-flex",
                       alignItems: "center",
                       justifyContent: "center",
                       gap: "4px",
                      borderRadius: "999px",
                       padding: "5px 9px",
                       fontSize: "12px",
                      fontWeight: 800,
                       whiteSpace: "nowrap",
                       background: student.status === "Present" ? "#14B8A6" : "#E11D48",
                       color: "#FFFFFF",
                    }}>
                       {student.status === "Present"
                         ? <CheckCircle2 style={{ width: "13px", height: "13px" }} />
                         : <XCircle style={{ width: "13px", height: "13px" }} />}
                       [{student.status}]
                    </span>
                  </td>
                </tr>
              ))}
             </tbody>
           </table>
           </div>
        </div>
       ))}
    </div>
  );
}

function SmartAttendanceExport({
  batchId,
  startDate,
  endDate,
  batchName,
  shift,
  group,
}: {
  batchId: string;
  startDate: string;
  endDate: string;
  batchName: string;
  shift?: string;
  group?: string;
}) {
  const reportRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);
  const { data } = useQuery<MultiSmartAttendanceResponse>({
    queryKey: ["/api/attendance/smart", batchId, startDate, endDate, shift ?? "", group ?? ""],
    queryFn: async () => {
      const params = new URLSearchParams({ batchId, startDate, endDate });
      if (shift) params.set("shift", shift);
      if (group) params.set("group", group);
      const res = await fetch(`/api/attendance/smart?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to load smart attendance");
      return res.json();
    },
    staleTime: 30_000,
  });

  const downloadReport = async (format: "pdf" | "png") => {
    if (!data || !reportRef.current) return;
    setIsExporting(true);
    try {
      if (document.fonts?.ready) await document.fonts.ready;
      const canvas = await html2canvas(reportRef.current, {
        backgroundColor: "#F9FAFB",
        useCORS: true,
        allowTaint: true,
        scale: 2,
        imageTimeout: 0,
        logging: false,
      });
      const fileBase = `Attendance_Report_${sanitizeReportPart(batchName, "Class")}_${sanitizeReportPart(
        Array.from(new Set(data.days.flatMap((day) => day.slots.map((slot) => slot.subject).filter(Boolean)))).join("-"),
        "Attendance",
      )}_${startDate}`;

      if (format === "png") {
        const link = document.createElement("a");
        link.download = `${fileBase}.png`;
        link.href = canvas.toDataURL("image/png");
        link.click();
      } else {
        const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
        const margin = 8;
        const pageWidth = 210 - margin * 2;
        const pageHeight = 297 - margin * 2;
        const imageHeight = (canvas.height * pageWidth) / canvas.width;
        let remainingHeight = imageHeight;
        let y = margin;
        pdf.addImage(canvas.toDataURL("image/png"), "PNG", margin, y, pageWidth, imageHeight, undefined, "FAST");
        remainingHeight -= pageHeight;
        while (remainingHeight > 0) {
          y = margin - (imageHeight - remainingHeight);
          pdf.addPage();
          pdf.addImage(canvas.toDataURL("image/png"), "PNG", margin, y, pageWidth, imageHeight, undefined, "FAST");
          remainingHeight -= pageHeight;
        }
        pdf.save(`${fileBase}.pdf`);
      }
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="relative h-9 gap-2 overflow-hidden border-indigo-200 bg-indigo-50/60 px-3 text-xs font-semibold text-indigo-700 shadow-sm transition hover:bg-indigo-100"
            disabled={isExporting || !data}
            data-testid="button-download-attendance-report"
          >
            {!isExporting && <span className="absolute inset-0 animate-pulse rounded-md bg-indigo-200/25" aria-hidden="true" />}
            <span className="relative flex items-center gap-2">
              {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CloudDownload className="w-4 h-4" />}
              {isExporting ? "Preparing…" : "Download Report"}
            </span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => void downloadReport("pdf")} data-testid="menu-download-attendance-pdf">
            <Download className="w-4 h-4 mr-2" /> Generate Premium PDF
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => void downloadReport("png")} data-testid="menu-download-attendance-image">
            <Download className="w-4 h-4 mr-2" /> Generate High-Resolution Image
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {data && (
        <SmartAttendancePrintReport
          data={data}
          batchName={batchName}
          startDate={startDate}
          endDate={endDate}
          shift={shift}
          group={group}
          reportRef={reportRef}
        />
      )}
    </>
  );
}

// ── Slot card (shared between single-day and multi-day views) ─────────────────

function SmartSlotCard({ slot }: { slot: SmartSlot }) {
  if (slot.isOffDay) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50/60 px-5 py-4 flex items-center gap-3">
        <Moon className="w-5 h-5 text-amber-500 shrink-0" />
        <div>
          <p className="font-semibold text-amber-700 text-sm">
            {slot.subject || "Off Day"} — {slot.startTime}{slot.endTime ? ` – ${slot.endTime}` : ""}
          </p>
          <p className="text-xs text-amber-600 mt-0.5">This slot is marked as an off-day.</p>
        </div>
      </div>
    );
  }

  const total = slot.students.length;
  const pct   = total > 0 ? Math.round((slot.presentCount / total) * 100) : 0;

  return (
    <div className="rounded-xl border border-slate-200 overflow-hidden shadow-sm">
      {/* Slot header */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-slate-200">
        <div className="flex items-center gap-2.5 min-w-0 flex-wrap">
          <BookOpen className="w-4 h-4 text-blue-600 shrink-0" />
          <span className="font-semibold text-slate-800 text-sm truncate">
            {slot.subject || <span className="italic text-slate-400">No subject</span>}
          </span>
          {(slot.startTime || slot.endTime) && (
            <span className="text-xs text-slate-400 font-mono shrink-0">
              {slot.startTime}{slot.endTime ? ` – ${slot.endTime}` : ""}
            </span>
          )}
          {slot.shift && (
            <span className="inline-flex text-[10px] font-semibold px-1.5 py-0.5 rounded border border-blue-200 bg-blue-50 text-blue-700 shrink-0">
              {slot.shift}
            </span>
          )}
          {slot.academicGroup && (
            <span className="inline-flex text-[10px] font-semibold px-1.5 py-0.5 rounded border border-purple-200 bg-purple-50 text-purple-700 shrink-0">
              {slot.academicGroup}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200">
            🟢 {slot.presentCount} Present
          </span>
          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 border border-rose-200">
            🔴 {slot.absentCount} Absent
          </span>
          <span className="text-xs text-slate-400 font-mono tabular-nums">{pct}%</span>
        </div>
      </div>

      {/* Student rows */}
      {slot.students.length === 0 ? (
        <div className="px-5 py-8 text-center text-sm text-slate-400 italic">
          No active students found in this batch.
        </div>
      ) : (
        <div className="divide-y divide-slate-100">
          {slot.students.map((student) => (
            <div
              key={student.studentCustomId}
              className={`grid grid-cols-[1fr_auto_auto] sm:grid-cols-[auto_1fr_auto_auto] items-center gap-x-3 px-4 py-2.5 transition-colors ${
                student.status === "Present"
                  ? "bg-emerald-50/30 hover:bg-emerald-50/60"
                  : "bg-rose-50/20 hover:bg-rose-50/50"
              }`}
            >
              <span className="hidden sm:inline-flex font-mono text-[11px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded shrink-0">
                {student.studentCustomId}
              </span>
              <div className="min-w-0">
                <span className="text-sm font-medium text-slate-800 truncate block leading-snug">
                  {student.name}
                </span>
                <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                  <span className="sm:hidden font-mono text-[10px] text-slate-400">{student.studentCustomId}</span>
                  {student.group && (
                    <Badge variant="outline" className="text-[9px] h-3.5 px-1 border-purple-200 text-purple-600 bg-purple-50">
                      {student.group}
                    </Badge>
                  )}
                  {student.shift && (
                    <Badge variant="outline" className="text-[9px] h-3.5 px-1 border-blue-200 text-blue-600 bg-blue-50">
                      {student.shift}
                    </Badge>
                  )}
                </div>
              </div>
              <div className="text-right shrink-0">
                {student.punchTime ? (
                  <span className="text-xs font-mono font-semibold text-emerald-700 tabular-nums">
                    {fmtPunchTime(student.punchTime)}
                  </span>
                ) : (
                  <span className="text-xs text-slate-300 font-mono">—</span>
                )}
              </div>
              <div className="shrink-0">
                {student.status === "Present" ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200">
                    🟢 Present
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 border border-rose-200">
                    🔴 Absent
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Smart View Sub-component ──────────────────────────────────────────────────

function SmartAttendanceView({
  batchId,
  startDate,
  endDate,
  batchName,
  shift,
  group,
}: {
  batchId: string;
  startDate: string;
  endDate: string;
  batchName: string;
  shift?: string;
  group?: string;
}) {
  const { data, isLoading, isError } = useQuery<MultiSmartAttendanceResponse>({
    queryKey: ["/api/attendance/smart", batchId, startDate, endDate, shift ?? "", group ?? ""],
    queryFn: async () => {
      const params = new URLSearchParams({ batchId, startDate, endDate });
      if (shift) params.set("shift", shift);
      if (group) params.set("group", group);
      const res = await fetch(`/api/attendance/smart?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to load smart attendance");
      return res.json();
    },
    staleTime: 30_000,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 py-12 text-slate-400">
        <Loader2 className="w-5 h-5 animate-spin" />
        <span className="text-sm">Analysing biometric logs against class routine…</span>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="py-10 text-center text-sm text-slate-400">
        Could not load smart attendance. Check that the server is running.
      </div>
    );
  }

  // ── Aggregate summary across all days ─────────────────────────────────────
  const activeDays = data.days.filter(d => !d.noRoutine && !d.offDay);
  const totalSlots = activeDays.reduce(
    (n, d) => n + d.slots.filter(s => !s.isOffDay).length, 0
  );
  const totalPresent = activeDays.reduce(
    (n, d) => n + d.slots.filter(s => !s.isOffDay).reduce((m, s) => m + s.presentCount, 0), 0
  );
  const totalAbsent = activeDays.reduce(
    (n, d) => n + d.slots.filter(s => !s.isOffDay).reduce((m, s) => m + s.absentCount, 0), 0
  );
  const totalRecords  = totalPresent + totalAbsent;
  const overallPct    = totalRecords > 0 ? Math.round((totalPresent / totalRecords) * 100) : null;

  const isMultiDay = startDate !== endDate;

  if (activeDays.length === 0) {
    const allOff   = data.days.every(d => d.offDay);
    const noSched  = data.days.every(d => d.noRoutine);
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3 text-slate-400">
        {allOff
          ? <Moon className="w-9 h-9 text-slate-300" />
          : <BookOpen className="w-9 h-9 opacity-25" />
        }
        <p className="text-sm font-medium text-center">
          {allOff
            ? `All days in this range are off-days for ${batchName}.`
            : noSched
            ? `No class routine found for ${batchName} in this date range.`
            : `No active class days in this range for ${batchName}.`
          }
        </p>
        {noSched && (
          <p className="text-xs text-slate-400">Go to Manage → Class Shift &amp; Routine to add a schedule.</p>
        )}
      </div>
    );
  }

  // ── Format helper for section date headers ────────────────────────────────
  const fmtDateHeader = (ds: string, dow: string) =>
    `${dow}, ${new Date(ds + "T12:00:00").toLocaleDateString("en-GB", {
      day: "numeric", month: "short", year: "numeric",
    })}`;

  return (
    <div className="space-y-6">

      {/* ── Aggregate summary bar (multi-day only) ────────────────────────── */}
      {isMultiDay && (
        <div className="flex flex-wrap items-center gap-3 px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-sm">
          <span className="font-semibold text-slate-700">
            {activeDays.length} class day{activeDays.length !== 1 ? "s" : ""}
          </span>
          <span className="text-slate-300">·</span>
          <span className="text-slate-600">{totalSlots} session{totalSlots !== 1 ? "s" : ""}</span>
          <span className="text-slate-300">·</span>
          <span className="inline-flex items-center gap-1 font-bold text-emerald-700">
            🟢 {totalPresent} present
          </span>
          <span className="inline-flex items-center gap-1 font-bold text-rose-700">
            🔴 {totalAbsent} absent
          </span>
          {overallPct !== null && (
            <>
              <span className="text-slate-300">·</span>
              <span className={`font-bold tabular-nums ${overallPct >= 75 ? "text-emerald-600" : overallPct >= 50 ? "text-amber-600" : "text-rose-600"}`}>
                {overallPct}% overall
              </span>
            </>
          )}
        </div>
      )}

      {/* ── Per-day sections ─────────────────────────────────────────────── */}
      {data.days.map((day) => {
        // Off-day: compact banner
        if (day.offDay) {
          return (
            <div key={day.date} className="flex items-center gap-3 px-4 py-3 rounded-lg border border-amber-200 bg-amber-50/60">
              <Moon className="w-4 h-4 text-amber-500 shrink-0" />
              <span className="text-sm font-medium text-amber-700">
                {fmtDateHeader(day.date, day.dayOfWeek)} — Off Day
              </span>
            </div>
          );
        }

        // No routine: skip silently in single-day mode; show compact note in multi-day
        if (day.noRoutine) {
          if (!isMultiDay) {
            return (
              <div key={day.date} className="flex flex-col items-center justify-center py-12 gap-3 text-slate-400">
                <BookOpen className="w-9 h-9 opacity-25" />
                <p className="text-sm font-medium">
                  No class routine set for <span className="font-bold text-slate-600">{batchName}</span> on {day.dayOfWeek}.
                </p>
                <p className="text-xs">Go to Manage → Class Shift &amp; Routine to add a schedule.</p>
              </div>
            );
          }
          return null; // silently skip in multi-day
        }

        const activeSlots = day.slots.filter(s => !s.isOffDay);

        return (
          <div key={day.date} className="space-y-3">
            {/* Date section header (multi-day only) */}
            {isMultiDay && (
              <div className="flex items-center gap-3">
                <div className="h-px flex-1 bg-slate-200" />
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wide px-2">
                  {fmtDateHeader(day.date, day.dayOfWeek)}
                </span>
                {activeSlots.length > 0 && (() => {
                  const dp = activeSlots.reduce((n, s) => n + s.presentCount, 0);
                  const da = activeSlots.reduce((n, s) => n + s.absentCount, 0);
                  const dr = dp + da;
                  const dpct = dr > 0 ? Math.round((dp / dr) * 100) : null;
                  return (
                    <span className={`text-[11px] font-semibold tabular-nums ${dpct !== null && dpct >= 75 ? "text-emerald-600" : dpct !== null && dpct >= 50 ? "text-amber-600" : "text-rose-600"}`}>
                      {dpct !== null ? `${dpct}%` : "—"}
                    </span>
                  );
                })()}
                <div className="h-px flex-1 bg-slate-200" />
              </div>
            )}

            {/* Slot cards for this day */}
            <div className="space-y-4">
              {day.slots.map((slot) => (
                <SmartSlotCard key={`${day.date}-${slot.routineId}`} slot={slot} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function Attendance() {
  const { data: user } = useQuery<User>({ queryKey: ["/api/user"] });
  const { data: batches = [] } = useBatches();
  const { data: students = [] } = useStudents();

  // ── Filter state ─────────────────────────────────────────────────────────
  const [fBatchId,    setFBatchId]    = useState<string>("");
  const [fGroup,      setFGroup]      = useState<string>("");
  const [fShift,      setFShift]      = useState<string>("");
  const [fFromDate,   setFFromDate]   = useState<string>(todayISO());
  const [fToDate,     setFToDate]     = useState<string>(todayISO());
  const [fStudentId,  setFStudentId]  = useState<string>("");
  const [studentSearch, setStudentSearch] = useState<string>("");

  // Smart view toggle — true = smart check, false = raw logs
  const [smartMode, setSmartMode] = useState<boolean>(true);

  // Smart view is available whenever a batch is selected (any date range)
  const smartEligible = !!fBatchId;

  // Cascade: batch change resets downstream filters
  useEffect(() => {
    setFGroup("");
    setFShift("");
    setFStudentId("");
    setStudentSearch("");
  }, [fBatchId]);

  // ── Derived filter options ────────────────────────────────────────────────
  const batchStudents = useMemo(
    () => (students || []).filter((s: any) => !fBatchId || String(s.batchId) === fBatchId),
    [students, fBatchId],
  );

  const availableGroups = useMemo(
    () => Array.from(new Set(batchStudents.map((s: any) => s.academicGroup).filter(Boolean))) as string[],
    [batchStudents],
  );

  const availableShifts = useMemo(
    () => Array.from(new Set(batchStudents.map((s: any) => s.shift).filter(Boolean))) as string[],
    [batchStudents],
  );

  // Students eligible for the student selector (respects group+shift)
  const selectorStudents = useMemo(
    () =>
      batchStudents
        .filter((s: any) => {
          if (fGroup && s.academicGroup !== fGroup) return false;
          if (fShift && s.shift !== fShift) return false;
          return true;
        })
        .sort((a: any, b: any) => parseInt(a.studentCustomId || "0") - parseInt(b.studentCustomId || "0")),
    [batchStudents, fGroup, fShift],
  );

  const filteredSelectorStudents = useMemo(() => {
    if (!studentSearch.trim()) return selectorStudents;
    const q = studentSearch.toLowerCase();
    return selectorStudents.filter(
      (s: any) => s.name?.toLowerCase().includes(q) || String(s.studentCustomId || "").toLowerCase().includes(q),
    );
  }, [selectorStudents, studentSearch]);

  // ── Teachers for name resolution ─────────────────────────────────────────
  const { data: teachers = [] } = useQuery<any[]>({
    queryKey: ["/api/teachers"],
    staleTime: 10 * 60_000,
  });

  // deviceUserId → display info (includes batch/group/shift for client-side filtering)
  const deviceUserMap = useMemo(() => {
    const map: Record<string, { name: string; kind: "student" | "staff"; batchId?: number; group?: string; shift?: string }> = {};
    (students || []).forEach((s: any) => {
      if (s.studentCustomId)
        map[String(s.studentCustomId)] = {
          name: s.name,
          kind: "student",
          batchId: s.batchId,
          group: s.academicGroup,
          shift: s.shift,
        };
    });
    (teachers || []).forEach((t: any) => {
      if (t.teacherId) map[String(t.teacherId)] = { name: t.name || t.username, kind: "staff" };
    });
    return map;
  }, [students, teachers]);

  // ── Fetch ZKTeco logs for the selected date range ─────────────────────────
  const { data: zkLogs = [], isLoading: zkLoading } = useQuery<ZktecoLogRow[]>({
    queryKey: ["/api/attendance/zkteco-logs", fFromDate, fToDate],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (fFromDate) params.set("from", fFromDate);
      if (fToDate)   params.set("to",   fToDate);
      const res = await fetch(`/api/attendance/zkteco-logs?${params.toString()}`);
      if (!res.ok) return [];
      return res.json();
    },
    staleTime: 60_000,
    enabled: !!fFromDate && !!fToDate,
  });

  // ── Client-side filter: batch / group / shift / student ──────────────────
  const filteredLogs = useMemo(() => {
    return [...zkLogs]
      .filter((log) => {
        if (fStudentId && log.deviceUserId !== fStudentId) return false;
        if (fBatchId || fGroup || fShift) {
          const match = deviceUserMap[log.deviceUserId];
          if (!match || match.kind !== "student") return fBatchId ? false : true;
          if (fBatchId && String(match.batchId) !== fBatchId) return false;
          if (fGroup  && match.group  !== fGroup)  return false;
          if (fShift  && match.shift  !== fShift)  return false;
        }
        return true;
      })
      .sort((a, b) => new Date(b.punchTime).getTime() - new Date(a.punchTime).getTime());
  }, [zkLogs, fStudentId, fBatchId, fGroup, fShift, deviceUserMap]);

  // ── Combined display rows: Present + Absent + Unlinked ───────────────────
  const displayRows = useMemo<DisplayRow[]>(() => {

    // ── CASE 1: Batch selected → grouped by student (roll-number order),
    //            all punches per student chronologically, absent students last ──
    if (fBatchId) {
      // 1a. Active roster filtered by group / shift / student
      const rosterStudents = (students as any[])
        .filter((s: any) => {
          if (s.isActive === false) return false;
          if (!s.studentCustomId) return false;
          if (String(s.batchId) !== fBatchId) return false;
          if (fGroup     && s.academicGroup !== fGroup) return false;
          if (fShift     && s.shift         !== fShift) return false;
          if (fStudentId && String(s.studentCustomId) !== fStudentId) return false;
          return true;
        })
        .sort((a: any, b: any) =>
          parseInt(a.studentCustomId || "0") - parseInt(b.studentCustomId || "0")
        );

      // 1b. Collect ALL punches per student from raw zkLogs
      const punchesByStudent = new Map<string, ZktecoLogRow[]>();
      for (const log of zkLogs) {
        const arr = punchesByStudent.get(log.deviceUserId) ?? [];
        arr.push(log);
        punchesByStudent.set(log.deviceUserId, arr);
      }

      // 1c. Emit one row per punch (chronological) per student; absent if no punches
      const rows: DisplayRow[] = [];
      for (const s of rosterStudents) {
        const sid = String(s.studentCustomId);
        const punches = (punchesByStudent.get(sid) ?? [])
          .sort((a, b) => new Date(a.punchTime).getTime() - new Date(b.punchTime).getTime());
        if (punches.length > 0) {
          for (const log of punches) {
            rows.push({
              kind: "present",
              log,
              match: {
                name: s.name,
                kind: "student",
                batchId: s.batchId,
                group: s.academicGroup,
                shift: s.shift,
              },
            });
          }
        } else {
          rows.push({
            kind: "absent",
            studentId: sid,
            name: s.name,
            group: s.academicGroup,
            shift: s.shift,
          });
        }
      }
      return rows;
    }

    // ── CASE 2: Specific student selected (no batch) → all punches, chrono ───
    if (fStudentId) {
      const student = (students as any[]).find(
        (s: any) => String(s.studentCustomId) === fStudentId
      );
      const punches = zkLogs
        .filter((l) => l.deviceUserId === fStudentId)
        .sort((a, b) => new Date(a.punchTime).getTime() - new Date(b.punchTime).getTime());

      if (punches.length > 0) {
        const mapEntry = deviceUserMap[fStudentId];
        const match = mapEntry ?? {
          name: student?.name ?? fStudentId,
          kind: "student" as const,
          batchId: student?.batchId,
          group: student?.academicGroup,
          shift: student?.shift,
        };
        return punches.map((log) => ({ kind: "present" as const, log, match }));
      }
      if (student) {
        return [{
          kind: "absent",
          studentId: fStudentId,
          name: student.name,
          group: student.academicGroup,
          shift: student.shift,
        }];
      }
      // Fallthrough: unrecognised ID
    }

    // ── CASE 3: No batch/student filter → grouped by person, groups ordered
    //            by each person's earliest punch (most-recent group first),
    //            punches within each group chronological ──────────────────────
    const groupMap = new Map<string, ZktecoLogRow[]>();
    for (const log of filteredLogs) {
      const arr = groupMap.get(log.deviceUserId) ?? [];
      arr.push(log);
      groupMap.set(log.deviceUserId, arr);
    }
    // Sort each group's punches chronologically (earliest first)
    for (const arr of Array.from(groupMap.values())) {
      arr.sort((a: ZktecoLogRow, b: ZktecoLogRow) => new Date(a.punchTime).getTime() - new Date(b.punchTime).getTime());
    }
    // Order groups by the most recent punch in each group (latest-active group first)
    const sortedGroups = Array.from(groupMap.entries()).sort(([, a], [, b]) => {
      const aLatest = new Date(a[a.length - 1].punchTime).getTime();
      const bLatest = new Date(b[b.length - 1].punchTime).getTime();
      return bLatest - aLatest;
    });
    const rows: DisplayRow[] = [];
    for (const [, punches] of sortedGroups) {
      for (const log of punches) {
        const match = deviceUserMap[log.deviceUserId];
        if (match) rows.push({ kind: "present", log, match });
        else rows.push({ kind: "unlinked", log });
      }
    }
    return rows;

  }, [zkLogs, filteredLogs, deviceUserMap, students, fBatchId, fStudentId, fGroup, fShift]);

  // ── Actions ───────────────────────────────────────────────────────────────
  const applyPreset = (preset: string) => {
    const { from, to } = getPresetRange(preset);
    setFFromDate(from);
    setFToDate(to);
  };

  const clearFilters = () => {
    setFBatchId("");
    setFGroup("");
    setFShift("");
    setFFromDate(todayISO());
    setFToDate(todayISO());
    setFStudentId("");
    setStudentSearch("");
  };

  const hasActiveFilters = !!(fBatchId || fGroup || fShift || fStudentId);
  const currentPreset = activePreset(fFromDate, fToDate);

  const selectedBatchName = (batches as any[]).find((b) => String(b.id) === fBatchId)?.name ?? "";

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <Layout title="Attendance" subtitle="Live biometric punch log">
      <div className="space-y-4">

        {/* ── Filter Bar ──────────────────────────────────────────────────── */}
        <Card>
          <CardContent className="pt-4 pb-4 space-y-3">

            {/* Row 1 — Batch · Group · Shift · From · To · Clear */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 items-end">

              {/* Class / Batch */}
              <div className="space-y-1">
                <Label className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  Class / Batch
                </Label>
                <Select
                  value={fBatchId || "__all__"}
                  onValueChange={(v) => setFBatchId(v === "__all__" ? "" : v)}
                >
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder="All Batches" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">All Batches</SelectItem>
                    {(batches as any[]).map((b) => (
                      <SelectItem key={b.id} value={String(b.id)}>{b.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Group */}
              <div className="space-y-1">
                <Label className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  Group
                </Label>
                <Select
                  value={fGroup || "__all__"}
                  onValueChange={(v) => setFGroup(v === "__all__" ? "" : v)}
                  disabled={availableGroups.length === 0}
                >
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder="All Groups" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">All Groups</SelectItem>
                    {availableGroups.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              {/* Shift */}
              <div className="space-y-1">
                <Label className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  Shift
                </Label>
                <Select
                  value={fShift || "__all__"}
                  onValueChange={(v) => setFShift(v === "__all__" ? "" : v)}
                  disabled={availableShifts.length === 0}
                >
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder="All Shifts" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">All Shifts</SelectItem>
                    {availableShifts.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              {/* From Date */}
              <div className="space-y-1">
                <Label className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  From
                </Label>
                <div className="relative">
                  <CalendarDays className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                  <Input
                    type="date"
                    value={fFromDate}
                    onChange={(e) => {
                      setFFromDate(e.target.value);
                      if (e.target.value > fToDate) setFToDate(e.target.value);
                    }}
                    className="h-9 text-sm pl-8"
                    data-testid="input-from-date"
                  />
                </div>
              </div>

              {/* To Date */}
              <div className="space-y-1">
                <Label className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  To
                </Label>
                <div className="relative">
                  <CalendarDays className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                  <Input
                    type="date"
                    value={fToDate}
                    min={fFromDate}
                    onChange={(e) => setFToDate(e.target.value)}
                    className="h-9 text-sm pl-8"
                    data-testid="input-to-date"
                  />
                </div>
              </div>

              {/* Clear / indicator */}
              <div className="flex items-end">
                {hasActiveFilters ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={clearFilters}
                    className="h-9 gap-1.5 text-sm w-full"
                    data-testid="button-clear-filters"
                  >
                    <X className="w-3.5 h-3.5" /> Clear
                  </Button>
                ) : (
                  <div className="h-9 flex items-center gap-1.5 text-xs text-slate-400 px-1">
                    <SlidersHorizontal className="w-3.5 h-3.5" /> Filters
                  </div>
                )}
              </div>
            </div>

            {/* Row 2 — Quick presets · Student selector */}
            <div className="flex flex-wrap items-end gap-3">

              {/* Presets */}
              <div className="space-y-1">
                <Label className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  Quick Range
                </Label>
                <div className="flex gap-1.5 flex-wrap">
                  {PRESETS.map((p) => (
                    <Button
                      key={p.id}
                      variant="outline"
                      size="sm"
                      onClick={() => applyPreset(p.id)}
                      className={`h-8 px-3 text-xs transition-colors ${
                        currentPreset === p.id
                          ? "bg-blue-50 border-blue-300 text-blue-700 hover:bg-blue-100"
                          : ""
                      }`}
                      data-testid={`preset-${p.id}`}
                    >
                      {p.label}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Student selector */}
              <div className="flex-1 min-w-[220px] max-w-sm space-y-1">
                <Label className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  Student
                </Label>
                <Select
                  value={fStudentId || "__all__"}
                  onValueChange={(v) => {
                    setFStudentId(v === "__all__" ? "" : v);
                    setStudentSearch("");
                  }}
                  disabled={selectorStudents.length === 0}
                >
                  <SelectTrigger className="h-9 text-sm" data-testid="select-student">
                    <SelectValue
                      placeholder={fBatchId ? "All Students" : "Select a batch first"}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {/* Inline search */}
                    <div className="px-2 pt-1.5 pb-1 border-b border-slate-100 sticky top-0 bg-white z-10">
                      <div className="relative">
                        <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                        <Input
                          placeholder="Search by name or ID…"
                          value={studentSearch}
                          onChange={(e) => setStudentSearch(e.target.value)}
                          className="h-7 text-xs pl-7 border-slate-200"
                          onKeyDown={(e) => e.stopPropagation()}
                          onClick={(e) => e.stopPropagation()}
                          data-testid="input-student-search"
                        />
                      </div>
                    </div>
                    <SelectItem value="__all__">All Students</SelectItem>
                    {filteredSelectorStudents.map((s: any) => (
                      <SelectItem
                        key={s.studentCustomId || s.id}
                        value={s.studentCustomId || String(s.id)}
                      >
                        <span className="font-mono text-[11px] text-slate-400 mr-1.5">
                          {s.studentCustomId}
                        </span>
                        {s.name}
                      </SelectItem>
                    ))}
                    {filteredSelectorStudents.length === 0 && studentSearch && (
                      <div className="px-3 py-2 text-xs text-slate-500 text-center">
                        No students match "{studentSearch}"
                      </div>
                    )}
                  </SelectContent>
                </Select>
              </div>

            </div>
          </CardContent>
        </Card>

        {/* ── Smart Attendance Card (batch selected, any date range) ─────────── */}
        {smartEligible && (
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-indigo-500" />
                  Smart Attendance
                  <span className="text-xs font-normal text-slate-400 ml-1">
                    — {selectedBatchName} · {fFromDate === fToDate ? fFromDate : `${fFromDate} → ${fToDate}`}
                  </span>
                </CardTitle>
                <div className="flex items-center gap-2 flex-wrap">
                  <SmartAttendanceExport
                    batchId={fBatchId}
                    startDate={fFromDate}
                    endDate={fToDate}
                    batchName={selectedBatchName}
                    shift={fShift || undefined}
                    group={fGroup || undefined}
                  />
                  {/* View mode toggle */}
                  <div className="flex items-center gap-1 rounded-lg border border-slate-200 p-0.5 bg-slate-50">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSmartMode(true)}
                      className={`h-7 px-3 text-xs rounded-md transition-all ${
                        smartMode
                          ? "bg-white shadow-sm text-indigo-700 font-semibold border border-indigo-200"
                          : "text-slate-500 hover:text-slate-700"
                      }`}
                    >
                      <BookOpen className="w-3 h-3 mr-1" /> Subject-wise
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSmartMode(false)}
                      className={`h-7 px-3 text-xs rounded-md transition-all ${
                        !smartMode
                          ? "bg-white shadow-sm text-blue-700 font-semibold border border-blue-200"
                          : "text-slate-500 hover:text-slate-700"
                      }`}
                    >
                      <Fingerprint className="w-3 h-3 mr-1" /> Raw Logs
                    </Button>
                  </div>
                </div>
              </div>
            </CardHeader>

            <CardContent>
              {smartMode ? (
                <SmartAttendanceView
                  batchId={fBatchId}
                  startDate={fFromDate}
                  endDate={fToDate}
                  batchName={selectedBatchName}
                  shift={fShift || undefined}
                  group={fGroup || undefined}
                />
              ) : (
                /* Raw log view (same as the bottom card but inline here) */
                <div className="space-y-1.5">
                  {zkLoading ? (
                    <div className="flex items-center justify-center gap-2 py-10 text-slate-400">
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span className="text-sm">Loading…</span>
                    </div>
                  ) : displayRows.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 gap-2 text-slate-400">
                      <Fingerprint className="w-8 h-8 opacity-25" />
                      <p className="text-sm">No punch records for the selected filters.</p>
                    </div>
                  ) : (
                    displayRows.map((row, idx) => <RawLogRow key={idx} row={row} fFromDate={fFromDate} fToDate={fToDate} />)
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* ── Raw Biometric Log Feed (always shown when no smart eligible, or as supplement) ── */}
        {!smartEligible && (
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Fingerprint className="w-4 h-4 text-blue-500" />
                  Biometric Attendance Log
                </CardTitle>
                <div className="flex items-center gap-2">
                  {zkLoading && (
                    <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
                  )}
                  {!zkLoading && (
                    <span className="text-xs text-slate-500 tabular-nums">
                      {displayRows.length} record{displayRows.length !== 1 ? "s" : ""}
                      {" · "}
                      {fFromDate === fToDate ? fFromDate : `${fFromDate} → ${fToDate}`}
                    </span>
                  )}
                </div>
              </div>
            </CardHeader>

            <CardContent>
              {zkLoading ? (
                <div className="flex items-center justify-center gap-2 py-14 text-slate-400">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span className="text-sm">Loading punch records…</span>
                </div>
              ) : filteredLogs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-14 gap-3 text-slate-400">
                  <Fingerprint className="w-9 h-9 opacity-25" />
                  <p className="text-sm">No punch records for the selected filters.</p>
                  {hasActiveFilters && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={clearFilters}
                      className="text-blue-500 h-auto px-2 text-xs"
                    >
                      Clear filters
                    </Button>
                  )}
                </div>
              ) : (
                <div className="space-y-1.5">
                  {displayRows.map((row, idx) => (
                    <RawLogRow key={idx} row={row} fFromDate={fFromDate} fToDate={fToDate} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

      </div>
    </Layout>
  );
}

// ── Shared raw-log row renderer ───────────────────────────────────────────────

function RawLogRow({ row, fFromDate, fToDate }: { row: DisplayRow; fFromDate: string; fToDate: string }) {
  let name = "";
  let idStr = "";
  let group: string | undefined;
  let shift: string | undefined;
  let isStaff = false;
  let timeStr = "—";
  let dateStr = "";
  let deviceId = "";
  let rowKey = "row";

  if (row.kind === "present") {
    name    = row.match.name;
    idStr   = `ID ${row.log.deviceUserId}`;
    group   = row.match.kind === "student" ? row.match.group : undefined;
    shift   = row.match.kind === "student" ? row.match.shift : undefined;
    isStaff = row.match.kind === "staff";
    deviceId = row.log.deviceId;
    rowKey  = `p-${row.log.id}`;
    const d = new Date(row.log.punchTime);
    timeStr = d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true, timeZone: "Asia/Dhaka" });
    dateStr = d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "Asia/Dhaka", ...(fFromDate !== fToDate ? { year: "numeric" } : {}) });
  } else if (row.kind === "unlinked") {
    name     = row.log.deviceUserId;
    idStr    = "Unknown ID";
    deviceId = row.log.deviceId;
    rowKey   = `u-${row.log.id}`;
    const d  = new Date(row.log.punchTime);
    timeStr  = d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true, timeZone: "Asia/Dhaka" });
    dateStr  = d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "Asia/Dhaka", ...(fFromDate !== fToDate ? { year: "numeric" } : {}) });
  } else {
    name    = row.name;
    idStr   = `ID ${row.studentId}`;
    group   = row.group;
    shift   = row.shift;
    rowKey  = `a-${row.studentId}`;
    dateStr = fFromDate === fToDate ? fFromDate : `${fFromDate} – ${fToDate}`;
  }

  const rowClass =
    row.kind === "present"
      ? "border-l-2 border-l-emerald-400 bg-emerald-50/40 hover:bg-emerald-50/70 dark:bg-emerald-900/20 dark:hover:bg-emerald-900/30"
      : row.kind === "absent"
      ? "border-l-2 border-l-rose-400 bg-rose-50/40 hover:bg-rose-50/70 dark:bg-rose-900/20 dark:hover:bg-rose-900/30"
      : "border-l-2 border-l-amber-400 bg-amber-50/40 hover:bg-amber-50/70 dark:bg-amber-900/20 dark:hover:bg-amber-900/30";

  return (
    <div
      data-testid={`attendance-row-${rowKey}`}
      className={`grid grid-cols-[1fr_auto_auto] sm:grid-cols-[1fr_auto_auto_auto] items-center gap-x-3 gap-y-0.5 px-3 py-2.5 rounded-lg border border-slate-100 dark:border-slate-700 transition-colors ${rowClass}`}
    >
      {/* Col 1: Name + ID */}
      <div className="min-w-0">
        <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate leading-snug">
          {name}
        </p>
        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
          <span className="text-[11px] text-slate-400 dark:text-slate-500 font-mono">{idStr}</span>
          {dateStr && (
            <span className="text-[11px] text-slate-400 dark:text-slate-500">{dateStr}</span>
          )}
        </div>
      </div>

      {/* Col 2: Class / Group / Shift badges */}
      <div className="hidden sm:flex items-center gap-1 shrink-0 flex-wrap justify-end">
        {isStaff && (
          <Badge variant="outline" className="text-[10px] h-4 px-1.5 border-purple-200 text-purple-700 bg-purple-50">
            Staff
          </Badge>
        )}
        {!isStaff && row.kind !== "unlinked" && (
          <Badge variant="outline" className="text-[10px] h-4 px-1.5 border-blue-200 text-blue-700 bg-blue-50">
            Student
          </Badge>
        )}
        {group && (
          <Badge variant="outline" className="text-[10px] h-4 px-1.5 border-purple-200 text-purple-700 bg-purple-50">
            {group}
          </Badge>
        )}
        {shift && (
          <Badge variant="outline" className="text-[10px] h-4 px-1.5 border-blue-200 text-blue-700 bg-blue-50">
            {shift}
          </Badge>
        )}
      </div>

      {/* Col 3: Punch Time */}
      <div className="text-right shrink-0">
        <p className={`text-sm font-mono font-semibold ${row.kind === "absent" ? "text-slate-400" : "text-slate-700"}`}>
          {timeStr}
        </p>
        {deviceId && (
          <p className="text-[10px] text-slate-400 font-mono">dev: {deviceId}</p>
        )}
      </div>

      {/* Col 4: Status Badge */}
      <div className="shrink-0">
        {row.kind === "present" && (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200">
            🟢 Present
          </span>
        )}
        {row.kind === "absent" && (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 border border-rose-200">
            🔴 Absent
          </span>
        )}
        {row.kind === "unlinked" && (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200">
            🟡 Unlinked
          </span>
        )}
      </div>
    </div>
  );
}
