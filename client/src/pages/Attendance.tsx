import { useState, useMemo, useEffect } from "react";
import { Layout } from "@/components/Layout";
import { useStudents, useBatches } from "@/hooks/use-finance";
import { useQuery } from "@tanstack/react-query";
import { type User } from "@/lib/schemas";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarDays, Fingerprint, Loader2, Search, X, SlidersHorizontal } from "lucide-react";

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

  // ── Combined display rows: Present + Unlinked + Absent ───────────────────
  const displayRows = useMemo<DisplayRow[]>(() => {
    const rows: DisplayRow[] = filteredLogs.map((log) => {
      const match = deviceUserMap[log.deviceUserId];
      if (match) return { kind: "present", log, match };
      return { kind: "unlinked", log };
    });

    // Absent rows: only when a batch or specific student filter is active
    if (fBatchId || fStudentId) {
      const punchedIds = new Set(filteredLogs.map((l) => l.deviceUserId));
      (students as any[])
        .filter((s: any) => {
          if (s.isActive === false) return false;
          if (!s.studentCustomId) return false;
          if (punchedIds.has(String(s.studentCustomId))) return false;
          if (fStudentId && String(s.studentCustomId) !== fStudentId) return false;
          if (fBatchId && String(s.batchId) !== fBatchId) return false;
          if (fGroup && s.academicGroup !== fGroup) return false;
          if (fShift && s.shift !== fShift) return false;
          return true;
        })
        .forEach((s: any) =>
          rows.push({
            kind: "absent",
            studentId: String(s.studentCustomId),
            name: s.name,
            group: s.academicGroup,
            shift: s.shift,
          })
        );
    }

    // Sort: present (desc by punchTime) → unlinked (desc by punchTime) → absent (alpha)
    const order: Record<DisplayRow["kind"], number> = { present: 0, unlinked: 1, absent: 2 };
    return rows.sort((a, b) => {
      if (order[a.kind] !== order[b.kind]) return order[a.kind] - order[b.kind];
      if (a.kind !== "absent" && b.kind !== "absent")
        return new Date((b as any).log.punchTime).getTime() - new Date((a as any).log.punchTime).getTime();
      if (a.kind === "absent" && b.kind === "absent")
        return a.name.localeCompare(b.name);
      return 0;
    });
  }, [filteredLogs, deviceUserMap, students, fBatchId, fStudentId, fGroup, fShift]);

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

        {/* ── Attendance Log Feed ──────────────────────────────────────────── */}
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
                    variant="link"
                    size="sm"
                    onClick={clearFilters}
                    className="text-blue-500 h-auto p-0 text-xs"
                  >
                    Clear filters
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-1.5">
                {displayRows.map((row, idx) => {
                  // ── Derive display values per row kind ──────────────────
                  let name = "";
                  let idStr = "";
                  let group: string | undefined;
                  let shift: string | undefined;
                  let isStaff = false;
                  let timeStr = "—";
                  let dateStr = "";
                  let deviceId = "";
                  let rowKey = String(idx);

                  if (row.kind === "present") {
                    name   = row.match.name;
                    idStr  = `ID ${row.log.deviceUserId}`;
                    group  = row.match.kind === "student" ? row.match.group : undefined;
                    shift  = row.match.kind === "student" ? row.match.shift : undefined;
                    isStaff = row.match.kind === "staff";
                    deviceId = row.log.deviceId;
                    rowKey = `p-${row.log.id}`;
                    const d = new Date(row.log.punchTime);
                    timeStr = d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true });
                    dateStr = d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", ...(fFromDate !== fToDate ? { year: "numeric" } : {}) });
                  } else if (row.kind === "unlinked") {
                    name    = row.log.deviceUserId;
                    idStr   = "Unknown ID";
                    deviceId = row.log.deviceId;
                    rowKey  = `u-${row.log.id}`;
                    const d = new Date(row.log.punchTime);
                    timeStr = d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true });
                    dateStr = d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", ...(fFromDate !== fToDate ? { year: "numeric" } : {}) });
                  } else {
                    name   = row.name;
                    idStr  = `ID ${row.studentId}`;
                    group  = row.group;
                    shift  = row.shift;
                    rowKey = `a-${row.studentId}`;
                    dateStr = fFromDate === fToDate ? fFromDate : `${fFromDate} – ${fToDate}`;
                  }

                  // ── Row border / bg colour per status ──────────────────
                  const rowClass =
                    row.kind === "present"
                      ? "border-l-2 border-l-emerald-400 bg-emerald-50/40 hover:bg-emerald-50/70"
                      : row.kind === "absent"
                      ? "border-l-2 border-l-rose-400 bg-rose-50/40 hover:bg-rose-50/70"
                      : "border-l-2 border-l-amber-400 bg-amber-50/40 hover:bg-amber-50/70";

                  return (
                    <div
                      key={rowKey}
                      data-testid={`attendance-row-${rowKey}`}
                      className={`grid grid-cols-[1fr_auto_auto] sm:grid-cols-[1fr_auto_auto_auto] items-center gap-x-3 gap-y-0.5 px-3 py-2.5 rounded-lg border border-slate-100 transition-colors ${rowClass}`}
                    >
                      {/* ── Col 1: Name + ID ─────────────────────────────── */}
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate leading-snug">
                          {name}
                        </p>
                        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                          <span className="text-[11px] text-slate-400 font-mono">{idStr}</span>
                          {dateStr && (
                            <span className="text-[11px] text-slate-400">{dateStr}</span>
                          )}
                        </div>
                      </div>

                      {/* ── Col 2: Class / Group / Shift badges (hidden xs) ── */}
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

                      {/* ── Col 3: Punch Time ────────────────────────────── */}
                      <div className="text-right shrink-0">
                        <p className={`text-sm font-mono font-semibold ${row.kind === "absent" ? "text-slate-400" : "text-slate-700 dark:text-slate-300"}`}>
                          {timeStr}
                        </p>
                        {deviceId && (
                          <p className="text-[10px] text-slate-400 font-mono">dev: {deviceId}</p>
                        )}
                      </div>

                      {/* ── Col 4: Status Badge ──────────────────────────── */}
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
                })}
              </div>
            )}
          </CardContent>
        </Card>

      </div>
    </Layout>
  );
}
