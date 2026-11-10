import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Pencil, Plus, Save, Trash2, X } from "lucide-react";
import { useBatches } from "@/hooks/use-finance";

type SubjectMaster = {
  id: number;
  name: string;
  batchId: number | null;
  totalMarks: number;
  mcqEnabled: boolean;
  cqEnabled: boolean;
  practicalEnabled: boolean;
  mcqMax: number;
  cqMax: number;
  practicalMax: number;
  allGroups: boolean;
};

type SubjectForm = {
  name: string;
  batchId: string;
  totalMarks: string;
  mcqEnabled: boolean;
  cqEnabled: boolean;
  practicalEnabled: boolean;
  mcqMax: string;
  cqMax: string;
  practicalMax: string;
  allGroups: boolean;
};

const blankForm: SubjectForm = {
  name: "",
  batchId: "all",
  totalMarks: "100",
  mcqEnabled: false,
  cqEnabled: false,
  practicalEnabled: false,
  mcqMax: "0",
  cqMax: "0",
  practicalMax: "0",
  allGroups: false,
};

const componentFields = [
  { enabledKey: "mcqEnabled", maxKey: "mcqMax", label: "MCQ" },
  { enabledKey: "cqEnabled", maxKey: "cqMax", label: "CQ" },
  { enabledKey: "practicalEnabled", maxKey: "practicalMax", label: "Practical" },
] as const;

export function SubjectMasterManager() {
  const { toast } = useToast();
  const { data: batches = [] } = useBatches();
  const [form, setForm] = useState<SubjectForm>(blankForm);
  const [editingId, setEditingId] = useState<number | null>(null);

  const { data: subjects = [], isLoading } = useQuery<SubjectMaster[]>({
    queryKey: ["/api/subject-master-list"],
  });

  const saveSubject = useMutation({
    mutationFn: async (payload: Omit<SubjectMaster, "id">) => {
      const response = editingId
        ? await apiRequest("PATCH", `/api/subject-master-list/${editingId}`, payload)
        : await apiRequest("POST", "/api/subject-master-list", payload);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/subject-master-list"] });
      toast({ title: editingId ? "Subject updated" : "Subject added" });
      resetForm();
    },
    onError: (error: any) => toast({
      variant: "destructive",
      title: "Could not save subject",
      description: error.message,
    }),
  });

  const deleteSubject = useMutation({
    mutationFn: async (id: number) => apiRequest("DELETE", `/api/subject-master-list/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/subject-master-list"] });
      toast({ title: "Subject removed from master list" });
    },
    onError: (error: any) => toast({
      variant: "destructive",
      title: "Could not delete subject",
      description: error.message,
    }),
  });

  function resetForm() {
    setEditingId(null);
    setForm(blankForm);
  }

  function toggleComponent(index: number, enabled: boolean) {
    const nextEnabled = componentFields.map((field, fieldIndex) =>
      fieldIndex === index ? enabled : form[field.enabledKey]
    );
    const count = nextEnabled.filter(Boolean).length;
    const activeIndexes = nextEnabled.map((active, fieldIndex) => active ? fieldIndex : -1).filter((fieldIndex) => fieldIndex >= 0);
    const total = Number(form.totalMarks) || 0;
    const share = count ? Math.floor(total / count) : 0;
    let remainder = count ? total - share * count : 0;
    const next = { ...form };
    componentFields.forEach((field, fieldIndex) => {
      next[field.enabledKey] = nextEnabled[fieldIndex];
      const amount = nextEnabled[fieldIndex]
        ? share + (fieldIndex === activeIndexes[activeIndexes.length - 1] ? remainder : 0)
        : 0;
      next[field.maxKey] = String(amount);
      if (fieldIndex === activeIndexes[activeIndexes.length - 1]) remainder = 0;
    });
    setForm(next);
  }

  function startEditing(subject: SubjectMaster) {
    setEditingId(subject.id);
    setForm({
      name: subject.name,
      batchId: subject.batchId === null ? "all" : String(subject.batchId),
      totalMarks: String(subject.totalMarks),
      mcqEnabled: subject.mcqEnabled,
      cqEnabled: subject.cqEnabled,
      practicalEnabled: subject.practicalEnabled,
      mcqMax: String(subject.mcqMax),
      cqMax: String(subject.cqMax),
      practicalMax: String(subject.practicalMax),
      allGroups: subject.allGroups,
    });
  }

  function submitForm() {
    const totalMarks = Number(form.totalMarks);
    const enabled = componentFields.filter((field) => form[field.enabledKey]);
    const parsedLimits = enabled.map((field) => Number(form[field.maxKey]));
    if (!form.name.trim()) {
      toast({ variant: "destructive", title: "Enter a subject name" });
      return;
    }
    if (!Number.isInteger(totalMarks) || totalMarks < 1 || totalMarks > 1000) {
      toast({ variant: "destructive", title: "Total Marks must be between 1 and 1000" });
      return;
    }
    if (enabled.length && (parsedLimits.some((limit) => !Number.isInteger(limit) || limit <= 0 || limit > totalMarks) || parsedLimits.reduce((sum, limit) => sum + limit, 0) !== totalMarks)) {
      toast({ variant: "destructive", title: "Component limits must add up to Total Marks" });
      return;
    }
    saveSubject.mutate({
      name: form.name.trim(),
      batchId: form.batchId === "all" ? null : Number(form.batchId),
      totalMarks,
      mcqEnabled: form.mcqEnabled,
      cqEnabled: form.cqEnabled,
      practicalEnabled: form.practicalEnabled,
      mcqMax: form.mcqEnabled ? Number(form.mcqMax) : 0,
      cqMax: form.cqEnabled ? Number(form.cqMax) : 0,
      practicalMax: form.practicalEnabled ? Number(form.practicalMax) : 0,
      allGroups: form.allGroups,
    });
  }

  const selectedCount = componentFields.filter((field) => form[field.enabledKey]).length;
  const totalMarks = Number(form.totalMarks) || 0;
  const componentTotal = componentFields.reduce((sum, field) =>
    sum + (form[field.enabledKey] ? Number(form[field.maxKey] || 0) : 0), 0
  );

  function updateTotalMarks(value: string) {
    const total = Number(value);
    const enabled = componentFields.filter((field) => form[field.enabledKey]);
    const next = { ...form, totalMarks: value };
    if (enabled.length && Number.isInteger(total) && total > 0) {
      const share = Math.floor(total / enabled.length);
      let remainder = total - share * enabled.length;
      enabled.forEach((field, index) => {
        next[field.maxKey] = String(share + (index === enabled.length - 1 ? remainder : 0));
      });
    }
    setForm(next);
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{editingId ? "Edit Pre-defined Subject" : "Add Pre-defined Subject"}</CardTitle>
          <CardDescription>
            Set which mark fields teachers see for a class. If no components are selected, teachers enter one total mark.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-[minmax(180px,1fr)_repeat(3,minmax(130px,0.7fr))]">
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="subject-master-name">Subject name</label>
              <Input
                id="subject-master-name"
                value={form.name}
                maxLength={100}
                placeholder="e.g. Physics"
                onChange={(event) => setForm((previous) => ({ ...previous, name: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Class / Batch</label>
              <Select
                value={form.batchId}
                onValueChange={(batchId) => setForm((previous) => ({ ...previous, batchId }))}
              >
                <SelectTrigger><SelectValue placeholder="All classes" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All classes</SelectItem>
                  {batches.map((batch) => (
                    <SelectItem key={batch.id} value={String(batch.id)}>{batch.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="subject-total-marks">Total Marks</label>
              <Input
                id="subject-total-marks"
                type="number"
                min={1}
                max={1000}
                step={1}
                value={form.totalMarks}
                onChange={(event) => updateTotalMarks(event.target.value)}
              />
            </div>
            {componentFields.map((field, index) => (
              <div key={field.enabledKey} className="rounded-lg border p-3 space-y-3">
                <label className="flex items-center gap-2 text-sm font-semibold">
                  <Checkbox
                    checked={form[field.enabledKey]}
                    onCheckedChange={(checked) => toggleComponent(index, !!checked)}
                  />
                  {field.label}
                </label>
                {form[field.enabledKey] && (
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-muted-foreground" htmlFor={`subject-${field.maxKey}`}>Max</label>
                    <Input
                      id={`subject-${field.maxKey}`}
                      type="number"
                      min={1}
                      max={totalMarks || 1000}
                      step={1}
                      value={form[field.maxKey]}
                      onChange={(event) => setForm((previous) => ({ ...previous, [field.maxKey]: event.target.value }))}
                      className="h-8"
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-medium">
                <Checkbox
                  checked={form.allGroups}
                  onCheckedChange={(checked) => setForm((previous) => ({ ...previous, allGroups: !!checked }))}
                />
                All Groups (compulsory subject)
              </label>
              <p className="text-xs text-muted-foreground">
                {selectedCount ? `Selected maximums: ${componentTotal}/${totalMarks}` : `No components selected: Total Marks /${totalMarks}`}
              </p>
            </div>
            <div className="flex gap-2">
              {editingId !== null && (
                <Button variant="outline" onClick={resetForm} disabled={saveSubject.isPending}>
                  <X className="mr-2 h-4 w-4" /> Cancel
                </Button>
              )}
              <Button onClick={submitForm} disabled={saveSubject.isPending}>
                {editingId ? <Save className="mr-2 h-4 w-4" /> : <Plus className="mr-2 h-4 w-4" />}
                {saveSubject.isPending ? "Saving..." : editingId ? "Save changes" : "Add subject"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pre-defined Subject Master List</CardTitle>
          <CardDescription>Draft creation uses these settings and saves a copy into each draft.</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Subject</TableHead>
                <TableHead>Class / Batch</TableHead>
                <TableHead>Total Marks</TableHead>
                <TableHead>Mark fields</TableHead>
                <TableHead>Groups</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {subjects.map((subject) => {
                const fields = componentFields
                  .filter((field) => subject[field.enabledKey])
                  .map((field) => `${field.label} /${subject[field.maxKey]}`);
                const batchName = subject.batchId === null
                  ? "All classes"
                  : batches.find((batch) => batch.id === subject.batchId)?.name ?? "Unknown class";
                return (
                  <TableRow key={subject.id}>
                    <TableCell className="font-medium">{subject.name}</TableCell>
                    <TableCell>{batchName}</TableCell>
                    <TableCell>{subject.totalMarks}</TableCell>
                    <TableCell>{fields.length ? fields.join(" · ") : `Total /${subject.totalMarks}`}</TableCell>
                    <TableCell>{subject.allGroups ? "All Groups" : "Selected group"}</TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      <Button variant="ghost" size="icon" aria-label={`Edit ${subject.name}`} onClick={() => startEditing(subject)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Delete ${subject.name}`}
                        className="text-destructive"
                        onClick={() => {
                          if (confirm(`Remove ${subject.name} from the predefined subject list? Existing drafts and results will remain unchanged.`)) {
                            deleteSubject.mutate(subject.id);
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
              {!isLoading && subjects.length === 0 && (
                <TableRow><TableCell colSpan={6} className="py-8 text-center text-muted-foreground">No predefined subjects yet.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
