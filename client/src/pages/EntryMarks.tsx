import { useState } from "react";
import { Layout } from "@/components/Layout";
import { useStudents, useBatches } from "@/hooks/use-finance";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { type User } from "@/lib/schemas";
import { TrendingUp, Plus, Trash2, BookOpen, ClipboardList, Eye, MessageCircle, Pencil, CheckCircle2, Clock, Send, ChevronRight, RefreshCw, ChevronDown, ChevronUp, Loader2, ScanLine } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { buildSubjectWhatsAppUrl, buildResultWhatsAppUrl } from "@/lib/whatsapp";
import { Link } from "wouter";
import OMRScanner from "@/components/OMRScanner";
import { getSubjectMarkingRule, type MarkComponent, type ModelTestSubject } from "@shared/marking";
import { ClassResultPdfDownload, IndividualResultPdfButton } from "@/components/ModelTestPdfActions";

import { getBangladeshGrade as getGrade, summarizeModelTest } from "@shared/result-reports";

function gradeColor(grade: string) {
  const map: Record<string, string> = {
    "A+": "bg-emerald-500", A: "bg-green-500", "A-": "bg-teal-500",
    B: "bg-blue-500", C: "bg-yellow-500", D: "bg-orange-500", F: "bg-red-500",
  };
  return map[grade] ?? "bg-gray-400";
}

function WhatsAppBtn({ url }: { url: string }) {
  if (!url) {
    return (
      <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-300 cursor-not-allowed" disabled title="No phone number saved">
        <MessageCircle className="w-4 h-4" />
      </Button>
    );
  }
  return (
    <a href={url} target="_blank" rel="noopener noreferrer">
      <Button variant="ghost" size="icon" className="h-8 w-8 text-[#25D366] hover:bg-[#25D366]/10 hover:text-[#25D366]">
        <MessageCircle className="w-4 h-4" />
      </Button>
    </a>
  );
}

type Subject = { name: string; totalMarks: string; allGroups?: boolean };
type DraftSubject = ModelTestSubject;
type DraftSubjectSelection = { subjectId: string };
type DraftEditState = {
  groupId: string;
  examName: string;
  batchId: number;
  status: string;
  subjects: DraftSubject[];
};
type SubjectMasterOption = {
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

function getDraftStudentsForSubject(students: any[] | undefined, batchId: number, subject: DraftSubject) {
  const targetGroup = subject.allGroups ? "" : subject.academicGroup?.trim().toLowerCase() || "";
  return (students?.filter((student) =>
    student.batchId === batchId
    && student.isActive !== false
    && (!targetGroup || student.academicGroup?.trim().toLowerCase() === targetGroup)
  ) || []).sort((a, b) => parseInt(a.studentCustomId || "0") - parseInt(b.studentCustomId || "0"));
}

function getDraftScopeLabel(subjects: DraftSubject[]) {
  const labels = Array.from(new Set(subjects.map((subject) =>
    subject.allGroups ? "All Groups" : subject.academicGroup?.trim() || "All Groups"
  )));
  return labels.join(" + ");
}

export default function EntryMarks() {
  const { data: user } = useQuery<User>({ queryKey: ["/api/user"] });
  const { data: students } = useStudents();
  const { data: batches } = useBatches();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [mode, setMode] = useState<"single" | "model" | "omr">("single");

  const [selectedBatchId, setSelectedBatchId] = useState("");
  const [selectedShift, setSelectedShift] = useState("all");
  const [selectedGroup, setSelectedGroup] = useState("all");
  const [examName, setExamName] = useState("");
  const [subject, setSubject] = useState("");
  const [totalMarks, setTotalMarks] = useState("100");
  const [marks, setMarks] = useState<Record<number, string>>({});
  const [singleAbsents, setSingleAbsents] = useState<Record<number, boolean>>({});
  const [markErrors, setMarkErrors] = useState<Record<number, string>>({});

  const [modelBatchId, setModelBatchId] = useState("");
  const [modelExamName, setModelExamName] = useState("");
  const [subjects, setSubjects] = useState<Subject[]>([{ name: "", totalMarks: "100" }]);
  const [modelMarks, setModelMarks] = useState<Record<number, Record<number, string>>>({});

  const { data: results } = useQuery<any[]>({
    queryKey: ["/api/results"],
    enabled: !!user,
  });

  const batchStudents = (students?.filter((s) => s.batchId === Number(selectedBatchId) && s.isActive !== false) || []).sort((a, b) => parseInt(a.studentCustomId || '0') - parseInt(b.studentCustomId || '0'));
  const modelBatchStudents = (students?.filter((s) => s.batchId === Number(modelBatchId) && s.isActive !== false) || []).sort((a, b) => parseInt(a.studentCustomId || '0') - parseInt(b.studentCustomId || '0'));
  const availableShifts = Array.from(new Set(batchStudents.map((s) => s.shift).filter(Boolean))) as string[];
  const availableGroups = Array.from(new Set(batchStudents.map((s) => s.academicGroup).filter(Boolean))) as string[];

  const filteredStudents = batchStudents.filter((s) => {
    const matchShift = selectedShift === "all" || s.shift === selectedShift;
    const matchGroup = selectedGroup === "all" || s.academicGroup === selectedGroup;
    return matchShift && matchGroup;
  });

  const createResultMutation = useMutation({
    mutationFn: async (data: any) => {
      await apiRequest("POST", "/api/results", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/results"] });
    },
    onError: (error: any) => {
      toast({ variant: "destructive", title: "Error", description: error.message });
    },
  });

  // Batch save: one HTTP call for many results, one consolidated notification.
  const createResultsBatchMutation = useMutation({
    mutationFn: async (entries: any[]) => {
      await apiRequest("POST", "/api/results/batch", { entries });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/results"] });
    },
    onError: (error: any) => {
      toast({ variant: "destructive", title: "Error", description: error.message });
    },
  });

  const [editingResult, setEditingResult] = useState<{
    id: number;
    examName: string;
    subject: string;
    obtainedMarks: number;
    totalMarks: number;
  } | null>(null);

  const updateResultMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      await apiRequest("PATCH", `/api/results/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/results"] });
      setEditingResult(null);
      toast({ title: "Result updated successfully" });
    },
    onError: (error: any) => {
      toast({ variant: "destructive", title: "Error", description: error.message });
    },
  });

  const deleteResultMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/results/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/results"] });
      toast({ title: "Result deleted" });
    },
    onError: (error: any) => {
      toast({ variant: "destructive", title: "Error", description: error.message });
    },
  });

  const [examToDelete, setExamToDelete] = useState<{ batchId: number; batchName: string; examName: string } | null>(null);

  const deleteExamMutation = useMutation({
    mutationFn: async ({ batchId, examName }: { batchId: number; examName: string }) => {
      const params = new URLSearchParams({ batchId: String(batchId), examName });
      const res = await apiRequest("DELETE", `/api/results/exam/bulk?${params.toString()}`);
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/results"] });
      queryClient.invalidateQueries({ queryKey: ["/api/public/results"] });
      toast({ title: "Exam deleted", description: `${data?.deleted ?? 0} result${(data?.deleted ?? 0) !== 1 ? "s" : ""} removed.` });
      setExamToDelete(null);
    },
    onError: (error: any) => {
      toast({ variant: "destructive", title: "Error", description: error.message });
    },
  });

  const handleSaveMarks = async () => {
    if (!examName || !subject || !totalMarks || !selectedBatchId) {
      toast({ variant: "destructive", title: "Missing fields", description: "Please fill in all exam details" });
      return;
    }
    const hasErrors = Object.values(markErrors).some((e) => e !== "");
    if (hasErrors) {
      toast({ variant: "destructive", title: "Fix validation errors before saving" });
      return;
    }
    // Build one entry per student in the filtered list. A student is recorded
    // as Absent (-1) when either:
    //   (a) the absent checkbox is ticked, OR
    //   (b) the mark input is left empty/blank.
    // This guarantees the teacher never accidentally skips a student.
    const allEntries = filteredStudents.map((s) => {
      const raw = marks[s.id];
      const isAbsent = singleAbsents[s.id] || raw === undefined || raw === "";
      return {
        studentId: s.id,
        obtainedMarks: isAbsent ? -1 : Number(raw),
      };
    });
    if (allEntries.length === 0) {
      toast({ variant: "destructive", title: "No students in this batch" });
      return;
    }
    // Snapshot subject for the toast — state will be cleared right after.
    const savedSubject = subject;
    try {
      const payload = allEntries.map(({ studentId, obtainedMarks }) => ({
        studentId,
        batchId: Number(selectedBatchId),
        examName,
        subject,
        totalMarks: Number(totalMarks),
        obtainedMarks,
        isModelTest: false,
      }));

      await createResultsBatchMutation.mutateAsync(payload);
      toast({
        title: `Marks for ${savedSubject} saved successfully!`,
        description: `${allEntries.length} record${allEntries.length !== 1 ? "s" : ""} recorded.`,
      });
      // Fully reset the form so the teacher can start fresh.
      setMarks({});
      setSingleAbsents({});
      setMarkErrors({});
      setExamName("");
      setSubject("");
      setTotalMarks("100");
      setSelectedBatchId("");
      setSelectedShift("all");
      setSelectedGroup("all");
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Save failed",
        description: err?.message || "Some marks could not be saved. Please try again.",
      });
    }
  };

  const handleSaveModelTest = async () => {
    if (!modelBatchId || !modelExamName) {
      toast({ variant: "destructive", title: "Missing fields", description: "Select batch and enter exam name" });
      return;
    }
    const validSubjects = subjects.filter((s) => s.name.trim() && s.totalMarks);
    if (validSubjects.length === 0) {
      toast({ variant: "destructive", title: "Add at least one subject" });
      return;
    }
    const groupId = crypto.randomUUID();
    const payloads: any[] = [];
    modelBatchStudents.forEach((student) => {
      validSubjects.forEach((subj, idx) => {
        const obtained = modelMarks[student.id]?.[idx];
        // Empty/blank inputs auto-record as Absent (-1) so no student is skipped.
        const isAbsent = obtained === undefined || obtained === "";
        payloads.push({
          studentId: student.id,
          batchId: Number(modelBatchId),
          examName: modelExamName,
          subject: subj.name,
          totalMarks: Number(subj.totalMarks),
          obtainedMarks: isAbsent ? -1 : Number(obtained),
          isModelTest: true,
          modelTestGroupId: groupId,
        });
      });
    });
    if (payloads.length === 0) {
      toast({ variant: "destructive", title: "No marks entered" });
      return;
    }
    const savedExam = modelExamName;
    try {
      await createResultsBatchMutation.mutateAsync(payloads);
      toast({
        title: `Model Test "${savedExam}" saved successfully!`,
        description: `${payloads.length} result${payloads.length !== 1 ? "s" : ""} recorded.`,
      });
      // Fully reset the form so the user can start fresh.
      setModelMarks({});
      setModelBatchId("");
      setModelExamName("");
      setSubjects([{ name: "", totalMarks: "100" }]);
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Save failed",
        description: err?.message || "Some results could not be saved. Please try again.",
      });
    }
  };

  const addSubject = () => setSubjects((p) => [...p, { name: "", totalMarks: "100" }]);
  const removeSubject = (i: number) => setSubjects((p) => p.filter((_, j) => j !== i));
  const updateSubject = (i: number, field: keyof Subject, value: string) =>
    setSubjects((p) => p.map((s, j) => (j === i ? { ...s, [field]: value } : s)));
  const setStudentSubjectMark = (studentId: number, idx: number, value: string) =>
    setModelMarks((p) => ({ ...p, [studentId]: { ...(p[studentId] || {}), [idx]: value } }));

  // --- Admin: Draft creation state ---
  const [draftExamName, setDraftExamName] = useState("");
  const [draftBatchId, setDraftBatchId] = useState("");
  const [draftAcademicGroup, setDraftAcademicGroup] = useState("");
  const [draftSubjects, setDraftSubjects] = useState<DraftSubjectSelection[]>([{ subjectId: "" }]);
  const [openCreateSubjectIndex, setOpenCreateSubjectIndex] = useState<number | null>(null);
  const [editingDraft, setEditingDraft] = useState<DraftEditState | null>(null);
  const [editAddSubjectPickerOpen, setEditAddSubjectPickerOpen] = useState(false);
  const { data: subjectMasterList = [] } = useQuery<SubjectMasterOption[]>({
    queryKey: ["/api/subject-master-list"],
    enabled: !!user && (user.role === "admin" || !!user.isAuthority),
  });
  const eligibleMasterSubjects = subjectMasterList.filter((subject) =>
    subject.batchId === null || subject.batchId === Number(draftBatchId)
  );
  const classSpecificSubjectNames = new Set(
    eligibleMasterSubjects
      .filter((subject) => subject.batchId === Number(draftBatchId))
      .map((subject) => subject.name.trim().toLowerCase())
  );
  const availableMasterSubjects = eligibleMasterSubjects
    .filter((subject) => subject.batchId !== null || !classSpecificSubjectNames.has(subject.name.trim().toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name));
  const draftAvailableGroups = Array.from(new Set(
    (students || [])
      .filter((student) => student.batchId === Number(draftBatchId))
      .map((student) => student.academicGroup?.trim())
      .filter((group): group is string => !!group)
  )).sort((a, b) => a.localeCompare(b));
  const draftHasSubjectNeedingGroup = draftSubjects.some(({ subjectId }) => {
    const selected = availableMasterSubjects.find((subject) => subject.id === Number(subjectId));
    return !!selected && !selected.allGroups;
  });

  // --- Teacher: Mark entry via draft state ---
  const [selectedDraftGroupId, setSelectedDraftGroupId] = useState("");
  const [teacherSubjectName, setTeacherSubjectName] = useState("");
  const [teacherMarks, setTeacherMarks] = useState<Record<number, Partial<Record<MarkComponent, string>>>>({});
  const [absentStudents, setAbsentStudents] = useState<Record<number, boolean>>({});

  // --- Admin: Collapsible draft cards ---
  const [expandedDraftIds, setExpandedDraftIds] = useState<Set<string>>(new Set());
  const toggleDraftExpand = (groupId: string) =>
    setExpandedDraftIds((prev) => {
      const next = new Set(prev);
      next.has(groupId) ? next.delete(groupId) : next.add(groupId);
      return next;
    });

  const addDraftSubject = () => setDraftSubjects((p) => [...p, { subjectId: "" }]);
  const removeDraftSubject = (i: number) => setDraftSubjects((p) => p.filter((_, j) => j !== i));
  const updateDraftSubject = (i: number, subjectId: string) =>
    setDraftSubjects((p) => p.map((s, j) => j === i ? { subjectId } : s));

  const { data: modelTestDrafts, refetch: refetchDrafts } = useQuery<any[]>({
    queryKey: ["/api/model-test-drafts"],
    enabled: !!user && user.role !== "student",
  });

  const createDraftMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/model-test-drafts", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/model-test-drafts"] });
      setDraftExamName("");
      setDraftBatchId("");
      setDraftAcademicGroup("");
      setDraftSubjects([{ subjectId: "" }]);
      toast({ title: "Draft created!", description: "Teachers can now enter marks." });
    },
    onError: () => toast({ variant: "destructive", title: "Failed to create draft" }),
  });

  const publishDraftMutation = useMutation({
    mutationFn: async (groupId: string) => {
      await apiRequest("PATCH", `/api/model-test-drafts/${groupId}/publish`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/model-test-drafts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/results"] });
      toast({ title: "Results Published!", description: "Students can now view their marksheets." });
    },
    onError: () => toast({ variant: "destructive", title: "Failed to publish" }),
  });

  const deleteDraftMutation = useMutation({
    mutationFn: async (groupId: string) => {
      await apiRequest("DELETE", `/api/model-test-drafts/${groupId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/model-test-drafts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/results"] });
      toast({ title: "Draft deleted" });
    },
    onError: () => toast({ variant: "destructive", title: "Failed to delete draft" }),
  });

  const updateDraftMutation = useMutation({
    mutationFn: async ({ groupId, data }: {
      groupId: string;
      data: { examName: string; subjects: Array<{ subjectId?: number; name: string; academicGroup: string | null }> };
    }) => {
      const response = await apiRequest("PATCH", `/api/model-test-drafts/${groupId}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/model-test-drafts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/results"] });
      setEditingDraft(null);
      toast({ title: "Draft updated", description: "The saved marks and subject settings were kept where possible." });
    },
    onError: (error: any) => toast({
      variant: "destructive",
      title: "Could not update draft",
      description: error.message,
    }),
  });

  const saveModelTestMarksMutation = useMutation({
    mutationFn: async ({ groupId, entries }: { groupId: string; entries: any[] }) => {
      const res = await apiRequest("POST", `/api/model-test-drafts/${groupId}/marks`, { entries });
      return res.json();
    },
    onSuccess: (_data, { entries }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/results"] });
      queryClient.invalidateQueries({ queryKey: ["/api/model-test-drafts"] });
      const subject = entries[0]?.subject ?? "";
      toast({
        title: `Marks for ${subject} saved successfully!`,
        description: `${entries.length} record${entries.length !== 1 ? "s" : ""} recorded.`,
      });
      // Fully reset the form (incl. batch/draft selection) for a fresh entry.
      setTeacherMarks({});
      setAbsentStudents({});
      setTeacherSubjectName("");
      setSelectedDraftGroupId("");
    },
    onError: () => {
      toast({ variant: "destructive", title: "Failed to save marks", description: "Please try again." });
    },
  });

  const handleCreateDraft = () => {
    if (!draftExamName.trim() || !draftBatchId) {
      toast({ variant: "destructive", title: "Fill in Exam Name and Batch" });
      return;
    }
    const valid = draftSubjects
      .map((selection) => ({
        selection,
        subject: availableMasterSubjects.find((item) => item.id === Number(selection.subjectId)),
      }))
      .filter((item): item is { selection: DraftSubjectSelection; subject: SubjectMasterOption } => !!item.subject);
    if (valid.length === 0) {
      toast({ variant: "destructive", title: "Select at least one predefined subject" });
      return;
    }
    if (new Set(valid.map(({ subject }) => subject.id)).size !== valid.length) {
      toast({ variant: "destructive", title: "Select each subject only once" });
      return;
    }
    if (draftAvailableGroups.length > 0 && valid.some(({ subject }) => !subject.allGroups) && !draftAcademicGroup) {
      toast({ variant: "destructive", title: "Select a group for this class" });
      return;
    }
    createDraftMutation.mutate({
      examName: draftExamName.trim(),
      batchId: Number(draftBatchId),
      subjects: valid.map(({ selection, subject }) => ({
        subjectId: subject.id,
        academicGroup: subject.allGroups ? null : draftAcademicGroup || null,
      })),
    });
  };

  const editDraftAvailableGroups = editingDraft
    ? Array.from(new Set(
      (students || [])
        .filter((student) => student.batchId === editingDraft.batchId && student.isActive !== false)
        .map((student) => student.academicGroup?.trim())
        .filter((group): group is string => !!group)
    )).sort((a, b) => a.localeCompare(b))
    : [];
  const editEligibleMasterSubjects = editingDraft
    ? subjectMasterList.filter((subject) => subject.batchId === null || subject.batchId === editingDraft.batchId)
    : [];
  const editClassSpecificNames = new Set(
    editEligibleMasterSubjects
      .filter((subject) => subject.batchId === editingDraft?.batchId)
      .map((subject) => subject.name.trim().toLowerCase())
  );
  const editAvailableMasterSubjects = editEligibleMasterSubjects
    .filter((subject) => subject.batchId !== null || !editClassSpecificNames.has(subject.name.trim().toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name));

  const openDraftEditor = (draft: any) => {
    setEditAddSubjectPickerOpen(false);
    setEditingDraft({
      groupId: draft.groupId,
      examName: draft.examName,
      batchId: draft.batchId,
      status: draft.status,
      subjects: (draft.subjects as DraftSubject[]).map((subject) => ({ ...subject })),
    });
  };

  const addSubjectToEditedDraft = (subjectId: string) => {
    if (!editingDraft) return;
    const masterSubject = editAvailableMasterSubjects.find((subject) => subject.id === Number(subjectId));
    if (!masterSubject) return;
    const nextGroup = editingDraft.subjects.find((subject) => !subject.allGroups)?.academicGroup
      ?? editDraftAvailableGroups[0]
      ?? null;
    setEditingDraft((previous) => previous ? {
      ...previous,
      subjects: [...previous.subjects, {
        subjectId: masterSubject.id,
        name: masterSubject.name,
        totalMarks: masterSubject.totalMarks,
        mcqEnabled: masterSubject.mcqEnabled,
        cqEnabled: masterSubject.cqEnabled,
        practicalEnabled: masterSubject.practicalEnabled,
        mcqMax: masterSubject.mcqMax,
        cqMax: masterSubject.cqMax,
        practicalMax: masterSubject.practicalMax,
        academicGroup: masterSubject.allGroups ? null : nextGroup,
        allGroups: masterSubject.allGroups,
      }],
    } : null);
  };

  const handleUpdateDraft = () => {
    if (!editingDraft) return;
    if (!editingDraft.examName.trim()) {
      toast({ variant: "destructive", title: "Enter an exam name" });
      return;
    }
    if (editingDraft.subjects.length === 0) {
      toast({ variant: "destructive", title: "Keep at least one subject in the draft" });
      return;
    }

    const draftResults = modelTestResults.filter((result: any) => result.modelTestGroupId === editingDraft.groupId);
    const retainedNames = new Set(editingDraft.subjects.map((subject) => subject.name));
    const removedSubjects = (modelTestDrafts?.find((draft) => draft.groupId === editingDraft.groupId)?.subjects as DraftSubject[] || [])
      .filter((subject) => !retainedNames.has(subject.name));
    const removedWithMarks = removedSubjects.map((subject) => ({
      subject,
      count: draftResults.filter((result: any) => result.subject === subject.name).length,
    })).filter(({ count }) => count > 0);
    const originalNames = new Set(
      (modelTestDrafts?.find((draft) => draft.groupId === editingDraft.groupId)?.subjects as DraftSubject[] || [])
        .map((subject) => subject.name)
    );
    const hasSubjectChanges = editingDraft.subjects.length !== originalNames.size
      || editingDraft.subjects.some((subject) => !originalNames.has(subject.name));
    const warnings: string[] = [];
    if (removedWithMarks.length) {
      const totalRows = removedWithMarks.reduce((sum, entry) => sum + entry.count, 0);
      warnings.push(`Removing ${removedWithMarks.map(({ subject }) => subject.name).join(", ")} will permanently delete ${totalRows} saved mark record${totalRows === 1 ? "" : "s"}.`);
    }
    if (editingDraft.status === "published" && hasSubjectChanges) {
      warnings.push("Because this test is published, changing its subjects will return it to Draft and hide its results until it is published again.");
    }
    if (warnings.length && !confirm(`${warnings.join("\n\n")}\n\nSave these changes?`)) return;

    updateDraftMutation.mutate({
      groupId: editingDraft.groupId,
      data: {
        examName: editingDraft.examName.trim(),
        subjects: editingDraft.subjects.map((subject) => ({
          subjectId: subject.subjectId,
          name: subject.name,
          academicGroup: subject.academicGroup ?? null,
        })),
      },
    });
  };

  const handleSaveTeacherMarks = async () => {
    const draft = modelTestDrafts?.find((d) => d.groupId === selectedDraftGroupId);
    if (!draft || !teacherSubjectName) return;
    const subj = (draft.subjects as DraftSubject[]).find((s) => s.name === teacherSubjectName);
    if (!subj) return;
    const markingRule = getSubjectMarkingRule(teacherSubjectName, subj);
    const draftBatchStudents = getDraftStudentsForSubject(students, draft.batchId, subj);
    // Include every active student. Existing rows without component data are
    // retained unchanged until a teacher enters the new breakdown for them.
    const entries = draftBatchStudents.map((student) => {
      const existing = results?.find((r: any) =>
        r.modelTestGroupId === draft.groupId && r.subject === teacherSubjectName && r.studentId === student.id
      );
      const editedMarks = teacherMarks[student.id] ?? {};
      const getValue = (key: MarkComponent): string => {
        if (editedMarks[key] !== undefined) return editedMarks[key]!;
        if (key === "total") {
          return existing?.obtainedMarks >= 0 ? String(existing.obtainedMarks) : "";
        }
        const column = key === "mcq" ? "mcqMarks" : key === "cq" ? "cqMarks" : "practicalMarks";
        return existing?.[column] != null ? String(existing[column]) : "";
      };
      const fieldValues = markingRule.fields.map((field) => getValue(field.key));
      const hasEnteredMark = fieldValues.some((value) => value !== "");
      const isAbsent = absentStudents[student.id] ?? (existing ? existing.obtainedMarks === -1 : !hasEnteredMark);

      if (!isAbsent && !hasEnteredMark && existing && existing.obtainedMarks >= 0) {
        return {
          studentId: student.id,
          batchId: draft.batchId,
          examName: draft.examName,
          subject: teacherSubjectName,
          totalMarks: subj.totalMarks,
          obtainedMarks: existing.obtainedMarks,
          mcqMarks: existing.mcqMarks ?? null,
          cqMarks: existing.cqMarks ?? null,
          practicalMarks: existing.practicalMarks ?? null,
        };
      }

      const parts = {
        mcqMarks: null as number | null,
        cqMarks: null as number | null,
        practicalMarks: null as number | null,
      };
      let obtainedMarks = -1;
      if (!isAbsent) {
        const totalField = markingRule.fields.find((field) => field.key === "total");
        if (totalField) {
          obtainedMarks = Number(getValue("total"));
        } else {
          const valueFor = (key: "mcq" | "cq" | "practical") => {
            const field = markingRule.fields.find((item) => item.key === key);
            return field ? Number(getValue(key) || 0) : null;
          };
          parts.mcqMarks = valueFor("mcq");
          parts.cqMarks = valueFor("cq");
          parts.practicalMarks = valueFor("practical");
          obtainedMarks = (parts.mcqMarks ?? 0) + (parts.cqMarks ?? 0) + (parts.practicalMarks ?? 0);
        }
      }
      return {
        studentId: student.id,
        batchId: draft.batchId,
        examName: draft.examName,
        subject: teacherSubjectName,
        totalMarks: subj.totalMarks,
        obtainedMarks,
        ...parts,
      };
    });
    if (entries.length === 0) {
      toast({ variant: "destructive", title: "No students in this batch" });
      return;
    }

    saveModelTestMarksMutation.mutate({ groupId: draft.groupId, entries });
  };

  const isTeacher = user?.role === "teacher";
  const isStudent = user?.role === "student";
  const isAdmin = user?.role === "admin";
  const canManagePublishedResults = isAdmin || !!user?.isAuthority;

  const singleResults = results?.filter((r: any) => !r.isModelTest) || [];
  const modelTestResults = results?.filter((r: any) => r.isModelTest && r.modelTestGroupId) || [];

  const modelTestGroups: Record<string, any[]> = {};
  modelTestResults.forEach((r: any) => {
    if (!modelTestGroups[r.modelTestGroupId]) modelTestGroups[r.modelTestGroupId] = [];
    modelTestGroups[r.modelTestGroupId].push(r);
  });

  const getBatchName = (batchId: number) =>
    batches?.find((b) => b.id === batchId)?.name ?? `Batch ${batchId}`;

  const singleByBatch: Record<number, any[]> = {};
  singleResults.forEach((r: any) => {
    if (!singleByBatch[r.batchId]) singleByBatch[r.batchId] = [];
    singleByBatch[r.batchId].push(r);
  });

  const modelByBatch: Record<number, Record<string, any[]>> = {};
  Object.entries(modelTestGroups).forEach(([groupId, groupResults]) => {
    const batchId = (groupResults[0] as any).batchId;
    if (!modelByBatch[batchId]) modelByBatch[batchId] = {};
    modelByBatch[batchId][groupId] = groupResults;
  });

  return (
    <Layout
      title="Results"
      subtitle={isStudent ? "Your academic performance overview" : "Record and review student exam results"}
    >
      <div className="space-y-6">
        {/* Tab switcher — visible to all roles */}
        <div className="flex gap-2 p-1 bg-muted rounded-xl w-fit">
          <Button
            variant={mode === "single" ? "default" : "ghost"}
            onClick={() => setMode("single")}
            className="gap-2 rounded-lg"
          >
            <BookOpen className="w-4 h-4" /> Subject-wise Result
          </Button>
          <Button
            variant={mode === "model" ? "default" : "ghost"}
            onClick={() => setMode("model")}
            className="gap-2 rounded-lg"
          >
            <ClipboardList className="w-4 h-4" /> Model Test
          </Button>
          {isTeacher && (
            <Button
              variant={mode === "omr" ? "default" : "ghost"}
              onClick={() => setMode("omr")}
              className="gap-2 rounded-lg"
            >
              <ScanLine className="w-4 h-4" /> OMR Scanner
            </Button>
          )}
        </div>

        {/* ── SUBJECT-WISE TAB ── */}
        {mode === "single" && (
          <div className="space-y-6">
            {/* Entry forms — teacher only */}
            {isTeacher && (
              <>
                <Card>
                  <CardHeader><CardTitle>Exam Details</CardTitle></CardHeader>
                  <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Batch</label>
                      <Select onValueChange={setSelectedBatchId} value={selectedBatchId}>
                        <SelectTrigger><SelectValue placeholder="Select Batch" /></SelectTrigger>
                        <SelectContent>{batches?.map((b) => <SelectItem key={b.id} value={b.id.toString()}>{b.name}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Subject</label>
                      <Input placeholder="e.g. Physics" value={subject} onChange={(e) => setSubject(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Exam Name / Topic</label>
                      <Input placeholder="e.g. চল তড়িৎ" value={examName} onChange={(e) => setExamName(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Total Marks</label>
                      <Input type="number" value={totalMarks} onChange={(e) => setTotalMarks(e.target.value)} />
                    </div>
                  </CardContent>
                </Card>

                {selectedBatchId && (availableShifts.length > 0 || availableGroups.length > 0) && (
                  <Card>
                    <CardHeader><CardTitle className="text-sm font-medium">Filters</CardTitle></CardHeader>
                    <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {availableShifts.length > 0 && (
                        <div className="space-y-2">
                          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Shift</label>
                          <Select value={selectedShift} onValueChange={setSelectedShift}>
                            <SelectTrigger><SelectValue placeholder="All Shifts" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">All Shifts</SelectItem>
                              {availableShifts.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                      {availableGroups.length > 0 && (
                        <div className="space-y-2">
                          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Academic Group</label>
                          <Select value={selectedGroup} onValueChange={setSelectedGroup}>
                            <SelectTrigger><SelectValue placeholder="All Groups" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">All Groups</SelectItem>
                              {availableGroups.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                {selectedBatchId && (
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between">
                      <CardTitle>Students List</CardTitle>
                      <Button
                        onClick={handleSaveMarks}
                        disabled={createResultsBatchMutation.isPending || Object.values(markErrors).some((e) => e !== "")}
                        data-testid="button-save-all-marks"
                      >
                        {createResultsBatchMutation.isPending ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Saving...
                          </>
                        ) : (
                          "Save All Marks"
                        )}
                      </Button>
                    </CardHeader>
                    <CardContent>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Student ID</TableHead>
                            <TableHead>Name</TableHead>
                            <TableHead className="w-[240px]">Obtained Marks</TableHead>
                            <TableHead className="w-[80px] text-center">Absent</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredStudents.map((student) => {
                            const isAbsent = !!singleAbsents[student.id];
                            const errorMsg = markErrors[student.id] || "";
                            return (
                              <TableRow key={student.id}>
                                <TableCell>{student.studentCustomId || "N/A"}</TableCell>
                                <TableCell>{student.name}</TableCell>
                                <TableCell>
                                  <div className="space-y-1">
                                    <Input
                                      type={isAbsent ? "text" : "number"}
                                      placeholder={isAbsent ? "ABS" : "Marks"}
                                      value={isAbsent ? "ABS" : (marks[student.id] || "")}
                                      disabled={isAbsent}
                                      min={0}
                                      max={Number(totalMarks) || undefined}
                                      onChange={(e) => {
                                        const val = e.target.value;
                                        setMarks((p) => ({ ...p, [student.id]: val }));
                                        const num = Number(val);
                                        const max = Number(totalMarks);
                                        if (val !== "" && max > 0 && num > max) {
                                          setMarkErrors((p) => ({ ...p, [student.id]: `Marks cannot exceed ${max}` }));
                                        } else {
                                          setMarkErrors((p) => ({ ...p, [student.id]: "" }));
                                        }
                                      }}
                                      className={errorMsg ? "border-red-500 focus-visible:ring-red-400" : ""}
                                    />
                                    {errorMsg && (
                                      <p className="text-xs text-red-500 font-medium">{errorMsg}</p>
                                    )}
                                  </div>
                                </TableCell>
                                <TableCell className="text-center">
                                  <Checkbox
                                    checked={isAbsent}
                                    onCheckedChange={(checked) => {
                                      setSingleAbsents((p) => ({ ...p, [student.id]: !!checked }));
                                      if (checked) {
                                        setMarks((p) => ({ ...p, [student.id]: "" }));
                                        setMarkErrors((p) => ({ ...p, [student.id]: "" }));
                                      }
                                    }}
                                    data-testid={`checkbox-absent-${student.id}`}
                                  />
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                )}
              </>
            )}

            {/* Subject-wise Results — Batch → Exam Name → Students hierarchy */}
            {!isStudent && Object.keys(singleByBatch).length > 0 && (
              <Card className="border-none bg-white dark:bg-slate-900 shadow-[0_2px_15px_-3px_rgba(0,0,0,0.07)] rounded-2xl overflow-hidden">
                <CardHeader className="border-b border-slate-100 dark:border-slate-800 py-5 px-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-900/30 border border-blue-100 dark:border-blue-800">
                        <BookOpen className="w-5 h-5 text-blue-500" />
                      </div>
                      <div>
                        <CardTitle className="text-lg font-bold">Subject-wise Results</CardTitle>
                        <p className="text-sm text-muted-foreground">Click a batch, then an exam to view results</p>
                      </div>
                    </div>
                    {isAdmin && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5 text-slate-600 dark:text-slate-400"
                        onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/results"] })}
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        Refresh
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="p-4">
                  <Accordion type="multiple" className="space-y-2">
                    {Object.entries(singleByBatch).map(([batchId, batchResults]) => {
                      const examGroups: Record<string, any[]> = {};
                      batchResults.forEach((r: any) => {
                        if (!examGroups[r.examName]) examGroups[r.examName] = [];
                        examGroups[r.examName].push(r);
                      });
                      return (
                        <AccordionItem
                          key={batchId}
                          value={batchId}
                          className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden"
                        >
                          <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-slate-50 dark:hover:bg-slate-800/50 [&[data-state=open]]:bg-slate-50 dark:[&[data-state=open]]:bg-slate-800/50">
                            <div className="flex items-center gap-3">
                              <span className="font-bold text-slate-800 dark:text-slate-200 text-base">{getBatchName(Number(batchId))}</span>
                              <Badge variant="secondary" className="text-xs">{Object.keys(examGroups).length} exam{Object.keys(examGroups).length !== 1 ? "s" : ""}</Badge>
                            </div>
                          </AccordionTrigger>
                          <AccordionContent className="px-3 pb-3 pt-1">
                            <Accordion type="multiple" className="space-y-1.5">
                              {Object.entries(examGroups).map(([examName, examResults]) => {
                                const studentCount = new Set(examResults.map((r: any) => r.studentId)).size;
                                return (
                                  <AccordionItem
                                    key={examName}
                                    value={examName}
                                    className="border border-slate-100 dark:border-slate-800 rounded-lg overflow-hidden bg-slate-50/50 dark:bg-slate-800/20"
                                  >
                                    <AccordionTrigger className="px-4 py-2.5 hover:no-underline hover:bg-slate-100/70 dark:hover:bg-slate-800/50 [&[data-state=open]]:bg-slate-100/70 dark:[&[data-state=open]]:bg-slate-800/50">
                                      <div className="flex items-center gap-2.5 flex-1">
                                        <ClipboardList className="w-4 h-4 text-blue-400 shrink-0" />
                                        <span className="font-semibold text-slate-700 dark:text-slate-300 text-sm">{examName}</span>
                                        <Badge className="text-xs bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400 border-0 hover:bg-blue-100">
                                          {studentCount} student{studentCount !== 1 ? "s" : ""}
                                        </Badge>
                                        {isAdmin && (
                                          <span
                                            role="button"
                                            tabIndex={0}
                                            data-testid={`button-delete-exam-${batchId}-${examName}`}
                                            onClick={(e) => {
                                              e.preventDefault();
                                              e.stopPropagation();
                                              setExamToDelete({ batchId: Number(batchId), batchName: getBatchName(Number(batchId)), examName });
                                            }}
                                            onKeyDown={(e) => {
                                              if (e.key === "Enter" || e.key === " ") {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                setExamToDelete({ batchId: Number(batchId), batchName: getBatchName(Number(batchId)), examName });
                                              }
                                            }}
                                            className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-rose-600 hover:text-rose-700 hover:bg-rose-50 px-2 py-1 rounded-md transition-colors cursor-pointer"
                                          >
                                            <Trash2 className="w-3.5 h-3.5" />
                                            <span className="hidden sm:inline">Delete Exam</span>
                                          </span>
                                        )}
                                      </div>
                                    </AccordionTrigger>
                                    <AccordionContent className="p-0">
                                      <div className="overflow-x-auto bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800">
                                        <Table>
                                          <TableHeader>
                                            <TableRow className="hover:bg-transparent bg-slate-50/80 dark:bg-slate-800/50">
                                              <TableHead className="text-xs font-semibold">Student</TableHead>
                                              <TableHead className="text-xs font-semibold">Subject</TableHead>
                                              <TableHead className="text-xs font-semibold text-center">Marks</TableHead>
                                              <TableHead className="text-xs w-[100px]"></TableHead>
                                            </TableRow>
                                          </TableHeader>
                                          <TableBody>
                                            {examResults.map((res: any) => {
                                              const waUrl = buildSubjectWhatsAppUrl(
                                                res.student?.mobileNumber,
                                                res.student?.name || "Student",
                                                res.examName,
                                                res.subject,
                                                res.obtainedMarks,
                                                res.totalMarks
                                              );
                                              return (
                                                <TableRow key={res.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 group">
                                                  <TableCell className="font-medium text-sm py-2.5">{res.student?.name || "—"}</TableCell>
                                                  <TableCell className="text-sm py-2.5 text-slate-600">{res.subject}</TableCell>
                                                  <TableCell className="text-sm py-2.5 text-center font-bold">
                                                    {res.obtainedMarks === -1
                                                      ? <span className="text-amber-600 font-bold">Absent</span>
                                                      : <>{res.obtainedMarks}<span className="text-slate-400 font-normal">/{res.totalMarks}</span></>
                                                    }
                                                  </TableCell>
                                                  <TableCell className="py-2.5">
                                                    <div className="flex items-center gap-0.5 justify-end">
                                                      {isAdmin && <WhatsAppBtn url={waUrl} />}
                                                      {isAdmin && (
                                                        <>
                                                          <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity text-blue-500 hover:text-blue-600 hover:bg-blue-50"
                                                            onClick={() => setEditingResult({ id: res.id, examName: res.examName, subject: res.subject, obtainedMarks: res.obtainedMarks, totalMarks: res.totalMarks })}
                                                          >
                                                            <Pencil className="w-3.5 h-3.5" />
                                                          </Button>
                                                          <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive hover:bg-destructive/10"
                                                            onClick={() => { if (confirm("Delete this result record?")) deleteResultMutation.mutate(res.id); }}
                                                          >
                                                            <Trash2 className="w-3.5 h-3.5" />
                                                          </Button>
                                                        </>
                                                      )}
                                                    </div>
                                                  </TableCell>
                                                </TableRow>
                                              );
                                            })}
                                          </TableBody>
                                        </Table>
                                      </div>
                                    </AccordionContent>
                                  </AccordionItem>
                                );
                              })}
                            </Accordion>
                          </AccordionContent>
                        </AccordionItem>
                      );
                    })}
                  </Accordion>
                </CardContent>
              </Card>
            )}

            {/* Student's own subject-wise results */}
            {isStudent && singleResults.length > 0 && (
              <Card className="border-none bg-white dark:bg-slate-900 shadow-[0_2px_15px_-3px_rgba(0,0,0,0.07)] rounded-2xl overflow-hidden">
                <CardHeader className="border-b border-slate-100 dark:border-slate-800 py-6 px-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-900/30 border border-blue-100 dark:border-blue-800"><BookOpen className="w-5 h-5 text-blue-500" /></div>
                    <div>
                      <CardTitle className="text-xl text-slate-900 dark:text-slate-100 font-extrabold">Subject-wise Results</CardTitle>
                      <p className="text-sm text-slate-500 dark:text-slate-400">Your individual subject performance</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-slate-50 dark:bg-slate-800/50 border-slate-100 dark:border-slate-800">
                          <TableHead className="py-4 px-6 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Exam</TableHead>
                          <TableHead className="py-4 px-6 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Subject</TableHead>
                          <TableHead className="py-4 px-6 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Total</TableHead>
                          <TableHead className="py-4 px-6 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Obtained</TableHead>
                          <TableHead className="py-4 px-6 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Grade</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {singleResults.map((res: any) => {
                          const { grade, gp } = getGrade(res.obtainedMarks, res.totalMarks);
                          return (
                            <TableRow key={res.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 border-slate-100 dark:border-slate-800 transition-colors">
                              <TableCell className="py-5 px-6 font-bold text-slate-900 dark:text-slate-100">{res.examName}</TableCell>
                              <TableCell className="py-5 px-6 font-medium text-slate-900 dark:text-slate-100">{res.subject}</TableCell>
                              <TableCell className="py-5 px-6 text-slate-500 dark:text-slate-400 font-bold">{res.totalMarks}</TableCell>
                              <TableCell className="py-5 px-6">
                                {res.obtainedMarks === -1
                                  ? <span className="font-black text-lg text-amber-600">Absent</span>
                                  : <span className="font-black text-lg text-emerald-600">{res.obtainedMarks}</span>
                                }
                              </TableCell>
                              <TableCell className="py-5 px-6">
                                <Badge className={`font-bold text-white ${gradeColor(grade)}`}>{grade}{grade !== "ABS" ? ` (${gp.toFixed(2)})` : ""}</Badge>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            )}

            {isStudent && singleResults.length === 0 && (
              <div className="text-center py-16 text-slate-400">
                <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="font-medium">No subject-wise results yet</p>
              </div>
            )}
          </div>
        )}

        {/* ── MODEL TEST TAB ── */}
        {mode === "model" && (
          <div className="space-y-5">

            {/* ═══ ADMIN VIEW ═══ */}
            {(isAdmin || user?.isAuthority) && (
              <>
                {/* Create Draft Card */}
                <Card className="border-2 border-slate-100">
                  <CardHeader className="pb-4">
                    <CardTitle className="text-base font-bold">Create New Model Test Draft</CardTitle>
                    <p className="text-sm text-muted-foreground">Define the exam structure. Teachers will enter marks for each subject.</p>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Exam Name</label>
                        <Input placeholder="e.g. Model Test 1" value={draftExamName} onChange={(e) => setDraftExamName(e.target.value)} />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Class / Batch</label>
                          <Select value={draftBatchId} onValueChange={(value) => {
                            setDraftBatchId(value);
                            setDraftAcademicGroup("");
                            setDraftSubjects([{ subjectId: "" }]);
                            setOpenCreateSubjectIndex(null);
                          }}>
                          <SelectTrigger><SelectValue placeholder="Select Class / Batch" /></SelectTrigger>
                          <SelectContent>{batches?.map((b) => <SelectItem key={b.id} value={b.id.toString()}>{b.name}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                    </div>
                    {draftAvailableGroups.length > 0 && (
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Academic Group</label>
                        <Select value={draftAcademicGroup} onValueChange={setDraftAcademicGroup}>
                          <SelectTrigger><SelectValue placeholder="Select Science, Commerce, or Arts" /></SelectTrigger>
                          <SelectContent>
                            {draftAvailableGroups.map((group) => <SelectItem key={group} value={group}>{group}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">Group-specific subjects use this group. Subjects marked All Groups include every group.</p>
                      </div>
                    )}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-sm font-medium">Subjects</label>
                        <Button variant="outline" size="sm" onClick={addDraftSubject}><Plus className="w-3 h-3 mr-1" /> Add Subject</Button>
                      </div>
                      <div className="space-y-2">
                        {draftSubjects.map((subj, idx) => {
                          const selected = subjectMasterList.find((option) => option.id === Number(subj.subjectId));
                          const rule = selected ? getSubjectMarkingRule(selected.name, selected) : null;
                          return (
                            <div key={idx} className="flex flex-wrap gap-2 items-center">
                              <Select
                                value={subj.subjectId}
                                open={openCreateSubjectIndex === idx}
                                onOpenChange={(open) => setOpenCreateSubjectIndex((current) =>
                                  open ? idx : current === idx ? null : current
                                )}
                                onValueChange={(value) => {
                                  updateDraftSubject(idx, value);
                                  setOpenCreateSubjectIndex(null);
                                }}
                              >
                                <SelectTrigger className="min-w-[220px] flex-1">
                                  <SelectValue placeholder="Choose a predefined subject" />
                                </SelectTrigger>
                                <SelectContent>
                                  {availableMasterSubjects.map((option) => {
                                    const usedElsewhere = draftSubjects.some((item, itemIndex) =>
                                      itemIndex !== idx && item.subjectId === String(option.id)
                                    );
                                    return (
                                      <SelectItem
                                        key={option.id}
                                        value={String(option.id)}
                                        disabled={usedElsewhere}
                                      >
                                        {option.name}
                                      </SelectItem>
                                    );
                                  })}
                                </SelectContent>
                              </Select>
                              {selected && (
                                <span className="text-xs text-muted-foreground">
                                  {rule?.fields.map((field) => `${field.label} /${field.max}`).join(" · ")}
                                  {" · "}{selected.allGroups ? "All Groups" : "Selected group"}
                                </span>
                              )}
                              {draftSubjects.length > 1 && (
                                <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={() => removeDraftSubject(idx)}>
                                  <Trash2 className="w-4 h-4 text-destructive" />
                                </Button>
                              )}
                            </div>
                          );
                        })}
                        {availableMasterSubjects.length === 0 && (
                          <p className="text-sm text-muted-foreground">
                            Add subjects for this class or all classes in Manage → Subject Master List first.
                          </p>
                        )}
                      </div>
                    </div>
                    <Button onClick={handleCreateDraft} disabled={createDraftMutation.isPending || (draftAvailableGroups.length > 0 && draftHasSubjectNeedingGroup && !draftAcademicGroup)} className="gap-2">
                      <Send className="w-4 h-4" />
                      {createDraftMutation.isPending ? "Creating..." : "Create Draft"}
                    </Button>
                  </CardContent>
                </Card>

                {/* Draft List */}
                {modelTestDrafts && modelTestDrafts.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="font-semibold text-slate-700 text-sm uppercase tracking-wide">Active & Published Drafts</h3>
                    {modelTestDrafts.map((draft) => {
                      const draftSubjectList = draft.subjects as DraftSubject[];
                      const draftGroupResults = modelTestResults.filter((r: any) => r.modelTestGroupId === draft.groupId);
                      const filledSubjectNames = draftSubjectList.filter((s) =>
                        draftGroupResults.some((r: any) => r.subject === s.name)
                      );
                      const allFilled = filledSubjectNames.length === draftSubjectList.length;

                      const byStudent: Record<number, any[]> = {};
                      draftGroupResults.forEach((r: any) => {
                        if (!byStudent[r.studentId]) byStudent[r.studentId] = [];
                        byStudent[r.studentId].push(r);
                      });

                       const isExpanded = expandedDraftIds.has(draft.groupId);
                       const resultGroups = Array.from(new Set(
                         (students || [])
                           .filter((student) => student.batchId === draft.batchId)
                           .map((student) => student.academicGroup?.trim())
                           .filter((group): group is string => !!group)
                       )).sort((a, b) => a.localeCompare(b));
                       const draftSession = draft.createdAt ? String(new Date(draft.createdAt).getFullYear()) : "";
                      return (
                        <Card key={draft.groupId} className={`border-2 ${draft.status === "published" ? "border-green-200 bg-green-50/30" : "border-slate-100"}`}>
                          <CardHeader className="pb-3">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <button
                                className="flex items-center gap-2 text-left group flex-1 min-w-0"
                                onClick={() => toggleDraftExpand(draft.groupId)}
                              >
                                <div className="flex-1 min-w-0">
                                  <CardTitle className="text-base font-bold group-hover:text-primary transition-colors">{draft.examName}</CardTitle>
                                  <p className="text-sm text-muted-foreground">{draft.batch?.name} · {getDraftScopeLabel(draftSubjectList)} · {draftSubjectList.length} subject{draftSubjectList.length !== 1 ? "s" : ""}{Object.keys(byStudent).length > 0 ? ` · ${Object.keys(byStudent).length} student${Object.keys(byStudent).length !== 1 ? "s" : ""}` : ""}</p>
                                </div>
                                <div className="text-muted-foreground shrink-0">
                                  {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                </div>
                              </button>
                              <div className="flex items-center gap-2 flex-wrap">
                                {canManagePublishedResults && draft.status === "published" && (
                                  <ClassResultPdfDownload
                                    groupId={draft.groupId}
                                    groups={resultGroups}
                                    session={draftSession}
                                  />
                                )}
                                <Badge className={draft.status === "published" ? "bg-green-500 text-white" : "bg-amber-400 text-white"}>
                                  {draft.status === "published" ? "Published" : "Draft"}
                                </Badge>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="gap-1.5"
                                  onClick={() => openDraftEditor(draft)}
                                >
                                  <Pencil className="w-3.5 h-3.5" /> Edit Draft
                                </Button>
                                {draft.status === "draft" && (
                                  <Button
                                    size="sm"
                                    className="gap-1.5 bg-green-600 hover:bg-green-700"
                                    disabled={publishDraftMutation.isPending}
                                    onClick={() => {
                                      if (confirm(`Publish "${draft.examName}"? Students will be able to view results immediately.`)) {
                                        publishDraftMutation.mutate(draft.groupId);
                                      }
                                    }}
                                  >
                                    <Send className="w-3.5 h-3.5" /> Publish Result
                                  </Button>
                                )}
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                                  onClick={() => {
                                    if (confirm(`Delete draft "${draft.examName}" and all its marks? This cannot be undone.`)) {
                                      deleteDraftMutation.mutate(draft.groupId);
                                    }
                                  }}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            </div>
                          </CardHeader>
                          {isExpanded && <CardContent className="space-y-4">
                            {/* Subject progress */}
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                              {draftSubjectList.map((s) => {
                                const subjectResults = draftGroupResults.filter((r: any) => r.subject === s.name);
                                const filled = subjectResults.length > 0;
                                const studentCount = new Set(subjectResults.map((r: any) => r.studentId)).size;
                                return (
                                  <div
                                    key={s.name}
                                    className={`rounded-lg px-3 py-2.5 text-sm flex items-center gap-2 border ${filled ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800" : "bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700"}`}
                                  >
                                    {filled
                                      ? <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                                      : <Clock className="w-4 h-4 text-slate-400 shrink-0" />
                                    }
                                    <div className="min-w-0">
                                      <div className="font-semibold truncate">{s.name}</div>
                                      <div className="text-xs text-muted-foreground">
                                        {filled ? `${studentCount} student${studentCount !== 1 ? "s" : ""}` : "Pending"}
                                        {" "}· /{s.totalMarks}
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>

                            {/* Student results summary (if any marks entered) */}
                            {Object.keys(byStudent).length > 0 && (
                              <div className="rounded-xl border border-slate-100 dark:border-slate-800 overflow-hidden">
                                <div className="bg-slate-50 dark:bg-slate-800/50 px-4 py-2 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2">
                                  <span className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Student Results</span>
                                  <span className="text-xs text-slate-400 dark:text-slate-500">{Object.keys(byStudent).length} student{Object.keys(byStudent).length !== 1 ? "s" : ""}</span>
                                </div>
                                <Table>
                                  <TableHeader>
                                    <TableRow className="hover:bg-transparent">
                                      <TableHead className="py-2 text-xs">Student</TableHead>
                                      <TableHead className="py-2 text-xs text-center">Total Marks</TableHead>
                                      <TableHead className="py-2 text-xs text-center">GPA</TableHead>
                                      <TableHead className="py-2 w-16"></TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {Object.entries(byStudent).map(([, sr]) => {
                                      const studentRes = sr as any[];
                                      const st = studentRes[0]?.student;
                                      const rowStudentId = Number(studentRes[0]?.studentId);
                                      const rowReport = summarizeModelTest(st ?? {
                                        id: rowStudentId, name: "", batchId: draft.batchId,
                                      }, draftSubjectList, studentRes);
                                      const hasAbsent = !rowReport.passed;
                                      const totalObtained = rowReport.obtainedMarks;
                                      const totalFull = rowReport.totalMarks;
                                      const gpa = rowReport.gpa;
                                      const waUrl = buildResultWhatsAppUrl(
                                        st?.mobileNumber, st?.name || "Student", draft.examName, totalObtained, totalFull, gpa
                                      );
                                      return (
                                        <TableRow key={studentRes[0]?.studentId} className={`group ${hasAbsent ? "bg-red-50/50 dark:bg-red-900/10 hover:bg-red-50 dark:hover:bg-red-900/20" : "hover:bg-slate-50/60 dark:hover:bg-slate-800/30"}`}>
                                          <TableCell className="py-2.5 font-medium text-sm">
                                            <span className={hasAbsent ? "text-red-600" : ""}>{st?.name || "—"}</span>
                                            {hasAbsent && <span className="ml-2 text-[10px] font-bold text-red-500 bg-red-100 px-1.5 py-0.5 rounded">{rowReport.status}</span>}
                                          </TableCell>
                                          <TableCell className="py-2.5 text-center text-sm font-bold">
                                            {hasAbsent
                                              ? <span className="text-red-500 font-bold">FAIL</span>
                                              : <>{totalObtained}<span className="text-slate-400 font-normal">/{totalFull}</span></>
                                            }
                                          </TableCell>
                                          <TableCell className={`py-2.5 text-center font-black text-sm ${hasAbsent ? "text-red-500" : "text-indigo-600"}`}>
                                            {hasAbsent ? "0.00" : gpa.toFixed(2)}
                                          </TableCell>
                                          <TableCell className="py-2.5">
                                            <div className="flex items-center gap-0.5 justify-end">
                                              {canManagePublishedResults && draft.status === "published" && Number.isFinite(rowStudentId) && rowStudentId > 0 && (
                                                <IndividualResultPdfButton groupId={draft.groupId} studentId={rowStudentId} />
                                              )}
                                              {isAdmin && draft.status === "published" && <WhatsAppBtn url={waUrl} />}
                                              <Button
                                                variant="ghost" size="icon"
                                                className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive hover:bg-destructive/10"
                                                onClick={() => {
                                                  if (confirm(`Delete ${st?.name}'s results in this exam?`)) {
                                                    studentRes.forEach((r: any) => deleteResultMutation.mutate(r.id));
                                                  }
                                                }}
                                              >
                                                <Trash2 className="w-3.5 h-3.5" />
                                              </Button>
                                            </div>
                                          </TableCell>
                                        </TableRow>
                                      );
                                    })}
                                  </TableBody>
                                </Table>
                              </div>
                            )}
                          </CardContent>}
                        </Card>
                      );
                    })}
                  </div>
                )}

                {(!modelTestDrafts || modelTestDrafts.length === 0) && (
                  <div className="text-center py-14 text-slate-400">
                    <ClipboardList className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p className="font-medium">No model tests yet</p>
                    <p className="text-sm">Create a draft above to get started.</p>
                  </div>
                )}
              </>
            )}

            {/* ═══ TEACHER VIEW ═══ */}
            {isTeacher && (
              <div className="space-y-4">
                {/* Step 1: Select Draft */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Step 1 — Select Exam</CardTitle>
                    <p className="text-sm text-muted-foreground">Choose an active model test created by the Authority</p>
                  </CardHeader>
                  <CardContent>
                    <Select
                      value={selectedDraftGroupId}
                      onValueChange={(v) => { setSelectedDraftGroupId(v); setTeacherSubjectName(""); setTeacherMarks({}); }}
                    >
                      <SelectTrigger><SelectValue placeholder="Select active model test..." /></SelectTrigger>
                      <SelectContent>
                        {modelTestDrafts?.filter((d) => d.status === "draft").map((d) => (
                          <SelectItem key={d.groupId} value={d.groupId}>
                            {d.examName} — {d.batch?.name} · {getDraftScopeLabel(d.subjects as DraftSubject[])}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </CardContent>
                </Card>

                {selectedDraftGroupId && (() => {
                  const draft = modelTestDrafts?.find((d) => d.groupId === selectedDraftGroupId);
                  if (!draft) return null;
                  const draftSubjectList = draft.subjects as DraftSubject[];
                  const draftGroupResults = modelTestResults.filter((r: any) => r.modelTestGroupId === selectedDraftGroupId);

                  return (
                    <>
                      {/* Step 2: Select Subject */}
                      <Card>
                        <CardHeader className="pb-3">
                          <CardTitle className="text-base">Step 2 — Select Your Subject</CardTitle>
                          <p className="text-sm text-muted-foreground">Choose the subject you're entering marks for</p>
                        </CardHeader>
                        <CardContent>
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                            {draftSubjectList.map((s) => {
                              const subjectResults = draftGroupResults.filter((r: any) => r.subject === s.name);
                              const isFilled = subjectResults.length > 0;
                              const isSelected = teacherSubjectName === s.name;
                              return (
                                <button
                                  key={s.name}
                                  onClick={() => { setTeacherSubjectName(s.name); setTeacherMarks({}); }}
                                  className={`rounded-xl px-3 py-3 text-sm border-2 transition-all text-left ${
                                    isSelected
                                      ? "bg-primary border-primary text-white"
                                      : isFilled
                                      ? "bg-green-50 border-green-300 text-green-800"
                                      : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 hover:border-primary/40 text-slate-700 dark:text-slate-300"
                                  }`}
                                >
                                  <div className="font-bold">{s.name}</div>
                                  <div className={`text-xs mt-0.5 ${isSelected ? "text-white/80" : "text-muted-foreground"}`}>
                                    /{s.totalMarks} marks{isFilled ? ` · ${new Set(subjectResults.map((r: any) => r.studentId)).size} submitted` : ""}
                                  </div>
                                  <div className={`mt-1 text-[10px] font-semibold ${isSelected ? "text-white/80" : "text-indigo-600 dark:text-indigo-400"}`}>
                                    {s.allGroups ? "All groups" : s.academicGroup || "All groups"}
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </CardContent>
                      </Card>

                      {/* Step 3: Enter Marks */}
                      {teacherSubjectName && (() => {
                        const subj = draftSubjectList.find((s) => s.name === teacherSubjectName);
                        const draftBatchStudents = subj
                          ? getDraftStudentsForSubject(students, draft.batchId, subj)
                          : [];
                        const markingRule = getSubjectMarkingRule(teacherSubjectName, subj);
                        const existingSubjectResults = draftGroupResults.filter((r: any) => r.subject === teacherSubjectName);

                        return (
                          <Card>
                            <CardHeader className="flex flex-row items-center justify-between pb-3">
                         <div className="min-w-0">
                                <CardTitle className="text-base">Step 3 — Enter Marks: {teacherSubjectName}</CardTitle>
                                <p className="text-sm text-muted-foreground">
                                  Total: {markingRule.total} marks · {draft.batch?.name} · {subj?.allGroups ? "All Groups" : subj?.academicGroup || "All Groups"} · {draftBatchStudents.length} students
                                </p>
                              </div>
                              <Button
                                onClick={handleSaveTeacherMarks}
                                disabled={saveModelTestMarksMutation.isPending}
                                data-testid="button-save-teacher-marks"
                                className="gap-2 shrink-0"
                              >
                                {saveModelTestMarksMutation.isPending ? (
                                  <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    Saving...
                                  </>
                                ) : (
                                  <>
                                    <CheckCircle2 className="w-4 h-4" />
                                    Save Marks
                                  </>
                                )}
                              </Button>
                            </CardHeader>
                            <CardContent className="overflow-x-auto">
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead className="min-w-[140px]">Student</TableHead>
                                    {markingRule.fields.map((field) => (
                                      <TableHead key={field.key} className="min-w-[130px]">
                                        {field.label} (/{field.max})
                                      </TableHead>
                                    ))}
                                    <TableHead className="min-w-[120px] text-center">Calculated Total (/{markingRule.total})</TableHead>
                                    <TableHead className="min-w-[90px] text-center">Absent</TableHead>
                                    <TableHead>Status</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {draftBatchStudents.map((student) => {
                                    const existing = existingSubjectResults.find((r: any) => r.studentId === student.id);
                                    const isAbsent = absentStudents[student.id] ?? (existing?.obtainedMarks === -1);
                                    const editedMarks = teacherMarks[student.id] ?? {};
                                    const getValue = (key: MarkComponent): string => {
                                      if (editedMarks[key] !== undefined) return editedMarks[key]!;
                                      if (key === "total") return existing && existing.obtainedMarks >= 0 ? String(existing.obtainedMarks) : "";
                                      const column = key === "mcq" ? "mcqMarks" : key === "cq" ? "cqMarks" : "practicalMarks";
                                      return existing?.[column] != null ? String(existing[column]) : "";
                                    };
                                    const enteredValues = markingRule.fields.map((field) => getValue(field.key));
                                    const currentTotal = markingRule.fields[0]?.key === "total"
                                      ? (enteredValues[0] === "" ? 0 : Number(enteredValues[0]))
                                      : (enteredValues.some((value) => value !== "")
                                          ? enteredValues.reduce((sum, value) => sum + (value === "" ? 0 : Number(value)), 0)
                                          : (existing?.obtainedMarks >= 0 ? existing.obtainedMarks : 0));
                                    return (
                                      <TableRow key={student.id} className={isAbsent ? "bg-red-50/60" : ""}>
                                        <TableCell className={`font-medium ${isAbsent ? "text-red-600" : ""}`}>
                                          {student.name}
                                          {isAbsent && <span className="ml-2 text-xs font-bold text-red-500 bg-red-100 px-1.5 py-0.5 rounded">ABS</span>}
                                        </TableCell>
                                        {markingRule.fields.map((field) => (
                                          <TableCell key={field.key}>
                                            <Input
                                              type="number"
                                              min={0}
                                              max={field.max}
                                              step={1}
                                              inputMode="numeric"
                                              aria-label={`${field.label} for ${student.name}`}
                                              placeholder={isAbsent ? "Absent" : `0–${field.max}`}
                                              value={isAbsent ? "" : getValue(field.key)}
                                              disabled={isAbsent}
                                              onChange={(e) => {
                                                const raw = e.target.value;
                                                const numeric = Number(raw);
                                                const value = raw === ""
                                                  ? ""
                                                  : Number.isFinite(numeric)
                                                    ? String(Math.max(0, Math.min(field.max, Math.trunc(numeric))))
                                                    : "";
                                                setTeacherMarks((previous) => ({
                                                  ...previous,
                                                  [student.id]: { ...(previous[student.id] ?? {}), [field.key]: value },
                                                }));
                                                setAbsentStudents((previous) => ({ ...previous, [student.id]: false }));
                                              }}
                                              className={`w-28 ${isAbsent ? "opacity-40" : ""}`}
                                            />
                                          </TableCell>
                                        ))}
                                        <TableCell className="text-center font-semibold tabular-nums">
                                          {isAbsent ? "—" : currentTotal}
                                        </TableCell>
                                        <TableCell className="text-center">
                                          <Checkbox
                                            checked={isAbsent}
                                            onCheckedChange={(checked) => {
                                              const absent = !!checked;
                                              setAbsentStudents((p) => ({ ...p, [student.id]: absent }));
                                              if (absent) setTeacherMarks((p) => { const n = { ...p }; delete n[student.id]; return n; });
                                            }}
                                            className="border-red-400 data-[state=checked]:bg-red-500 data-[state=checked]:border-red-500"
                                          />
                                        </TableCell>
                                        <TableCell>
                                          {teacherMarks[student.id] !== undefined
                                            ? <Badge variant="outline" className="text-xs border-amber-400 text-amber-600">Edited</Badge>
                                            : existing
                                            ? <Badge className="text-xs bg-green-500 text-white">Saved</Badge>
                                            : <span className="text-slate-400 text-xs">—</span>
                                          }
                                        </TableCell>
                                      </TableRow>
                                    );
                                  })}
                                </TableBody>
                              </Table>
                            </CardContent>
                          </Card>
                        );
                      })()}
                    </>
                  );
                })()}

                {(!modelTestDrafts?.filter((d) => d.status === "draft").length) && (
                  <div className="text-center py-14 text-slate-400">
                    <ClipboardList className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p className="font-medium">No active model tests</p>
                    <p className="text-sm">The Authority hasn't created any model test drafts yet.</p>
                  </div>
                )}
              </div>
            )}

            {/* ═══ STUDENT VIEW ═══ */}
            {isStudent && Object.keys(modelTestGroups).length > 0 && (
              <Card className="border-none bg-white dark:bg-slate-900 shadow-[0_2px_15px_-3px_rgba(0,0,0,0.07)] rounded-2xl overflow-hidden">
                <CardHeader className="border-b border-slate-100 dark:border-slate-800 py-6 px-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-100 dark:border-indigo-800"><ClipboardList className="w-5 h-5 text-indigo-500" /></div>
                    <div>
                      <CardTitle className="text-xl text-slate-900 dark:text-slate-100 font-extrabold">Model Test Results</CardTitle>
                      <p className="text-sm text-slate-500 dark:text-slate-400">Official results published by your Authority</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-4 space-y-3">
                  {Object.entries(modelTestGroups).map(([groupId, groupResults]) => {
                    const examN = groupResults[0]?.examName;
                    // Exclude absent records (-1) from sums and GPA so totals reflect
                    // only attended subjects.
                    const attendedRes = groupResults.filter((r: any) => r.obtainedMarks !== -1);
                    const totalObtained = attendedRes.reduce((s: number, r: any) => s + r.obtainedMarks, 0);
                    const totalFull = attendedRes.reduce((s: number, r: any) => s + r.totalMarks, 0);
                    const gpa = !groupResults.some((r: any) =>
                      ["F", "ABS", "INC"].includes(getGrade(r.obtainedMarks, r.totalMarks).grade)) && attendedRes.length > 0
                      ? attendedRes.map((r: any) => getGrade(r.obtainedMarks, r.totalMarks).gp)
                          .reduce((s: number, g: number) => s + g, 0) / attendedRes.length
                      : 0;
                    return (
                      <div key={groupId} className="border border-slate-200 dark:border-slate-700 rounded-xl p-4 flex items-center justify-between bg-slate-50 dark:bg-slate-800/40">
                        <div>
                          <p className="font-bold text-slate-900 dark:text-slate-100">{examN}</p>
                          <p className="text-sm text-slate-500 dark:text-slate-400">{groupResults.length} subjects · GPA: <span className="font-black text-indigo-600 dark:text-indigo-400">{gpa.toFixed(2)}</span></p>
                        </div>
                         <div className="flex flex-wrap items-center justify-end gap-2">
                           <Button asChild size="sm" variant="outline" className="gap-2">
                             <Link href={`/marksheet?groupId=${groupId}`}>
                               <Eye className="w-4 h-4" /> View Marksheet
                             </Link>
                           </Button>
                           <IndividualResultPdfButton groupId={groupId} />
                         </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            )}

            {isStudent && Object.keys(modelTestGroups).length === 0 && (
              <div className="text-center py-16 text-slate-400">
                <ClipboardList className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="font-medium">No published results yet</p>
                <p className="text-sm">Results will appear here once your Authority publishes them.</p>
              </div>
            )}
          </div>
        )}
        {mode === "omr" && isTeacher && (
          <OMRScanner onSaved={() => queryClient.invalidateQueries({ queryKey: ["/api/results"] })} />
        )}
      </div>

      {/* Bulk Delete Exam Confirmation */}
      <AlertDialog open={!!examToDelete} onOpenChange={(open) => !open && !deleteExamMutation.isPending && setExamToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete entire exam?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this entire exam and all associated student results?
              {examToDelete && (
                <span className="block mt-2 text-slate-700 font-medium">
                  {examToDelete.batchName} — {examToDelete.examName}
                </span>
              )}
              <span className="block mt-2 text-rose-600 font-medium">This action cannot be undone.</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteExamMutation.isPending} data-testid="button-cancel-delete-exam">Cancel</AlertDialogCancel>
            <AlertDialogAction
              data-testid="button-confirm-delete-exam"
              disabled={deleteExamMutation.isPending}
              className="bg-rose-600 hover:bg-rose-700 focus:ring-rose-600"
              onClick={(e) => {
                e.preventDefault();
                if (examToDelete) {
                  deleteExamMutation.mutate({ batchId: examToDelete.batchId, examName: examToDelete.examName });
                }
              }}
            >
              {deleteExamMutation.isPending ? "Deleting..." : "Delete Exam"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit Result Dialog — admin only */}
      <Dialog open={!!editingResult} onOpenChange={(open) => !open && setEditingResult(null)}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Edit Result Record</DialogTitle>
          </DialogHeader>
          {editingResult && (
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label className="text-sm font-medium">Exam Name</Label>
                <Input
                  value={editingResult.examName}
                  onChange={(e) => setEditingResult(prev => prev ? { ...prev, examName: e.target.value } : null)}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">Subject</Label>
                <Input
                  value={editingResult.subject}
                  onChange={(e) => setEditingResult(prev => prev ? { ...prev, subject: e.target.value } : null)}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Obtained Marks</Label>
                  <Input
                    type="number"
                    value={editingResult.obtainedMarks}
                    onChange={(e) => setEditingResult(prev => prev ? { ...prev, obtainedMarks: Number(e.target.value) } : null)}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Total Marks</Label>
                  <Input
                    type="number"
                    value={editingResult.totalMarks}
                    onChange={(e) => setEditingResult(prev => prev ? { ...prev, totalMarks: Number(e.target.value) } : null)}
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setEditingResult(null)}>Cancel</Button>
                <Button
                  disabled={updateResultMutation.isPending}
                  onClick={() => {
                    updateResultMutation.mutate({
                      id: editingResult.id,
                      data: {
                        examName: editingResult.examName,
                        subject: editingResult.subject,
                        obtainedMarks: editingResult.obtainedMarks,
                        totalMarks: editingResult.totalMarks,
                      }
                    });
                  }}
                >
                  {updateResultMutation.isPending ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingDraft} onOpenChange={(open) => {
        if (!open) {
          setEditAddSubjectPickerOpen(false);
          setEditingDraft(null);
        }
      }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[680px]">
          <DialogHeader>
            <DialogTitle>Edit Model Test Draft</DialogTitle>
            <p className="text-sm text-muted-foreground">
              Update the name or subject list. Class stays fixed so saved student records remain attached to the right group.
            </p>
          </DialogHeader>
          {editingDraft && (
            <div className="space-y-5 pt-2">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Exam Name</Label>
                  <Input
                    value={editingDraft.examName}
                    onChange={(event) => setEditingDraft((previous) =>
                      previous ? { ...previous, examName: event.target.value } : null
                    )}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Class / Batch</Label>
                  <Input
                    value={batches?.find((batch) => batch.id === editingDraft.batchId)?.name ?? ""}
                    disabled
                  />
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <Label>Subjects</Label>
                  <Select
                    value=""
                    open={editAddSubjectPickerOpen}
                    onOpenChange={setEditAddSubjectPickerOpen}
                    onValueChange={(subjectId) => {
                      addSubjectToEditedDraft(subjectId);
                      setEditAddSubjectPickerOpen(false);
                    }}
                  >
                    <SelectTrigger className="w-auto min-w-[190px]">
                      <SelectValue placeholder="Add a subject..." />
                    </SelectTrigger>
                    <SelectContent>
                      {editAvailableMasterSubjects
                        .filter((option) => !editingDraft.subjects.some((subject) =>
                          subject.name.trim().toLowerCase() === option.name.trim().toLowerCase()
                        ))
                        .map((option) => (
                          <SelectItem key={option.id} value={String(option.id)}>
                            {option.name} · /{option.totalMarks}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>

                {editingDraft.subjects.map((subject, index) => {
                  const subjectResultCount = modelTestResults.filter((result: any) =>
                    result.modelTestGroupId === editingDraft.groupId && result.subject === subject.name
                  ).length;
                  const rule = getSubjectMarkingRule(subject.name, subject);
                  return (
                    <div key={`${subject.subjectId ?? subject.name}-${index}`} className="rounded-lg border p-3 space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-semibold">{subject.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {rule.fields.map((field) => `${field.label} /${field.max}`).join(" · ")}
                            {" · "}Total /{rule.total}
                            {subject.allGroups ? " · All Groups" : ""}
                            {subjectResultCount ? ` · ${subjectResultCount} saved mark${subjectResultCount === 1 ? "" : "s"}` : ""}
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label={`Remove ${subject.name} from draft`}
                          className="shrink-0 text-destructive"
                          onClick={() => setEditingDraft((previous) => previous ? {
                            ...previous,
                            subjects: previous.subjects.filter((_, subjectIndex) => subjectIndex !== index),
                          } : null)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      {!subject.allGroups && editDraftAvailableGroups.length > 0 && (
                        <div className="space-y-1.5">
                          <Label className="text-xs">Academic Group</Label>
                          <Select
                            value={subject.academicGroup ?? ""}
                            disabled={subjectResultCount > 0}
                            onValueChange={(academicGroup) => setEditingDraft((previous) => previous ? {
                              ...previous,
                              subjects: previous.subjects.map((entry, subjectIndex) =>
                                subjectIndex === index ? { ...entry, academicGroup } : entry
                              ),
                            } : null)}
                          >
                            <SelectTrigger><SelectValue placeholder="Select group" /></SelectTrigger>
                            <SelectContent>
                              {editDraftAvailableGroups.map((group) => (
                                <SelectItem key={group} value={group}>{group}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {subjectResultCount > 0 && (
                            <p className="text-xs text-muted-foreground">Group scope is locked after marks are entered.</p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
                {editingDraft.subjects.length === 0 && (
                  <p className="rounded-lg border border-dashed p-5 text-center text-sm text-muted-foreground">
                    Add at least one subject before saving.
                  </p>
                )}
                {editAvailableMasterSubjects.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    There are no additional subjects configured for this class.
                  </p>
                )}
              </div>

              <div className="flex justify-end gap-2 border-t pt-4">
                <Button variant="outline" onClick={() => setEditingDraft(null)} disabled={updateDraftMutation.isPending}>
                  Cancel
                </Button>
                <Button onClick={handleUpdateDraft} disabled={updateDraftMutation.isPending || editingDraft.subjects.length === 0}>
                  {updateDraftMutation.isPending ? "Saving..." : "Save Draft Changes"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
