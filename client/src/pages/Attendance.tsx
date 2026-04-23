import { useState, useMemo, useEffect } from "react";
import { Layout } from "@/components/Layout";
import { useStudents, useBatches } from "@/hooks/use-finance";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { type User } from "@/lib/schemas";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { CalendarDays, Users, CheckCircle2, XCircle, ClipboardCheck, History as HistoryIcon, BarChart3 } from "lucide-react";

type AttendanceRow = {
  id: number;
  date: string;
  batchId: number;
  teacherId: number | null;
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

export default function Attendance() {
  const { data: user } = useQuery<User>({ queryKey: ["/api/user"] });
  const isAdmin = user?.role === "admin";
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: batches = [] } = useBatches();
  const { data: students = [] } = useStudents();

  const [selectedBatchId, setSelectedBatchId] = useState<string>("");
  const [date, setDate] = useState<string>(todayISO());
  const [presence, setPresence] = useState<Record<number, boolean>>({});

  const studentsInBatch = useMemo(
    () => (students || []).filter((s: any) => String(s.batchId) === selectedBatchId),
    [students, selectedBatchId]
  );

  const { data: existing } = useQuery<AttendanceRow | null>({
    queryKey: ["/api/attendance", selectedBatchId, date],
    queryFn: async () => {
      if (!selectedBatchId || !date) return null;
      const res = await fetch(`/api/attendance?batchId=${selectedBatchId}&date=${date}`);
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!selectedBatchId && !!date,
  });

  // Hydrate presence map whenever batch / date / existing record changes
  useEffect(() => {
    const initial: Record<number, boolean> = {};
    const absentSet = new Set<number>(existing?.absentStudentIds || []);
    studentsInBatch.forEach((s: any) => {
      initial[s.id] = !absentSet.has(s.id);
    });
    setPresence(initial);
  }, [selectedBatchId, date, existing, studentsInBatch.length]);

  const presentCount = Object.values(presence).filter(Boolean).length;
  const absentCount = studentsInBatch.length - presentCount;

  const saveMutation = useMutation({
    mutationFn: async () => {
      const absentStudentIds = studentsInBatch.filter((s: any) => !presence[s.id]).map((s: any) => s.id);
      const res = await apiRequest("POST", "/api/attendance", {
        date,
        batchId: Number(selectedBatchId),
        absentStudentIds,
        totalStudents: studentsInBatch.length,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/attendance"] });
      queryClient.invalidateQueries({ queryKey: ["/api/attendance/summary"] });
      toast({ title: "Attendance saved", description: `${presentCount} present, ${absentCount} absent.` });
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
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                <Label className="text-xs font-semibold uppercase tracking-wider text-slate-600">Date</Label>
                <div className="relative">
                  <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  <Input
                    type="date"
                    value={date}
                    onChange={e => setDate(e.target.value)}
                    data-testid="input-date"
                    className="pl-9"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {selectedBatchId && (
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-blue-500" />
                    <CardTitle className="text-base">Students ({studentsInBatch.length})</CardTitle>
                    {existing && (
                      <Badge variant="secondary" className="text-xs">Saved on this date</Badge>
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
                  <p className="text-sm text-slate-500 text-center py-8">No students in this batch.</p>
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
                              <p className="text-[11px] text-slate-500 truncate">{s.studentCustomId || `ID ${s.id}`}</p>
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
                    <div className="flex justify-end mt-4">
                      <Button
                        onClick={() => saveMutation.mutate()}
                        disabled={saveMutation.isPending}
                        data-testid="button-save-attendance"
                        className="bg-blue-600 hover:bg-blue-700"
                      >
                        {saveMutation.isPending ? "Saving..." : existing ? "Update Attendance" : "Save Attendance"}
                      </Button>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* HISTORY TAB */}
        <TabsContent value="history" className="space-y-4">
          <HistoryView batches={batches} students={students} />
        </TabsContent>

        {/* SUMMARY TAB (admin) */}
        {isAdmin && (
          <TabsContent value="summary" className="space-y-4">
            <SummaryView />
          </TabsContent>
        )}
      </Tabs>
    </Layout>
  );
}

function HistoryView({ batches, students }: { batches: any[]; students: any[] }) {
  const [batchId, setBatchId] = useState<string>("");
  const { data: rows = [], isLoading } = useQuery<AttendanceRow[]>({
    queryKey: ["/api/attendance", batchId || "all"],
    queryFn: async () => {
      const url = batchId ? `/api/attendance?batchId=${batchId}` : `/api/attendance`;
      const res = await fetch(url);
      if (!res.ok) return [];
      return res.json();
    },
  });

  const studentName = (id: number) => students.find((s: any) => s.id === id)?.name || `Student #${id}`;
  const batchName = (id: number) => batches.find((b: any) => b.id === id)?.name || `Batch #${id}`;

  // Group by batch then date
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
          <div className="w-full sm:w-64">
            <Select value={batchId || "__all__"} onValueChange={(v) => setBatchId(v === "__all__" ? "" : v)}>
              <SelectTrigger data-testid="select-history-batch"><SelectValue placeholder="All Batches" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All Batches</SelectItem>
                {batches.map((b: any) => <SelectItem key={b.id} value={String(b.id)}>{b.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-slate-500 text-center py-6">Loading...</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-slate-500 text-center py-8">No attendance records yet.</p>
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
                            <div className="flex items-center gap-2">
                              <CalendarDays className="w-4 h-4 text-slate-400" />
                              <span className="font-semibold text-sm text-slate-800">{s.date}</span>
                              <Badge className={`text-xs border-0 ${pct >= 75 ? 'bg-emerald-100 text-emerald-700' : pct >= 50 ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700'}`}>
                                {pct}% present
                              </Badge>
                            </div>
                            <span className="text-xs text-slate-500">{present}/{s.totalStudents} present</span>
                          </div>
                          {s.absentStudentIds?.length > 0 && (
                            <div className="mt-1.5 flex flex-wrap gap-1.5">
                              <span className="text-[11px] font-semibold uppercase tracking-wider text-rose-600 mr-1">Absent:</span>
                              {s.absentStudentIds.map(sid => (
                                <span key={sid} className="text-xs px-2 py-0.5 bg-rose-50 text-rose-700 rounded-md border border-rose-100">
                                  {studentName(sid)}
                                </span>
                              ))}
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

function SummaryView() {
  const { data: summary = [], isLoading } = useQuery<SummaryRow[]>({
    queryKey: ["/api/attendance/summary"],
  });

  const barColor = (pct: number) => pct >= 75 ? 'bg-emerald-500' : pct >= 50 ? 'bg-amber-500' : 'bg-rose-500';

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-blue-500" /> Batch Attendance Summary
        </CardTitle>
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
                      {s.lastDate && ` · last on ${s.lastDate}`}
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
