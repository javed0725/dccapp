import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Printer, ArrowLeft } from "lucide-react";
import coachingLogo from "@assets/IMG_20260126_081644_1769393818079.jpg";

function getGrade(obtained: number, total: number): { grade: string; gp: number } {
  if (obtained === -1) return { grade: "ABS", gp: 0.0 };
  const pct = total > 0 ? (obtained / total) * 100 : 0;
  if (pct >= 80) return { grade: "A+", gp: 5.0 };
  if (pct >= 70) return { grade: "A", gp: 4.0 };
  if (pct >= 60) return { grade: "A-", gp: 3.5 };
  if (pct >= 50) return { grade: "B", gp: 3.0 };
  if (pct >= 40) return { grade: "C", gp: 2.0 };
  if (pct >= 33) return { grade: "D", gp: 1.0 };
  return { grade: "F", gp: 0.0 };
}

function GradeBadge({ grade }: { grade: string }) {
  const styles: Record<string, string> = {
    "A+":  "bg-emerald-50 text-emerald-700 border border-emerald-200",
    "A":   "bg-green-50 text-green-700 border border-green-200",
    "A-":  "bg-teal-50 text-teal-700 border border-teal-200",
    "B":   "bg-blue-50 text-blue-700 border border-blue-200",
    "C":   "bg-amber-50 text-amber-700 border border-amber-200",
    "D":   "bg-orange-50 text-orange-700 border border-orange-200",
    "F":   "bg-red-50 text-red-700 border border-red-200",
    "ABS": "bg-red-100 text-red-700 border border-red-300",
  };
  return (
    <span className={`inline-flex items-center justify-center px-3 py-1 rounded-full text-xs font-bold tracking-wide min-w-[40px] ${styles[grade] ?? "bg-gray-50 text-gray-700 border border-gray-200"}`}>
      {grade}
    </span>
  );
}

const GRADING_SCALE = [
  { range: "80–100", grade: "A+", gp: "5.00", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  { range: "70–79",  grade: "A",  gp: "4.00", cls: "bg-green-50 text-green-700 border-green-200" },
  { range: "60–69",  grade: "A-", gp: "3.50", cls: "bg-teal-50 text-teal-700 border-teal-200" },
  { range: "50–59",  grade: "B",  gp: "3.00", cls: "bg-blue-50 text-blue-700 border-blue-200" },
  { range: "40–49",  grade: "C",  gp: "2.00", cls: "bg-amber-50 text-amber-700 border-amber-200" },
  { range: "33–39",  grade: "D",  gp: "1.00", cls: "bg-orange-50 text-orange-700 border-orange-200" },
  { range: "0–32",   grade: "F",  gp: "0.00", cls: "bg-red-50 text-red-700 border-red-200" },
];

export default function Marksheet() {
  const params = new URLSearchParams(window.location.search);
  const groupId = params.get("groupId") || "";
  const studentIdParam = params.get("studentId");

  const { data: results, isLoading } = useQuery<any[]>({
    queryKey: ["/api/results/model-test", groupId, studentIdParam],
    queryFn: async () => {
      const url = studentIdParam
        ? `/api/results/model-test/${groupId}?studentId=${studentIdParam}`
        : `/api/results/model-test/${groupId}`;
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
    enabled: !!groupId,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50 dark:bg-slate-950">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-slate-500 dark:text-slate-400 font-medium text-sm">Loading marksheet…</p>
        </div>
      </div>
    );
  }

  if (!results?.length) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50 dark:bg-slate-950">
        <div className="text-center">
          <p className="text-slate-500 dark:text-slate-400 text-base font-medium mb-4">No results found for this exam.</p>
          <Button variant="outline" onClick={() => window.history.back()} className="gap-2">
            <ArrowLeft className="w-4 h-4" /> Go Back
          </Button>
        </div>
      </div>
    );
  }

  const examName    = results[0]?.examName || "";
  const studentName = results[0]?.studentName || "";
  const batchName   = results[0]?.batchName || "";
  const examDate    = results[0]?.date ? new Date(results[0].date).toLocaleDateString("en-GB") : "";

  const gradedResults = results.map((r) => {
    const { grade, gp } = getGrade(r.obtainedMarks, r.totalMarks);
    return { ...r, grade, gp, isAbsent: r.obtainedMarks === -1 };
  });

  const hasAbsent     = gradedResults.some((r) => r.isAbsent);
  const attendedRes   = gradedResults.filter((r) => !r.isAbsent);
  const totalObtained = attendedRes.reduce((s, r) => s + r.obtainedMarks, 0);
  const totalFull     = attendedRes.reduce((s, r) => s + r.totalMarks, 0);
  const gpa           = attendedRes.length > 0
    ? attendedRes.reduce((s, r) => s + r.gp, 0) / attendedRes.length
    : 0;
  const hasFailed     = hasAbsent || gradedResults.some((r) => r.grade === "F");
  const overallPct    = totalFull > 0 ? Math.round((totalObtained / totalFull) * 100) : 0;

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 py-6 px-3 sm:px-4 print:bg-white print:p-0 print:m-0">

      <div className="print:hidden mb-5 flex justify-center gap-3 flex-wrap">
        <Button onClick={() => window.print()} className="gap-2 bg-[#2c3e50] hover:bg-[#34495e] text-white">
          <Printer className="w-4 h-4" /> Print / Save PDF
        </Button>
        <Button variant="outline" onClick={() => window.history.back()} className="gap-2">
          <ArrowLeft className="w-4 h-4" /> Back
        </Button>
      </div>

      <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow-lg overflow-hidden print:shadow-none print:rounded-none print:max-w-full">

        {/* ── Header ── */}
        <div className="bg-[#2c3e50] px-6 py-5 sm:px-8 sm:py-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 sm:w-16 sm:h-16 bg-white rounded-full flex items-center justify-center p-1 shadow-md shrink-0">
              <img src={coachingLogo} alt="Logo" className="w-full h-full object-contain rounded-full" />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-black text-white uppercase tracking-tight leading-snug">
                Dynamic Coaching Center
              </h1>
              <p className="text-[#3498db] text-xs font-semibold tracking-widest uppercase mt-0.5">
                Come to Learn, Leave to Shine
              </p>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-white/20 text-center">
            <span className="inline-block bg-[#3498db] text-white text-xs font-black uppercase tracking-[0.2em] px-4 py-1.5 rounded-full">
              Model Test Marksheet
            </span>
          </div>
        </div>

        {/* ── Student Info ── */}
        <div className="px-6 sm:px-8 py-5 border-b border-slate-100">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: "Student Name", value: studentName || "—" },
              { label: "Batch / Class", value: batchName || "—" },
              { label: "Exam Name",    value: examName },
              { label: "Exam Date",    value: examDate || "—" },
            ].map(({ label, value }) => (
              <div key={label}>
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">{label}</p>
                <p className="text-sm font-bold text-[#2c3e50] leading-tight">{value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── Grading Scale ── */}
        <div className="px-6 sm:px-8 py-3 border-b border-slate-100 bg-slate-50">
          <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2">Grading Scale</p>
          <div className="flex flex-wrap gap-1.5">
            {GRADING_SCALE.map(({ range, grade, gp, cls }) => (
              <span key={grade} className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md border ${cls}`}>
                {grade} <span className="opacity-60 font-normal">{range} · {gp}</span>
              </span>
            ))}
          </div>
        </div>

        {/* ── Marks Table ── */}
        <div className="px-6 sm:px-8 py-5">
          <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-sm">
            <table className="w-full min-w-[480px] text-sm border-collapse">
              <thead>
                <tr className="bg-[#3498db] text-white">
                  <th className="text-left py-3 px-4 font-bold text-[11px] uppercase tracking-wider">Subject</th>
                  <th className="text-center py-3 px-3 font-bold text-[11px] uppercase tracking-wider">Full Marks</th>
                  <th className="text-center py-3 px-3 font-bold text-[11px] uppercase tracking-wider">Obtained</th>
                  <th className="text-center py-3 px-3 font-bold text-[11px] uppercase tracking-wider">%</th>
                  <th className="text-center py-3 px-3 font-bold text-[11px] uppercase tracking-wider">Grade Point</th>
                  <th className="text-center py-3 px-3 font-bold text-[11px] uppercase tracking-wider">Grade</th>
                </tr>
              </thead>
              <tbody>
                {gradedResults.map((r, idx) => {
                  const pct = !r.isAbsent && r.totalMarks > 0 ? Math.round((r.obtainedMarks / r.totalMarks) * 100) : null;
                  return (
                    <tr key={r.id ?? idx} className={`border-b border-slate-100 transition-colors ${r.isAbsent ? "bg-red-50" : idx % 2 === 0 ? "bg-white" : "bg-slate-50/70"}`}>
                      <td className={`py-3.5 px-4 font-semibold ${r.isAbsent ? "text-red-600" : "text-[#2c3e50]"}`}>{r.subject}</td>
                      <td className="py-3.5 px-3 text-center text-slate-500 font-medium">{r.totalMarks}</td>
                      <td className={`py-3.5 px-3 text-center font-black text-base ${r.isAbsent ? "text-red-600" : "text-[#2c3e50]"}`}>
                        {r.isAbsent ? "Absent" : r.obtainedMarks}
                      </td>
                      <td className="py-3.5 px-3 text-center text-slate-400 font-medium text-xs">
                        {r.isAbsent ? "—" : `${pct}%`}
                      </td>
                      <td className={`py-3.5 px-3 text-center font-black text-base ${r.isAbsent ? "text-red-500" : "text-[#3498db]"}`}>
                        {r.isAbsent ? "—" : r.gp.toFixed(2)}
                      </td>
                      <td className="py-3.5 px-3 text-center"><GradeBadge grade={r.grade} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Summary Card ── */}
        <div className="px-6 sm:px-8 pb-6">
          <div className="rounded-xl border border-slate-200 shadow-sm bg-white overflow-hidden">
            <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-slate-100">
              <div className="px-5 py-4 text-center sm:text-left">
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Total Marks</p>
                <p className="text-2xl font-black text-[#2c3e50]">
                  {totalObtained}
                  <span className="text-slate-400 text-base font-semibold">/{totalFull}</span>
                </p>
                <p className="text-xs text-slate-400 mt-0.5 font-medium">
                  {hasAbsent ? `${attendedRes.length} attended subject${attendedRes.length !== 1 ? "s" : ""}` : `${overallPct}% overall`}
                </p>
              </div>
              <div className="px-5 py-4 text-center bg-[#3498db]/5">
                <p className="text-[9px] font-black uppercase tracking-widest text-[#3498db] mb-1">Final GPA</p>
                <p className="text-2xl font-black text-[#3498db]">
                  {gpa.toFixed(2)}
                  <span className="text-slate-400 text-base font-semibold">/5.00</span>
                </p>
                <p className="text-xs text-slate-400 mt-0.5 font-medium">{gradedResults.length} subject{gradedResults.length !== 1 ? "s" : ""}</p>
              </div>
              <div className="px-5 py-4 text-center sm:text-right">
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Result</p>
                <p className={`text-2xl font-black ${hasFailed ? "text-red-500" : "text-emerald-500"}`}>
                  {hasFailed ? "FAILED" : "PASSED"}
                </p>
                {hasAbsent && (
                  <p className="text-xs text-red-400 mt-0.5 font-medium">
                    Absent in {gradedResults.filter((r) => r.isAbsent).length} subject(s)
                  </p>
                )}
                {!hasAbsent && hasFailed && (
                  <p className="text-xs text-red-400 mt-0.5 font-medium">
                    {gradedResults.filter((r) => r.grade === "F").length} subject(s) failed
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ── Footer ── */}
        <div className="px-6 sm:px-8 pb-6 pt-4 text-center border-t border-slate-100">
          <p className="text-[11px] text-slate-400">
            This is an official marksheet issued by{" "}
            <span className="font-semibold text-[#2c3e50]">Dynamic Coaching Center</span>
          </p>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Generated on {new Date().toLocaleDateString("en-GB")}
          </p>
        </div>
      </div>

      <style>{`
        @media print {
          @page { size: A4; margin: 1cm; }
          body { margin: 0; padding: 0; background: white; }
          aside, header, nav,
          [data-sidebar], [data-testid="button-sidebar-toggle"] { display: none !important; }
          main { padding: 0 !important; overflow: visible !important; background: white !important; }
          .print\\:hidden { display: none !important; }
          .print\\:shadow-none { box-shadow: none !important; }
          .print\\:rounded-none { border-radius: 0 !important; }
          .print\\:bg-white { background: white !important; }
          .print\\:p-0 { padding: 0 !important; }
          .print\\:m-0 { margin: 0 !important; }
          .print\\:max-w-full { max-width: 100% !important; }
          .overflow-x-auto { overflow: visible !important; }
        }
      `}</style>
    </div>
  );
}
