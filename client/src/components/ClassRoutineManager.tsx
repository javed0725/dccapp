import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useBatches } from "@/hooks/use-finance";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { CalendarDays, Pencil, Trash2, Plus, Clock } from "lucide-react";

// ── Constants ─────────────────────────────────────────────────────────────────

export const SHIFTS = ["Morning", "Evening"] as const;
export const ACADEMIC_GROUPS = [
  "Science",
  "Commerce",
  "Arts",
] as const;

const DAYS_OF_WEEK = [
  "Saturday","Sunday","Monday","Tuesday","Wednesday","Thursday","Friday",
] as const;

type DayOfWeek = typeof DAYS_OF_WEEK[number];

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ClassRoutine {
  id: number;
  batchId: number;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  subjectName: string;
  isOffDay: boolean;
  shift: string | null;
  academicGroup: string | null;
  createdAt: string;
}

// ── Form schema ───────────────────────────────────────────────────────────────

const routineFormSchema = z.object({
  batchId:      z.coerce.number().min(1, "Select a class"),
  dayOfWeek:    z.enum(DAYS_OF_WEEK, { required_error: "Select a day" }),
  startTime:    z.string().default(""),
  endTime:      z.string().default(""),
  subjectName:  z.string().default(""),
  isOffDay:     z.boolean().default(false),
  shift:        z.string().nullable().optional(),
  academicGroup: z.string().nullable().optional(),
});

type RoutineFormValues = z.infer<typeof routineFormSchema>;

// ── Helpers ───────────────────────────────────────────────────────────────────

const DAY_SHORT: Record<string, string> = {
  Saturday: "Sat", Sunday: "Sun", Monday: "Mon",
  Tuesday: "Tue", Wednesday: "Wed", Thursday: "Thu", Friday: "Fri",
};

function ShiftBadge({ shift }: { shift: string | null }) {
  return (
    <Badge variant="outline" className="text-[9px] h-3.5 px-1 border-blue-200 text-blue-600 bg-blue-50">
      {shift || "All Shifts"}
    </Badge>
  );
}
function GroupBadge({ group }: { group: string | null }) {
  return (
    <Badge variant="outline" className="text-[9px] h-3.5 px-1 border-purple-200 text-purple-600 bg-purple-50">
      {group || "All Groups"}
    </Badge>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ClassRoutineManager() {
  const { data: batches } = useBatches();
  const { toast } = useToast();
  const [selectedBatchId, setSelectedBatchId] = useState<number | null>(null);
  const [editingRoutine, setEditingRoutine] = useState<ClassRoutine | null>(null);

  const { data: routines = [], isLoading } = useQuery<ClassRoutine[]>({
    queryKey: ["/api/class-routines", selectedBatchId],
    queryFn: async () => {
      const url = selectedBatchId
        ? `/api/class-routines?batchId=${selectedBatchId}`
        : "/api/class-routines";
      const res = await apiRequest("GET", url);
      return res.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: RoutineFormValues) => {
      const res = await apiRequest("POST", "/api/class-routines", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/class-routines"] });
      form.reset({
        batchId: selectedBatchId ?? 0,
        dayOfWeek: "Saturday",
        startTime: "", endTime: "", subjectName: "",
        isOffDay: false, shift: null, academicGroup: null,
      });
      toast({ title: "Routine slot added" });
    },
    onError: (err: any) => {
      toast({ variant: "destructive", title: "Error", description: err.message });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<RoutineFormValues> }) => {
      const res = await apiRequest("PUT", `/api/class-routines/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/class-routines"] });
      setEditingRoutine(null);
      toast({ title: "Routine updated" });
    },
    onError: (err: any) => {
      toast({ variant: "destructive", title: "Update failed", description: err.message });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/class-routines/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/class-routines"] });
      toast({ title: "Routine slot deleted" });
    },
  });

  const form = useForm<RoutineFormValues>({
    resolver: zodResolver(routineFormSchema),
    defaultValues: {
      batchId: selectedBatchId ?? 0,
      dayOfWeek: "Saturday",
      startTime: "", endTime: "", subjectName: "",
      isOffDay: false, shift: null, academicGroup: null,
    },
  });

  const isOffDayWatch = form.watch("isOffDay");

  const onSubmit = (values: RoutineFormValues) => {
    createMutation.mutate(values);
  };

  // Group displayed routines by day
  const filteredRoutines = selectedBatchId
    ? routines.filter(r => r.batchId === selectedBatchId)
    : routines;

  const routinesByDay: Record<string, ClassRoutine[]> = {};
  for (const day of DAYS_OF_WEEK) {
    routinesByDay[day] = filteredRoutines.filter(r => r.dayOfWeek === day);
  }

  // Edit dialog state
  const [editForm, setEditForm] = useState<Partial<RoutineFormValues>>({});

  function openEdit(r: ClassRoutine) {
    setEditingRoutine(r);
    setEditForm({
      batchId: r.batchId,
      dayOfWeek: r.dayOfWeek as DayOfWeek,
      startTime: r.startTime,
      endTime: r.endTime,
      subjectName: r.subjectName,
      isOffDay: r.isOffDay,
      shift: r.shift ?? null,
      academicGroup: r.academicGroup ?? null,
    });
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

      {/* ── Add Slot Form ─────────────────────────────────────────────────── */}
      <Card className="lg:col-span-1">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarDays className="w-5 h-5 text-primary" />
            Add Routine Slot
          </CardTitle>
          <CardDescription>Assign a subject or off-day to a class &amp; day</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">

              {/* Class / Batch */}
              <FormField
                control={form.control}
                name="batchId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Class / Batch</FormLabel>
                    <Select
                      value={field.value ? String(field.value) : ""}
                      onValueChange={(v) => {
                        field.onChange(Number(v));
                        setSelectedBatchId(Number(v));
                      }}
                    >
                      <FormControl>
                        <SelectTrigger><SelectValue placeholder="Select class" /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {batches?.map(b => (
                          <SelectItem key={b.id} value={String(b.id)}>{b.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Day of Week */}
              <FormField
                control={form.control}
                name="dayOfWeek"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Day of Week</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger><SelectValue placeholder="Select day" /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {DAYS_OF_WEEK.map(d => (
                          <SelectItem key={d} value={d}>{d}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Shift (optional) */}
              <FormField
                control={form.control}
                name="shift"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Shift <span className="text-muted-foreground font-normal text-xs">(optional)</span>
                    </FormLabel>
                    <Select
                      value={field.value ?? "__any__"}
                      onValueChange={(v) => field.onChange(v === "__any__" ? null : v)}
                    >
                      <FormControl>
                        <SelectTrigger><SelectValue placeholder="All Shifts" /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="__any__">All Shifts</SelectItem>
                        {SHIFTS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Academic Group (optional) */}
              <FormField
                control={form.control}
                name="academicGroup"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Group <span className="text-muted-foreground font-normal text-xs">(optional)</span>
                    </FormLabel>
                    <Select
                      value={field.value ?? "__any__"}
                      onValueChange={(v) => field.onChange(v === "__any__" ? null : v)}
                    >
                      <FormControl>
                        <SelectTrigger><SelectValue placeholder="All Groups" /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="__any__">All Groups</SelectItem>
                        {ACADEMIC_GROUPS.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Off Day toggle */}
              <FormField
                control={form.control}
                name="isOffDay"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border px-4 py-3">
                    <FormLabel className="cursor-pointer">Set as Off Day</FormLabel>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />

              {/* Subject + Times — hidden when off day */}
              {!isOffDayWatch && (
                <>
                  <FormField
                    control={form.control}
                    name="subjectName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Subject</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. Mathematics" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <FormField
                      control={form.control}
                      name="startTime"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Start Time</FormLabel>
                          <FormControl>
                            <Input placeholder="07:00 AM" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="endTime"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>End Time</FormLabel>
                          <FormControl>
                            <Input placeholder="08:00 AM" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </>
              )}

              <Button type="submit" className="w-full" disabled={createMutation.isPending}>
                <Plus className="w-4 h-4 mr-2" />
                {createMutation.isPending ? "Adding..." : "Add Slot"}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      {/* ── Weekly Routine Table ──────────────────────────────────────────── */}
      <Card className="lg:col-span-2">
        <CardHeader>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-primary" />
                Weekly Routine
              </CardTitle>
              <CardDescription>
                {selectedBatchId
                  ? `Showing schedule for ${batches?.find(b => b.id === selectedBatchId)?.name ?? "selected class"}`
                  : "Select a class to filter, or see all"}
              </CardDescription>
            </div>
            <Select
              value={selectedBatchId ? String(selectedBatchId) : "all"}
              onValueChange={(v) => setSelectedBatchId(v === "all" ? null : Number(v))}
            >
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filter by class" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Classes</SelectItem>
                {batches?.map(b => (
                  <SelectItem key={b.id} value={String(b.id)}>{b.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {isLoading ? (
            <p className="text-center text-muted-foreground py-8">Loading...</p>
          ) : filteredRoutines.length === 0 ? (
            <p className="text-center text-muted-foreground py-8 italic">
              No routine slots added yet. Use the form to get started.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[90px]">Day</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>Time Slot</TableHead>
                  <TableHead>Shift / Group</TableHead>
                  {!selectedBatchId && <TableHead>Class</TableHead>}
                  <TableHead className="w-[90px] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {DAYS_OF_WEEK.map(day => {
                  const slots = routinesByDay[day];
                  if (slots.length === 0) return null;
                  return slots.map((slot, idx) => (
                    <TableRow key={slot.id} className="group hover:bg-muted/30">
                      {idx === 0 && (
                        <TableCell rowSpan={slots.length} className="font-semibold text-primary align-top pt-3">
                          {DAY_SHORT[day] ?? day}
                        </TableCell>
                      )}
                      <TableCell>
                        {slot.isOffDay ? (
                          <Badge variant="secondary" className="bg-red-50 text-red-600 border-red-200 text-xs font-bold">
                            OFF DAY
                          </Badge>
                        ) : (
                          <span className="font-medium">
                            {slot.subjectName || <span className="text-muted-foreground italic text-sm">No subject</span>}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {slot.isOffDay ? "—" : (
                          slot.startTime && slot.endTime
                            ? `${slot.startTime} – ${slot.endTime}`
                            : slot.startTime || slot.endTime || "—"
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 flex-wrap">
                          <ShiftBadge shift={slot.shift} />
                          <GroupBadge group={slot.academicGroup} />
                        </div>
                      </TableCell>
                      {!selectedBatchId && (
                        <TableCell className="text-xs text-muted-foreground">
                          {batches?.find(b => b.id === slot.batchId)?.name ?? `Batch #${slot.batchId}`}
                        </TableCell>
                      )}
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button
                            variant="ghost" size="icon" className="h-7 w-7"
                            onClick={() => openEdit(slot)}
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="ghost" size="icon" className="h-7 w-7 text-destructive"
                            onClick={() => {
                              if (confirm("Delete this routine slot?")) deleteMutation.mutate(slot.id);
                            }}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ));
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* ── Edit Dialog ───────────────────────────────────────────────────── */}
      <Dialog open={!!editingRoutine} onOpenChange={(open) => !open && setEditingRoutine(null)}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle>Edit Routine Slot</DialogTitle>
          </DialogHeader>
          {editingRoutine && (
            <div className="space-y-4 py-2">

              {/* Class */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Class / Batch</label>
                <Select
                  value={String(editForm.batchId ?? editingRoutine.batchId)}
                  onValueChange={(v) => setEditForm(f => ({ ...f, batchId: Number(v) }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {batches?.map(b => (
                      <SelectItem key={b.id} value={String(b.id)}>{b.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Day */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Day of Week</label>
                <Select
                  value={editForm.dayOfWeek ?? editingRoutine.dayOfWeek}
                  onValueChange={(v) => setEditForm(f => ({ ...f, dayOfWeek: v as DayOfWeek }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DAYS_OF_WEEK.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              {/* Shift */}
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Shift <span className="text-muted-foreground font-normal text-xs">(optional)</span>
                </label>
                <Select
                  value={('shift' in editForm ? editForm.shift : editingRoutine.shift) ?? "__any__"}
                  onValueChange={(v) => setEditForm(f => ({ ...f, shift: v === "__any__" ? null : v }))}
                >
                  <SelectTrigger><SelectValue placeholder="All Shifts" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__any__">All Shifts</SelectItem>
                    {SHIFTS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              {/* Academic Group */}
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Group <span className="text-muted-foreground font-normal text-xs">(optional)</span>
                </label>
                <Select
                  value={('academicGroup' in editForm ? editForm.academicGroup : editingRoutine.academicGroup) ?? "__any__"}
                  onValueChange={(v) => setEditForm(f => ({ ...f, academicGroup: v === "__any__" ? null : v }))}
                >
                  <SelectTrigger><SelectValue placeholder="All Groups" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__any__">All Groups</SelectItem>
                    {ACADEMIC_GROUPS.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              {/* Off Day */}
              <div className="flex items-center justify-between rounded-lg border px-4 py-3">
                <label className="text-sm font-medium">Set as Off Day</label>
                <Switch
                  checked={editForm.isOffDay ?? editingRoutine.isOffDay}
                  onCheckedChange={(v) => setEditForm(f => ({ ...f, isOffDay: v }))}
                />
              </div>

              {/* Subject + Times */}
              {!(editForm.isOffDay ?? editingRoutine.isOffDay) && (
                <>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Subject</label>
                    <Input
                      value={editForm.subjectName ?? editingRoutine.subjectName}
                      onChange={(e) => setEditForm(f => ({ ...f, subjectName: e.target.value }))}
                      placeholder="e.g. English"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Start Time</label>
                      <Input
                        value={editForm.startTime ?? editingRoutine.startTime}
                        onChange={(e) => setEditForm(f => ({ ...f, startTime: e.target.value }))}
                        placeholder="07:00 AM"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">End Time</label>
                      <Input
                        value={editForm.endTime ?? editingRoutine.endTime}
                        onChange={(e) => setEditForm(f => ({ ...f, endTime: e.target.value }))}
                        placeholder="08:00 AM"
                      />
                    </div>
                  </div>
                </>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setEditingRoutine(null)}>Cancel</Button>
                <Button
                  disabled={updateMutation.isPending}
                  onClick={() => updateMutation.mutate({ id: editingRoutine.id, data: editForm })}
                >
                  {updateMutation.isPending ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

    </div>
  );
}
