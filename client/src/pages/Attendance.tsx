import { useState, useMemo, useEffect } from "react";
import { Layout } from "@/components/Layout";
import { useStudents, useBatches } from "@/hooks/use-finance";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { type User } from "@/lib/schemas";
import { usePortal } from "@/lib/portal-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { CalendarDays, Users, CheckCircle2, XCircle, ClipboardCheck, History as HistoryIcon, BarChart3, BookOpen, Phone, Trash2, Loader2 } from "lucide-react";
import { SiWhatsapp } from "react-icons/si";

type AttendanceRow = {
  id: number;
  date: string;
  batchId: number;
  teacherId: number | null;
  subject: string;
  academicGroup: string;
  shift: string;
  absentStudentIds: number[];
  totalStudents: number;
};

type SummaryRow = {
  batchId: number;
  batchName: string;
  totalSessions: number;
  averageAttendance: number;
  lastDate: string | null;
};

const todayISO = () => new Date().toISOString().slice(0, 10);

// Parse YYYY-MM-DD as a local date to avoid timezone shifting the day name
const parseLocalDate = (iso: string): Date | null => {
  if (!iso) return null;
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
};

const formatDayName = (iso: string): string => {
  const dt = parseLocalDate(iso);
  return dt ? dt.toLocaleDateString("en-US", { weekday: "long" }) : "";
};

const formatFullDate = (iso: string): string => {
  const dt = parseLocalDate(iso);
  return dt
    ? dt.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })
    : iso;
};

export default function Attendance() {
  const { data: user } = useQuery<User>({ queryKey: ["/api/user"] });
  const isAdmin = user?.role === "admin";
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: batches = [] } = useBatches();
  const { data: students = [] } = useStudents();

  const [selectedBatchId, setSelectedBatchId] = useState<string>("");
  const [selectedGroup, setSelectedGroup] = useState<string>("all");
  const [selectedShift, setSelectedShift] = useState<string>("all");
  const [subject, setSubject] = useState<string>("");
  const [date, setDate] = useState<string>(todayISO());
  const [presence, setPresence] = useState<Record<number, boolean>>({});

  // Auto-clear downstream filters when batch changes (matches Result section pattern)
  useEffect(() => {
    setSelectedGroup("all");
    setSelectedShift("all");
  }, [selectedBatchId]);

  const batchStudents = useMemo(
    () => (students || []).filter((s: any) => String(s.batchId) === selectedBatchId),
    [students, selectedBatchId]
  );

  const availableGroups = useMemo(
    () => Array.from(new Set(batchStudents.map((s: any) => s.academicGroup).filter(Boolean))) as string[],
    [batchStudents]
  );
  const availableShifts = useMemo(
    () => Array.from(new Set(batchStudents.map((s: any) => s.shift).filter(Boolean))) as string[],
    [batchStudents]
  );

  // Filter students by group + shift (mirrors EntryMarks pattern)
  const studentsInBatch = useMemo(
    () => batchStudents.filter((s: any) => {
      const matchGroup = selectedGroup === "all" || s.academicGroup === selectedGroup;
      const matchShift = selectedShift === "all" || s.shift === selectedShift;
      return matchGroup && matchShift;
    }).sort((a: any, b: any) => parseInt(a.studentCustomId || "0") - parseInt(b.studentCustomId || "0")),
    [batchStudents, selectedGroup, selectedShift]
  );

  // Fetch all results to extract a list of subjects for the dropdown suggestions
  const { data: allResults = [] } = useQuery<any[]>({ queryKey: ["/api/results"] });
  const { data: allAttendance = [] } = useQuery<AttendanceRow[]>({ queryKey: ["/api/attendance"] });

  const subjectOptions = useMemo(() => {
    const set = new Set<string>();
    (allResults || []).forEach((r: any) => { if (r.subject) set.add(String(r.subject)); });
    (allAttendance || []).forEach((a: AttendanceRow) => { if (a.subject) set.add(a.subject); });
    if (user?.subject) set.add(user.subject);
    return Array.from(set).sort();
  }, [allResults, allAttendance, user]);

  // Effective values sent to the API ("" means "general / unspecified")
  const effGroup = selectedGroup === "all" ? "" : selectedGroup;
  const effShift = selectedShift === "all" ? "" : selectedShift;
  const effSubject = subject.trim();

  const { data: existing } = useQuery<AttendanceRow | null>({
    queryKey: ["/api/attendance", selectedBatchId, date, effSubject, effGroup, effShift],
    queryFn: async () => {
      if (!selectedBatchId || !date) return null;
      const params = new URLSearchParams({ batchId: selectedBatchId, date });
      if (effSubject) params.set("subject", effSubject);
      if (effGroup) params.set("academicGroup", effGroup);
      if (effShift) params.set("shift", effShift);
      const res = await fetch(`/api/attendance?${params.toString()}`);
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!selectedBatchId && !!date,
  });

  // Hydrate presence map whenever filters or existing record change
  useEffect(() => {
    const initial: Record<number, boolean> = {};
    const absentSet = new Set<number>(existing?.absentStudentIds || []);
    studentsInBatch.forEach((s: any) => {
      initial[s.id] = !absentSet.has(s.id);
    });
    setPresence(initial);
  }, [selectedBatchId, date, effSubject, effGroup, effShift, existing, studentsInBatch.length]);

  const presentCount = Object.values(presence).filter(Boolean).length;
  const absentCount = studentsInBatch.length - presentCount;

  const saveMutation = useMutation({
    mutationFn: async () => {
      const absentStudentIds = studentsInBatch.filter((s: any) => !presence[s.id]).map((s: any) => s.id);
      const res = await apiRequest("POST", "/api/attendance", {
        date,
        batchId: Number(selectedBatchId),
        subject: effSubject,
        academicGroup: effGroup,
        shift: effShift,
        absentStudentIds,
        totalStudents: studentsInBatch.length,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/attendance"] });
      queryClient.invalidateQueries({ queryKey: ["/api/attendance/summary"] });
      toast({
        title: "Attendance saved successfully!",
        description: `${presentCount} present, ${absentCount} absent.`,
      });
      // Reset form to default state, ready for the next entry.
      // Keep batch + date so the teacher can quickly mark another subject
      // for the same class on the same day; clear the subject and presence.
      setSubject("");
      const reset: Record<number, boolean> = {};
      studentsInBatch.forEach((s: any) => { reset[s.id] = true; });
      setPresence(reset);
    },
    onError: (err: any) => toast({ variant: "destructive", title: "Save failed", description: err.message }),
  });

  const markAllPresent = () => {
    const next: Record<number, boolean> = {};
    studentsInBatch.forEach((s: any) => { next[s.id] = true; });
    setPresence(next);
  };
  const markAllAbsent = () => {
    const next: Record<number, boolean> = {};
    studentsInBatch.forEach((s: any) => { next[s.id] = false; });
    setPresence(next);
  };

  return (
    <Layout title="Attendance" subtitle="Mark and review daily attendance">
      <Tabs defaultValue="mark" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3 max-w-xl">
          <TabsTrigger value="mark" data-testid="tab-mark"><ClipboardCheck className="w-4 h-4 mr-1.5" />Mark</TabsTrigger>
          <TabsTrigger value="history" data-testid="tab-history"><HistoryIcon className="w-4 h-4 mr-1.5" />History</TabsTrigger>
          {isAdmin && <TabsTrigger value="summary" data-testid="tab-summary"><BarChart3 className="w-4 h-4 mr-1.5" />Summary</TabsTrigger>}
        </TabsList>

        {/* MARK TAB */}
        <TabsContent value="mark" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Selection</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wider text-slate-600">Batch / Class</Label>
                <Select value={selectedBatchId} onValueChange={setSelectedBatchId}>
                  <SelectTrigger data-testid="select-batch"><SelectValue placeholder="Select Batch" /></SelectTrigger>
                  <SelectContent>
                    {batches?.map((b: any) => (
                      <SelectItem key={b.id} value={String(b.id)}>{b.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wider text-slate-600">Group</Label>
                <Select value={selectedGroup} onValueChange={setSelectedGroup} disabled={!selectedBatchId || availableGroups.length === 0}>
                  <SelectTrigger data-testid="select-group">
                    <SelectValue placeholder={availableGroups.length === 0 ? "—" : "All Groups"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Groups</SelectItem>
                    {availableGroups.map((g) => (
                      <SelectItem key={g} value={g}>{g}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wider text-slate-600">Shift</Label>
                <Select value={selectedShift} onValueChange={setSelectedShift} disabled={!selectedBatchId || availableShifts.length === 0}>
                  <SelectTrigger data-testid="select-shift">
                    <SelectValue placeholder={availableShifts.length === 0 ? "—" : "All Shifts"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Shifts</SelectItem>
                    {availableShifts.map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wider text-slate-600">
                  Subject <span className="text-rose-600" aria-hidden="true">*</span>
                </Label>
                <div className="relative">
                  <BookOpen className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  <Input
                    list="attendance-subjects"
                    placeholder="e.g. Math, Physics"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    required
                    aria-required="true"
                    aria-invalid={!effSubject}
                    data-testid="input-subject"
                    className={`pl-9 ${!effSubject ? 'border-rose-300 focus-visible:ring-rose-300' : ''}`}
                  />
                  <datalist id="attendance-subjects">
                    {subjectOptions.map((s) => <option key={s} value={s} />)}
                  </datalist>
                </div>
                {!effSubject && (
                  <p className="text-[11px] text-rose-600" data-testid="text-subject-required">
                    Subject is required to save attendance.
                  </p>
                )}
              </div>

              <div className="space-y-2 sm:col-span-2 lg:col-span-1">
                <Label className="text-xs font-semibold uppercase tracking-wider text-slate-600">Date</Label>
                <div className="relative">
                  <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  <Input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    data-testid="input-date"
                    className="pl-9"
                  />
                </div>
                {date && (
                  <p className="text-xs font-medium text-slate-600" data-testid="text-day-name">
                    {formatFullDate(date)}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {selectedBatchId && (
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Users className="w-4 h-4 text-blue-500" />
                    <CardTitle className="text-base">Students ({studentsInBatch.length})</CardTitle>
                    {effSubject && <Badge variant="outline" className="text-xs">{effSubject}</Badge>}
                    {effGroup && <Badge variant="outline" className="text-xs">{effGroup}</Badge>}
                    {effShift && <Badge variant="outline" className="text-xs">{effShift}</Badge>}
                    {existing && (
                      <Badge variant="secondary" className="text-xs">Saved for this session</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className="bg-emerald-100 text-emerald-700 border-0 hover:bg-emerald-100 gap-1">
                      <CheckCircle2 className="w-3 h-3" /> {presentCount} Present
                    </Badge>
                    <Badge className="bg-rose-100 text-rose-700 border-0 hover:bg-rose-100 gap-1">
                      <XCircle className="w-3 h-3" /> {absentCount} Absent
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {studentsInBatch.length === 0 ? (
                  <p className="text-sm text-slate-500 text-center py-8">No students match the selected filters.</p>
                ) : (
                  <>
                    <div className="flex flex-wrap gap-2 mb-4">
                      <Button variant="outline" size="sm" onClick={markAllPresent} data-testid="button-mark-all-present">
                        <CheckCircle2 className="w-4 h-4 mr-1.5 text-emerald-600" /> Mark All Present
                      </Button>
                      <Button variant="outline" size="sm" onClick={markAllAbsent} data-testid="button-mark-all-absent">
                        <XCircle className="w-4 h-4 mr-1.5 text-rose-600" /> Mark All Absent
                      </Button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {studentsInBatch.map((s: any) => {
                        const present = presence[s.id] ?? true;
                        return (
                          <div
                            key={s.id}
                            data-testid={`row-attendance-${s.id}`}
                            className={`flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg border transition-colors ${present ? 'bg-emerald-50/50 border-emerald-100' : 'bg-rose-50/50 border-rose-100'}`}
                          >
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-semibold text-slate-800 truncate">{s.name}</p>
                              <p className="text-[11px] text-slate-500 truncate">
                                {s.studentCustomId || `ID ${s.id}`}
                                {s.academicGroup && ` · ${s.academicGroup}`}
                                {s.shift && ` · ${s.shift}`}
                              </p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className={`text-[11px] font-bold uppercase tracking-wider ${present ? 'text-emerald-600' : 'text-rose-600'}`}>
                                {present ? 'Present' : 'Absent'}
                              </span>
                              <Switch
                                checked={present}
                                onCheckedChange={(v) => setPresence(prev => ({ ...prev, [s.id]: v }))}
                                data-testid={`switch-attendance-${s.id}`}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <div className="flex flex-col items-end gap-1 mt-4">
                      <Button
                        onClick={() => {
                          if (!effSubject) {
                            toast({ variant: "destructive", title: "Subject required", description: "Please enter or select a subject before saving." });
                            return;
                          }
                          saveMutation.mutate();
                        }}
                        disabled={saveMutation.isPending || !effSubject}
                        data-testid="button-save-attendance"
                        className="bg-blue-600 hover:bg-blue-700"
                      >
                        {saveMutation.isPending ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Saving...
                          </>
                        ) : existing ? "Update Attendance" : "Save Attendance"}
                      </Button>
                      {!effSubject && (
                        <p className="text-[11px] text-rose-600">Enter a subject to enable saving.</p>
                      )}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* HISTORY TAB */}
        <TabsContent value="history" className="space-y-4">
          <HistoryView batches={batches} students={students} subjectOptions={subjectOptions} />
        </TabsContent>

        {/* SUMMARY TAB (admin) */}
        {isAdmin && (
          <TabsContent value="summary" className="space-y-4">
            <SummaryView subjectOptions={subjectOptions} />
          </TabsContent>
        )}
      </Tabs>
    </Layout>
  );
}

function HistoryView({ batches, students, subjectOptions }: { batches: any[]; students: any[]; subjectOptions: string[] }) {
  const [batchId, setBatchId] = useState<string>("");
  const [group, setGroup] = useState<string>("all");
  const [filterSubject, setFilterSubject] = useState<string>("");
  const { activePortal } = usePortal();

  const batchStudents = (students || []).filter((s: any) => !batchId || String(s.batchId) === batchId);
  const availableGroups = Array.from(new Set(batchStudents.map((s: any) => s.academicGroup).filter(Boolean))) as string[];

  // Auto-clear group when batch changes
  useEffect(() => {
    setGroup("all");
  }, [batchId]);

  const { data: rows = [], isLoading } = useQuery<AttendanceRow[]>({
    queryKey: ["/api/attendance", "history", batchId || "all", group, filterSubject, activePortal],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (batchId) params.set("batchId", batchId);
      if (group !== "all") params.set("academicGroup", group);
      if (filterSubject) params.set("subject", filterSubject);
      params.set("portal", activePortal);
      const res = await fetch(`/api/attendance?${params.toString()}`);
      if (!res.ok) return [];
      return res.json();
    },
    staleTime: 0,
    refetchOnMount: "always",
  });

  const queryClient = useQueryClient();
  const { toast } = useToast();
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/attendance/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/attendance"] });
      queryClient.invalidateQueries({ queryKey: ["/api/attendance/summary"] });
      toast({ title: "Session deleted", description: "Attendance session and its records were removed." });
    },
    onError: (err: any) => toast({ variant: "destructive", title: "Delete failed", description: err?.message || "Could not delete session" }),
  });

  const handleDeleteSession = (s: AttendanceRow) => {
    const label = `${s.date}${s.subject ? ` · ${s.subject}` : ''}`;
    if (confirm(`Are you sure you want to delete this attendance session (${label})? This will remove all student records in this session and cannot be undone.`)) {
      deleteMutation.mutate(s.id);
    }
  };

  const studentName = (id: number) => students.find((s: any) => s.id === id)?.name || `Student #${id}`;
  const studentMobile = (id: number): string | null => {
    const s = students.find((st: any) => st.id === id);
    return s?.mobileNumber || null;
  };
  const buildAbsentMessage = (date: string, subject: string | null | undefined, name: string) => {
    const subjPart = subject && subject.trim() ? `${subject} ক্লাসে` : "ক্লাসে";
    return `আসসালামু আলাইকুম, আজ ${date} তারিখে ${subjPart} ${name} অনুপস্থিত ছিল। ধন্যবাদ - ডায়নামিক কোচিং সেন্টার।`;
  };
  const toWaNumber = (mobile: string) => {
    const digits = mobile.replace(/\D/g, "");
    if (digits.startsWith("880")) return digits;
    if (digits.startsWith("0")) return `880${digits.slice(1)}`;
    return digits;
  };
  const batchName = (id: number) => batches.find((b: any) => b.id === id)?.name || `Batch #${id}`;

  // Group rows by batch
  const byBatch: Record<number, AttendanceRow[]> = {};
  rows.forEach(r => {
    if (!byBatch[r.batchId]) byBatch[r.batchId] = [];
    byBatch[r.batchId].push(r);
  });

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <CardTitle className="text-base flex items-center gap-2">
            <HistoryIcon className="w-4 h-4 text-blue-500" /> Attendance History
          </CardTitle>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3">
          <Select value={batchId || "__all__"} onValueChange={(v) => setBatchId(v === "__all__" ? "" : v)}>
            <SelectTrigger data-testid="select-history-batch"><SelectValue placeholder="All Batches" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All Batches</SelectItem>
              {batches.map((b: any) => <SelectItem key={b.id} value={String(b.id)}>{b.name}</SelectItem>)}
            </SelectContent>
          </Select>

          <Select value={group} onValueChange={setGroup} disabled={!batchId || availableGroups.length === 0}>
            <SelectTrigger data-testid="select-history-group"><SelectValue placeholder={availableGroups.length === 0 ? "—" : "All Groups"} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Groups</SelectItem>
              {availableGroups.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
            </SelectContent>
          </Select>

          <div className="relative">
            <BookOpen className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            <Input
              list="attendance-history-subjects"
              placeholder="All Subjects"
              value={filterSubject}
              onChange={(e) => setFilterSubject(e.target.value)}
              data-testid="input-history-subject"
              className="pl-9"
            />
            <datalist id="attendance-history-subjects">
              {subjectOptions.map((s) => <option key={s} value={s} />)}
            </datalist>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-slate-500 text-center py-6">Loading...</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-slate-500 text-center py-8">No attendance records match these filters.</p>
        ) : (
          <Accordion type="multiple" className="space-y-2">
            {Object.entries(byBatch).map(([bId, sessions]) => (
              <AccordionItem key={bId} value={bId} className="border border-slate-200 rounded-xl overflow-hidden">
                <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-slate-50">
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-slate-800">{batchName(Number(bId))}</span>
                    <Badge variant="secondary" className="text-xs">{sessions.length} session{sessions.length !== 1 ? 's' : ''}</Badge>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="p-0">
                  <div className="divide-y divide-slate-100">
                    {sessions.map(s => {
                      const present = (s.totalStudents || 0) - (s.absentStudentIds?.length || 0);
                      const pct = s.totalStudents ? Math.round((present / s.totalStudents) * 100) : 0;
                      return (
                        <div key={s.id} className="px-4 py-3" data-testid={`history-row-${s.id}`}>
                          <div className="flex items-center justify-between flex-wrap gap-2 mb-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <CalendarDays className="w-4 h-4 text-slate-400" />
                              <span className="font-semibold text-sm text-slate-800">{formatDayName(s.date)}, {s.date}</span>
                              {s.subject && <Badge variant="outline" className="text-[10px] h-5">{s.subject}</Badge>}
                              {s.academicGroup && <Badge variant="outline" className="text-[10px] h-5">{s.academicGroup}</Badge>}
                              {s.shift && <Badge variant="outline" className="text-[10px] h-5">{s.shift}</Badge>}
                              <Badge className={`text-xs border-0 ${pct >= 75 ? 'bg-emerald-100 text-emerald-700' : pct >= 50 ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700'}`}>
                                {pct}% present
                              </Badge>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="text-xs text-slate-500">{present}/{s.totalStudents} present</span>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => handleDeleteSession(s)}
                                disabled={deleteMutation.isPending}
                                aria-label="Delete session"
                                className="h-8 w-8 text-rose-500 hover:text-rose-700 hover:bg-rose-50"
                                data-testid={`button-delete-session-${s.id}`}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                          {s.absentStudentIds?.length > 0 && (
                            <div className="mt-2">
                              <p className="text-[11px] font-semibold uppercase tracking-wider text-rose-600 mb-1.5">
                                Absent ({s.absentStudentIds.length})
                              </p>
                              <div className="space-y-1.5">
                                {s.absentStudentIds.map(sid => {
                                  const name = studentName(sid);
                                  const mobile = studentMobile(sid);
                                  const message = buildAbsentMessage(s.date, s.subject, name);
                                  const waHref = mobile
                                    ? `https://wa.me/${toWaNumber(mobile)}?text=${encodeURIComponent(message)}`
                                    : null;
                                  return (
                                    <div
                                      key={sid}
                                      className="flex items-center justify-between gap-2 px-3 py-2 bg-rose-50 border border-rose-100 rounded-lg"
                                      data-testid={`absent-row-${s.id}-${sid}`}
                                    >
                                      <div className="min-w-0 flex-1">
                                        <p className="text-sm font-medium text-slate-800 truncate" data-testid={`text-absent-name-${sid}`}>
                                          {name}
                                        </p>
                                        {mobile ? (
                                          <a
                                            href={`tel:${mobile.replace(/\s+/g, '')}`}
                                            className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline mt-0.5"
                                            data-testid={`link-call-${sid}`}
                                          >
                                            <Phone className="w-3 h-3" />
                                            {mobile}
                                          </a>
                                        ) : (
                                          <span className="text-[11px] text-slate-400">No phone on file</span>
                                        )}
                                      </div>
                                      {waHref && (
                                        <a
                                          href={waHref}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="shrink-0 inline-flex items-center justify-center w-9 h-9 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white transition-colors"
                                          aria-label={`Send WhatsApp message to ${name}'s guardian`}
                                          data-testid={`link-whatsapp-${sid}`}
                                        >
                                          <SiWhatsapp className="w-4 h-4" />
                                        </a>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        )}
      </CardContent>
    </Card>
  );
}

function SummaryView({ subjectOptions }: { subjectOptions: string[] }) {
  const [filterSubject, setFilterSubject] = useState<string>("");
  const [filterGroup, setFilterGroup] = useState<string>("");

  const { data: summary = [], isLoading } = useQuery<SummaryRow[]>({
    queryKey: ["/api/attendance/summary", filterSubject, filterGroup],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filterSubject) params.set("subject", filterSubject);
      if (filterGroup) params.set("academicGroup", filterGroup);
      const res = await fetch(`/api/attendance/summary${params.toString() ? `?${params.toString()}` : ''}`);
      if (!res.ok) return [];
      return res.json();
    },
  });

  // Pull groups out of all attendance records (for the filter dropdown)
  const { data: allAttendance = [] } = useQuery<AttendanceRow[]>({ queryKey: ["/api/attendance"] });
  const allGroups = Array.from(new Set((allAttendance || []).map(a => a.academicGroup).filter(Boolean))) as string[];

  const barColor = (pct: number) => pct >= 75 ? 'bg-emerald-500' : pct >= 50 ? 'bg-amber-500' : 'bg-rose-500';

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-blue-500" /> Batch Attendance Summary
        </CardTitle>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3">
          <Select value={filterGroup || "__all__"} onValueChange={(v) => setFilterGroup(v === "__all__" ? "" : v)}>
            <SelectTrigger data-testid="select-summary-group"><SelectValue placeholder="All Groups" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All Groups</SelectItem>
              {allGroups.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
            </SelectContent>
          </Select>

          <div className="relative">
            <BookOpen className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            <Input
              list="attendance-summary-subjects"
              placeholder="All Subjects"
              value={filterSubject}
              onChange={(e) => setFilterSubject(e.target.value)}
              data-testid="input-summary-subject"
              className="pl-9"
            />
            <datalist id="attendance-summary-subjects">
              {subjectOptions.map((s) => <option key={s} value={s} />)}
            </datalist>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-slate-500 text-center py-6">Loading...</p>
        ) : summary.length === 0 ? (
          <p className="text-sm text-slate-500 text-center py-8">No batches found.</p>
        ) : (
          <div className="space-y-3">
            {summary.map(s => (
              <div key={s.batchId} className="border border-slate-200 rounded-xl p-4" data-testid={`summary-row-${s.batchId}`}>
                <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
                  <div>
                    <p className="font-bold text-slate-800">{s.batchName}</p>
                    <p className="text-[11px] text-slate-500">
                      {s.totalSessions} session{s.totalSessions !== 1 ? 's' : ''}
                      {s.lastDate && ` · last on ${formatDayName(s.lastDate)}, ${s.lastDate}`}
                    </p>
                  </div>
                  <span className="text-2xl font-extrabold text-slate-800">{s.averageAttendance.toFixed(1)}%</span>
                </div>
                <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className={`h-full ${barColor(s.averageAttendance)} transition-all`}
                    style={{ width: `${Math.min(100, Math.max(0, s.averageAttendance))}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
