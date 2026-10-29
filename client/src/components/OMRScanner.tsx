import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  Check,
  CheckCircle2,
  ChevronRight,
  FileImage,
  Loader2,
  Plus,
  RotateCcw,
  ScanLine,
  ShieldCheck,
  Upload,
} from "lucide-react";
import { useBatches, useStudents } from "@/hooks/use-finance";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Answer = "A" | "B" | "C" | "D";
type SetCode = "ক" | "খ" | "গ" | "ঘ";
type AnswerKeys = Record<SetCode, Answer[]>;
type Config = {
  id: number;
  batchId: number;
  examName: string;
  subject: string;
  questionCount: number;
  answerKeys: AnswerKeys;
  createdAt: string;
};
type ScanResponse = {
  question: number;
  selected: Answer | null;
  status: "valid" | "blank" | "multiple" | "ambiguous";
};
type ScanResult = {
  rollNumber: string | null;
  setCode: SetCode | null;
  responses: ScanResponse[];
  grading: {
    correct: number;
    wrong: number;
    unattempted: number;
    obtainedMarks: number;
    totalMarks: number;
  };
};
type StudentRecord = {
  id: number | string;
  name?: string;
  fullName?: string;
  studentName?: string;
  studentCustomId?: string | number | null;
  rollNumber?: string | number | null;
  batchId?: number | string | null;
  status?: string | null;
  isActive?: boolean;
};
type Props = { onSaved?: () => void };

const SET_CODES: SetCode[] = ["ক", "খ", "গ", "ঘ"];
const ANSWERS: Answer[] = ["A", "B", "C", "D"];
const EMPTY_KEYS = (): Record<SetCode, Array<Answer | "">> => ({
  ক: Array(30).fill(""),
  খ: Array(30).fill(""),
  গ: Array(30).fill(""),
  ঘ: Array(30).fill(""),
});

async function compressImage(file: File): Promise<string> {
  let bitmap: ImageBitmap | null = null;
  let source: CanvasImageSource;
  let width: number;
  let height: number;

  if ("createImageBitmap" in window) {
    bitmap = await createImageBitmap(file);
    source = bitmap;
    width = bitmap.width;
    height = bitmap.height;
  } else {
    const objectUrl = URL.createObjectURL(file);
    try {
      const image = await new Promise<HTMLImageElement>((resolve, reject) => {
        const element = new Image();
        element.onload = () => resolve(element);
        element.onerror = () => reject(new Error("This image could not be opened."));
        element.src = objectUrl;
      });
      source = image;
      width = image.naturalWidth;
      height = image.naturalHeight;
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  }

  try {
    const maxDimension = 1800;
    const scale = Math.min(1, maxDimension / Math.max(width, height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Image compression is unavailable in this browser.");
    context.drawImage(source, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.78);
  } finally {
    bitmap?.close();
  }
}

function studentName(student: StudentRecord) {
  return student.name || student.fullName || student.studentName || `Student ${student.id}`;
}

function normalizeRoll(value: unknown) {
  return String(value ?? "").trim().toLocaleLowerCase();
}

function statusPresentation(status: ScanResponse["status"]) {
  if (status === "valid") return { label: "Marked", className: "border-[#b9ddcc] bg-[#edf7f0] text-[#28744b]" };
  if (status === "blank") return { label: "Blank", className: "border-[#e7d7ad] bg-[#fbf5e5] text-[#8c6920]" };
  if (status === "multiple") return { label: "Multiple", className: "border-[#e8c1b7] bg-[#fbefec] text-[#a44635]" };
  return { label: "Review", className: "border-[#d6c8e7] bg-[#f4eff9] text-[#70508d]" };
}

export default function OMRScanner({ onSaved }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: batches, isLoading: batchesLoading, isError: batchesError } = useBatches();
  const { data: students, isLoading: studentsLoading, isError: studentsError } = useStudents();
  const [batchId, setBatchId] = useState("");
  const [configId, setConfigId] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [examName, setExamName] = useState("");
  const [subject, setSubject] = useState("");
  const [questionCount, setQuestionCount] = useState("30");
  const [activeSet, setActiveSet] = useState<SetCode>("ক");
  const [draftKeys, setDraftKeys] = useState(EMPTY_KEYS);
  const [imageData, setImageData] = useState("");
  const [imageName, setImageName] = useState("");
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [studentId, setStudentId] = useState("");
  const [imageError, setImageError] = useState("");
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!batchId && batches?.length) setBatchId(String(batches[0].id));
  }, [batchId, batches]);

  const configsQuery = useQuery<Config[]>({
    queryKey: ["/api/omr/configs", batchId],
    enabled: Boolean(batchId),
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/omr/configs?batchId=${encodeURIComponent(batchId)}`);
      return response.json();
    },
  });
  const configs = configsQuery.data ?? [];
  const selectedConfig = configs.find((config) => String(config.id) === configId);

  useEffect(() => {
    if (!isCreating && configs.length && !configs.some((config) => String(config.id) === configId)) {
      setConfigId(String(configs[0].id));
    } else if (!configs.length && !isCreating) {
      setConfigId("");
    }
  }, [configs, configId, isCreating]);

  const activeStudents = useMemo(() => {
    return ((students ?? []) as StudentRecord[]).filter((student) => {
      const activeStatus = String(student.status ?? "").toLowerCase();
      const active = student.isActive !== false && (!activeStatus || ["active", "enrolled", "current"].includes(activeStatus));
      const belongsToBatch = student.batchId == null || String(student.batchId) === batchId;
      return active && belongsToBatch;
    });
  }, [students, batchId]);

  useEffect(() => {
    if (!scanResult?.rollNumber) return;
    const normalized = normalizeRoll(scanResult.rollNumber);
    const match = activeStudents.find((student) =>
      normalizeRoll(student.studentCustomId) === normalized ||
      normalizeRoll(student.rollNumber) === normalized
    );
    if (match) setStudentId(String(match.id));
  }, [scanResult, activeStudents]);

  const createConfigMutation = useMutation({
    mutationFn: async () => {
      const count = Number(questionCount);
      if (!batchId) throw new Error("Select a batch before creating an exam.");
      if (!examName.trim() || !subject.trim()) throw new Error("Enter an exam name and subject.");
      if (!Number.isInteger(count) || count < 1 || count > 30) throw new Error("Question count must be between 1 and 30.");
      const missing = SET_CODES.flatMap((setCode) =>
        draftKeys[setCode].slice(0, count).some((answer) => !answer) ? [setCode] : []
      );
      if (missing.length) throw new Error(`Complete every answer key. Set ${missing.join(", ")} still has unanswered questions.`);
      const answerKeys = Object.fromEntries(
        SET_CODES.map((setCode) => [setCode, draftKeys[setCode].slice(0, count) as Answer[]])
      ) as AnswerKeys;
      const response = await apiRequest("POST", "/api/omr/configs", {
        batchId: Number(batchId),
        examName: examName.trim(),
        subject: subject.trim(),
        questionCount: count,
        answerKeys,
      });
      return response.json() as Promise<Config>;
    },
    onSuccess: async (savedConfig) => {
      await queryClient.invalidateQueries({ queryKey: ["/api/omr/configs", batchId] });
      setConfigId(String(savedConfig.id));
      setIsCreating(false);
      setExamName("");
      setSubject("");
      setDraftKeys(EMPTY_KEYS());
      toast({ title: "Exam key saved", description: `${savedConfig.examName} is ready to scan.` });
    },
    onError: (error: Error) => toast({ title: "Could not save exam key", description: error.message, variant: "destructive" }),
  });

  const scanMutation = useMutation({
    mutationFn: async () => {
      if (!configId) throw new Error("Choose an exam configuration first.");
      if (!imageData) throw new Error("Upload or capture a sheet before scanning.");
      const response = await apiRequest("POST", "/api/omr/scan", { configId: Number(configId), imageData });
      return response.json() as Promise<ScanResult>;
    },
    onSuccess: (result) => {
      setScanResult(result);
      setStudentId("");
      if (!result.rollNumber) {
        toast({ title: "Scan complete", description: "No roll number was detected. Select the student manually." });
      } else {
        toast({ title: "Scan complete", description: `Roll ${result.rollNumber} is ready for review.` });
      }
    },
    onError: (error: Error) => toast({ title: "Scan could not be completed", description: error.message, variant: "destructive" }),
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!configId || !imageData || !studentId) throw new Error("Choose a student and review the scanned sheet before saving.");
      const response = await apiRequest("POST", "/api/omr/save", {
        configId: Number(configId),
        imageData,
        studentId: Number(studentId),
      });
      return response.json() as Promise<{ saved: boolean; resultId: number; studentId: number; obtainedMarks: number; totalMarks: number }>;
    },
    onSuccess: (result) => {
      if (!result.saved) {
        toast({ title: "Result was not saved", description: "The server did not confirm this result.", variant: "destructive" });
        return;
      }
      queryClient.invalidateQueries({ queryKey: ["/api/results"] });
      toast({
        title: "Result saved",
        description: `${result.obtainedMarks} of ${result.totalMarks} marks recorded for the selected student.`,
      });
      onSaved?.();
      setScanResult(null);
      setImageData("");
      setImageName("");
      setStudentId("");
    },
    onError: (error: Error) => toast({ title: "Could not save result", description: error.message, variant: "destructive" }),
  });

  const handleImage = async (file?: File) => {
    setImageError("");
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setImageError("Choose an image file such as JPG, PNG, or WebP.");
      return;
    }
    try {
      const compressed = await compressImage(file);
      setImageData(compressed);
      setImageName(file.name);
      setScanResult(null);
      setStudentId("");
    } catch (error) {
      setImageError(error instanceof Error ? error.message : "This image could not be prepared.");
    }
  };

  const changeBatch = (value: string) => {
    setBatchId(value);
    setConfigId("");
    setIsCreating(false);
    setScanResult(null);
    setImageData("");
    setImageName("");
    setStudentId("");
  };

  const updateAnswer = (questionIndex: number, answer: Answer) => {
    setDraftKeys((current) => ({
      ...current,
      [activeSet]: current[activeSet].map((value, index) => index === questionIndex ? answer : value),
    }));
  };

  const beginNewConfig = () => {
    setIsCreating(true);
    setConfigId("");
    setExamName("");
    setSubject("");
    setQuestionCount("30");
    setActiveSet("ক");
    setDraftKeys(EMPTY_KEYS());
  };

  const clearScan = () => {
    setScanResult(null);
    setStudentId("");
    setImageData("");
    setImageName("");
    setImageError("");
    if (cameraInputRef.current) cameraInputRef.current.value = "";
    if (uploadInputRef.current) uploadInputRef.current.value = "";
  };

  const batchError = !batchesLoading && (batchesError || !batches?.length);
  const canScan = Boolean(batchId && configId && imageData) && !scanMutation.isPending;
  const studentSelectLabel = studentsLoading
    ? "Loading students…"
    : studentsError
      ? "Student list unavailable"
      : activeStudents.length
        ? "Select the matching student"
        : "No active students found for this batch";

  return (
    <div className="min-h-[100dvh] space-y-5 pb-10">
      <section className="relative overflow-hidden rounded-3xl border border-[#d5dfd9] bg-[#f4f7f3] px-5 py-6 sm:px-8 sm:py-8">
        <div className="pointer-events-none absolute -right-16 -top-24 h-64 w-64 rounded-full border-[1px] border-[#cbd8d0] opacity-70" />
        <div className="pointer-events-none absolute -right-2 -top-12 h-44 w-44 rounded-full border-[1px] border-[#d6e0d9] opacity-70" />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-2xl">
            <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-[#527563]">
              <ScanLine className="h-4 w-4" aria-hidden="true" />
              Results · OMR desk
            </div>
            <h1 className="font-display text-3xl font-semibold tracking-tight text-[#19392d] sm:text-4xl">
              Read the sheet.<br className="hidden sm:block" /> Keep the record.
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-[#5e7168] sm:text-base">
              Scan a paper MCQ sheet, verify what was detected, then link the confirmed marks to the right student.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-3 rounded-2xl border border-[#d7e1da] bg-[#fbfcfa] px-4 py-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#e4eee7] text-[#35664c]">
              <ShieldCheck className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <p className="text-sm font-semibold text-[#244637]">Review before saving</p>
              <p className="text-xs text-[#718178]">Nothing is recorded until you confirm</p>
            </div>
          </div>
        </div>
        <div className="relative mt-7 grid grid-cols-3 gap-2 border-t border-[#dbe4dd] pt-4 sm:max-w-[550px] sm:gap-4">
          {[
            ["01", "Choose exam"],
            ["02", "Scan sheet"],
            ["03", "Confirm result"],
          ].map(([number, label], index) => (
            <div key={number} className="flex items-center gap-2 text-xs sm:text-sm">
              <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full font-mono text-[11px] ${index === 0 ? "bg-[#254f3b] text-white" : "bg-[#e2eae4] text-[#5e7768]"}`}>
                {number}
              </span>
              <span className="font-medium text-[#50665a]">{label}</span>
              {index < 2 && <ChevronRight className="ml-auto hidden h-4 w-4 text-[#9aac9f] sm:block" aria-hidden="true" />}
            </div>
          ))}
        </div>
      </section>

      {batchError ? (
        <Card className="border-[#e7c9c1] bg-[#fcf5f2]">
          <CardContent className="flex items-start gap-3 p-5">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-[#a34938]" aria-hidden="true" />
            <div>
              <p className="font-semibold text-[#783b30]">{batchesError ? "Batches could not be loaded" : "No batches available"}</p>
              <p className="mt-1 text-sm text-[#8c6259]">{batchesError ? "Refresh the page and try again." : "Create a batch before setting up an OMR exam."}</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,0.92fr)_minmax(420px,1.08fr)]">
          <div className="space-y-5">
            <Card className="overflow-hidden border-[#dce4de]">
              <CardHeader className="border-b border-[#e8ede9] bg-[#fbfcfa] pb-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#648070]">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#e7efe9] font-mono text-[#35664c]">01</span>
                      Exam setup
                    </div>
                    <CardTitle className="text-xl text-[#213d30]">Choose a key</CardTitle>
                    <CardDescription className="mt-1">Answer keys stay organized by batch and set code.</CardDescription>
                  </div>
                  {!isCreating && (
                    <Button variant="outline" size="sm" onClick={beginNewConfig} className="shrink-0 border-[#cbd9cf] text-[#35664c]">
                      <Plus className="h-4 w-4" aria-hidden="true" />
                      <span className="hidden sm:inline">New exam</span>
                      <span className="sm:hidden">New</span>
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-5 p-5">
                <div className="space-y-2">
                  <label htmlFor="omr-batch" className="text-sm font-medium text-[#43594c]">Batch</label>
                  <Select value={batchId || undefined} onValueChange={changeBatch}>
                    <SelectTrigger id="omr-batch" aria-label="Select batch" className="h-11 border-[#d8e1da] bg-white">
                      <SelectValue placeholder={batchesLoading ? "Loading batches…" : "Select a batch"} />
                    </SelectTrigger>
                    <SelectContent>
                      {(batches ?? []).map((batch) => (
                        <SelectItem key={batch.id} value={String(batch.id)}>{batch.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {isCreating ? (
                  <div className="space-y-5 rounded-2xl border border-[#dce5de] bg-[#f7faf7] p-4 sm:p-5">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <label htmlFor="omr-exam-name" className="text-sm font-medium text-[#43594c]">Exam name</label>
                        <Input id="omr-exam-name" value={examName} onChange={(event) => setExamName(event.target.value)} placeholder="e.g. Chapter 04 assessment" className="h-11 border-[#d8e1da] bg-white" />
                      </div>
                      <div className="space-y-2">
                        <label htmlFor="omr-subject" className="text-sm font-medium text-[#43594c]">Subject</label>
                        <Input id="omr-subject" value={subject} onChange={(event) => setSubject(event.target.value)} placeholder="e.g. Biology" className="h-11 border-[#d8e1da] bg-white" />
                      </div>
                    </div>
                    <div className="space-y-2 sm:max-w-[220px]">
                      <label htmlFor="omr-question-count" className="text-sm font-medium text-[#43594c]">Question count</label>
                      <Input
                        id="omr-question-count"
                        type="number"
                        min={1}
                        max={30}
                        value={questionCount}
                        onChange={(event) => setQuestionCount(event.target.value)}
                        className="h-11 border-[#d8e1da] bg-white"
                      />
                      <p className="text-xs text-[#7b8b80]">Up to 30 questions on the fixed sheet.</p>
                    </div>

                    <div className="border-t border-[#dfe7e1] pt-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                        <div>
                          <p className="text-sm font-semibold text-[#304c3b]">Set answer key</p>
                          <p className="mt-1 text-xs text-[#718178]">Complete every question for each set before saving.</p>
                        </div>
                        <div role="tablist" aria-label="Answer key set" className="inline-flex w-fit rounded-xl border border-[#d9e3dc] bg-white p-1">
                          {SET_CODES.map((code) => (
                            <button
                              type="button"
                              key={code}
                              role="tab"
                              aria-selected={activeSet === code}
                              onClick={() => setActiveSet(code)}
                              className={`min-w-10 rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors ${activeSet === code ? "bg-[#315c45] text-white shadow-sm" : "text-[#60766a] hover:bg-[#edf3ee]"}`}
                            >
                              {code}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
                        {Array.from({ length: Math.max(0, Math.min(30, Number(questionCount) || 0)) }, (_, index) => (
                          <fieldset key={index} className="flex min-w-0 items-center justify-between gap-2 rounded-xl border border-[#e2e9e3] bg-white px-3 py-2">
                            <legend className="sr-only">Question {index + 1}</legend>
                            <span className="w-8 shrink-0 font-mono text-xs text-[#829187]">{String(index + 1).padStart(2, "0")}</span>
                            <div className="flex gap-1" role="radiogroup" aria-label={`Question ${index + 1} answer`}>
                              {ANSWERS.map((answer) => (
                                <button
                                  key={answer}
                                  type="button"
                                  role="radio"
                                  aria-checked={draftKeys[activeSet][index] === answer}
                                  aria-label={`Question ${index + 1}: ${answer}`}
                                  onClick={() => updateAnswer(index, answer)}
                                  className={`flex h-8 w-8 items-center justify-center rounded-full border text-xs font-semibold transition-colors ${draftKeys[activeSet][index] === answer ? "border-[#315c45] bg-[#315c45] text-white" : "border-[#dce5de] bg-[#fbfcfa] text-[#6f8175] hover:border-[#7da08a] hover:text-[#315c45]"}`}
                                >
                                  {answer}
                                </button>
                              ))}
                            </div>
                          </fieldset>
                        ))}
                      </div>
                    </div>
                    <div className="flex flex-col-reverse gap-2 border-t border-[#dfe7e1] pt-4 sm:flex-row sm:justify-end">
                      <Button variant="ghost" onClick={() => setIsCreating(false)} disabled={createConfigMutation.isPending}>Cancel</Button>
                      <Button onClick={() => createConfigMutation.mutate()} disabled={createConfigMutation.isPending} className="bg-[#315c45] text-white hover:bg-[#264c38]">
                        {createConfigMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Check className="h-4 w-4" aria-hidden="true" />}
                        Save answer key
                      </Button>
                    </div>
                  </div>
                ) : configsQuery.isLoading ? (
                  <div className="space-y-3" aria-label="Loading exam configurations">
                    <div className="h-11 animate-pulse rounded-xl bg-[#edf2ee]" />
                    <div className="h-24 animate-pulse rounded-xl bg-[#edf2ee]" />
                  </div>
                ) : configsQuery.isError ? (
                  <div className="rounded-2xl border border-[#e7c9c1] bg-[#fcf5f2] p-4">
                    <p className="text-sm font-semibold text-[#783b30]">Exam keys could not be loaded</p>
                    <p className="mt-1 text-xs text-[#8c6259]">Check your connection and try again.</p>
                    <Button variant="outline" size="sm" className="mt-3 border-[#d8b8ae]" onClick={() => configsQuery.refetch()}>Retry</Button>
                  </div>
                ) : configs.length ? (
                  <div className="space-y-2">
                    <label htmlFor="omr-config" className="text-sm font-medium text-[#43594c]">Configured exam</label>
                    <Select value={configId || undefined} onValueChange={(value) => {
                      setConfigId(value);
                      setScanResult(null);
                      setStudentId("");
                    }}>
                      <SelectTrigger id="omr-config" aria-label="Select configured exam" className="h-11 border-[#d8e1da] bg-white">
                        <SelectValue placeholder="Select exam" />
                      </SelectTrigger>
                      <SelectContent>
                        {configs.map((config) => (
                          <SelectItem key={config.id} value={String(config.id)}>
                            {config.examName} · {config.subject} · {config.questionCount} Q
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {selectedConfig && (
                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        <Badge variant="outline" className="border-[#d7e2da] bg-[#f5f8f5] text-[#526d5c]">{selectedConfig.questionCount} questions</Badge>
                        <Badge variant="outline" className="border-[#d7e2da] bg-[#f5f8f5] text-[#526d5c]">4 answer sets</Badge>
                        <span className="text-xs text-[#819086]">{selectedConfig.examName}</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-[#cbd9cf] bg-[#f8faf8] px-5 py-7 text-center">
                    <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl bg-[#e8f0e9] text-[#467153]">
                      <FileImage className="h-5 w-5" aria-hidden="true" />
                    </div>
                    <p className="mt-3 font-semibold text-[#304c3b]">No exam key for this batch</p>
                    <p className="mx-auto mt-1 max-w-xs text-sm leading-5 text-[#728178]">Create a key for all four sheet sets before scanning.</p>
                    <Button onClick={beginNewConfig} className="mt-4 bg-[#315c45] text-white hover:bg-[#264c38]">
                      <Plus className="h-4 w-4" aria-hidden="true" />
                      Create exam key
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="overflow-hidden border-[#dce4de]">
              <CardHeader className="border-b border-[#e8ede9] bg-[#fbfcfa] pb-4">
                <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#648070]">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#e7efe9] font-mono text-[#35664c]">02</span>
                  Sheet capture
                </div>
                <CardTitle className="text-xl text-[#213d30]">Add a paper sheet</CardTitle>
                <CardDescription className="mt-1">Use a clear, straight-on photo with the full sheet in frame.</CardDescription>
              </CardHeader>
              <CardContent className="p-5">
                <input ref={uploadInputRef} type="file" accept="image/*" className="sr-only" aria-label="Choose a sheet image" onChange={(event) => void handleImage(event.target.files?.[0])} />
                <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="sr-only" aria-label="Take a sheet photo with camera" onChange={(event) => void handleImage(event.target.files?.[0])} />
                {imageData ? (
                  <div className="grid gap-4 sm:grid-cols-[140px_1fr]">
                    <div className="aspect-[4/5] overflow-hidden rounded-xl border border-[#dce5de] bg-[#eef2ee]">
                      <img src={imageData} alt="Preview of the selected answer sheet" className="h-full w-full object-cover" />
                    </div>
                    <div className="flex flex-col justify-center">
                      <div className="flex items-center gap-2 text-[#35664c]">
                        <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
                        <span className="text-sm font-semibold">Image ready to scan</span>
                      </div>
                      <p className="mt-1 break-all text-xs text-[#78877d]">{imageName} · compressed for upload</p>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <Button onClick={() => scanMutation.mutate()} disabled={!canScan} className="bg-[#315c45] text-white hover:bg-[#264c38]">
                          {scanMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <ScanLine className="h-4 w-4" aria-hidden="true" />}
                          {scanMutation.isPending ? "Reading sheet…" : "Scan sheet"}
                        </Button>
                        <Button variant="outline" onClick={clearScan} disabled={scanMutation.isPending} className="border-[#d6e0d8]">
                          <RotateCcw className="h-4 w-4" aria-hidden="true" />
                          Replace
                        </Button>
                      </div>
                      {!configId && <p className="mt-3 text-xs text-[#8d7134]">Choose or create an exam key before scanning.</p>}
                    </div>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-[#cbd9cf] bg-[#f8faf8] px-4 py-7 text-center sm:px-6">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#e7efe9] text-[#39684c]">
                      <Upload className="h-5 w-5" aria-hidden="true" />
                    </div>
                    <p className="mt-3 font-semibold text-[#304c3b]">Choose a photo of the completed sheet</p>
                    <p className="mt-1 text-sm text-[#75847a]">JPG, PNG, or WebP · resized to keep uploads quick</p>
                    <div className="mt-5 flex flex-col justify-center gap-2 sm:flex-row">
                      <Button variant="outline" onClick={() => uploadInputRef.current?.click()} className="border-[#cfdbd2] bg-white text-[#365d45]">
                        <FileImage className="h-4 w-4" aria-hidden="true" />
                        Choose image
                      </Button>
                      <Button onClick={() => cameraInputRef.current?.click()} className="bg-[#315c45] text-white hover:bg-[#264c38]">
                        <ScanLine className="h-4 w-4" aria-hidden="true" />
                        Use camera
                      </Button>
                    </div>
                    <p className="mx-auto mt-4 max-w-sm text-xs leading-5 text-[#87948a]">Keep all four corners and the roll-number grid visible. Avoid shadows across answer bubbles.</p>
                  </div>
                )}
                {imageError && (
                  <p role="alert" className="mt-3 flex items-start gap-2 text-sm text-[#a34938]">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />{imageError}
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          <Card className="overflow-hidden border-[#dce4de] xl:sticky xl:top-5">
            <CardHeader className="border-b border-[#e8ede9] bg-[#fbfcfa] pb-4">
              <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#648070]">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#e7efe9] font-mono text-[#35664c]">03</span>
                Review & save
              </div>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle className="text-xl text-[#213d30]">Check the result</CardTitle>
                  <CardDescription className="mt-1">Detected marks are a draft until you confirm the student.</CardDescription>
                </div>
                {scanResult && <Badge variant="outline" className="border-[#b9ddcc] bg-[#edf7f0] text-[#28744b]">Scanned</Badge>}
              </div>
            </CardHeader>
            <CardContent className="space-y-5 p-5">
              {!scanResult ? (
                <div className="flex min-h-[250px] flex-col items-center justify-center rounded-2xl border border-dashed border-[#d7e1da] bg-[#f8faf8] px-6 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#e9f0ea] text-[#4b7559]">
                    <ScanLine className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <p className="mt-3 font-semibold text-[#405b49]">Waiting for a sheet</p>
                  <p className="mt-1 max-w-xs text-sm leading-5 text-[#7a8980]">Once scanned, the roll, set code, individual responses, and mark breakdown will appear here.</p>
                  {scanMutation.isPending && (
                    <div className="mt-5 flex items-center gap-2 text-sm text-[#527563]" role="status">
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Processing sheet…
                    </div>
                  )}
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-2xl border border-[#dce5de] bg-[#f7faf7] p-4">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.13em] text-[#74867a]">Detected roll</p>
                      <p className="mt-2 font-mono text-2xl font-semibold tracking-[0.08em] text-[#244637]">{scanResult.rollNumber || "Not found"}</p>
                    </div>
                    <div className="rounded-2xl border border-[#dce5de] bg-[#f7faf7] p-4">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.13em] text-[#74867a]">Set code</p>
                      <p className="mt-2 text-2xl font-semibold text-[#244637]">{scanResult.setCode || "Not found"}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="rounded-xl bg-[#edf7f0] px-3 py-3 text-center">
                      <p className="font-mono text-xl font-semibold text-[#28744b]">{scanResult.grading.correct}</p>
                      <p className="mt-1 text-[11px] font-medium text-[#587763]">Correct</p>
                    </div>
                    <div className="rounded-xl bg-[#fbefec] px-3 py-3 text-center">
                      <p className="font-mono text-xl font-semibold text-[#a44635]">{scanResult.grading.wrong}</p>
                      <p className="mt-1 text-[11px] font-medium text-[#8c6259]">Wrong</p>
                    </div>
                    <div className="rounded-xl bg-[#fbf5e5] px-3 py-3 text-center">
                      <p className="font-mono text-xl font-semibold text-[#8c6920]">{scanResult.grading.unattempted}</p>
                      <p className="mt-1 text-[11px] font-medium text-[#827450]">Unattempted</p>
                    </div>
                  </div>
                  <div className="flex items-end justify-between rounded-2xl border border-[#d9e3dc] bg-[#f4f8f4] px-4 py-3">
                    <div>
                      <p className="text-xs font-medium text-[#687b6e]">Obtained marks</p>
                      <p className="mt-1 font-mono text-3xl font-semibold tracking-tight text-[#244637]">{scanResult.grading.obtainedMarks}<span className="px-1 text-lg font-normal text-[#9aa89d]">/</span><span className="text-lg text-[#6b7f71]">{scanResult.grading.totalMarks}</span></p>
                    </div>
                    <span className="pb-1 text-xs font-semibold uppercase tracking-wider text-[#66806f]">Marks</span>
                  </div>

                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-[#405b49]">Response check</h3>
                      <span className="text-xs text-[#829187]">{scanResult.responses.length} questions</span>
                    </div>
                    <div className="grid max-h-64 grid-cols-2 gap-2 overflow-y-auto rounded-xl border border-[#e2e9e3] bg-[#fbfcfa] p-2 sm:grid-cols-3">
                      {scanResult.responses.map((response) => {
                        const presentation = statusPresentation(response.status);
                        return (
                          <div key={response.question} className="flex items-center justify-between gap-2 rounded-lg bg-white px-2.5 py-2">
                            <span className="font-mono text-xs text-[#87948a]">Q{String(response.question).padStart(2, "0")}</span>
                            <span className="font-mono text-sm font-semibold text-[#355644]">{response.selected || "—"}</span>
                            <span className={`rounded-md border px-1.5 py-0.5 text-[10px] font-medium ${presentation.className}`}>{presentation.label}</span>
                          </div>
                        );
                      })}
                    </div>
                    {(scanResult.responses.some((response) => response.status === "multiple" || response.status === "ambiguous")) && (
                      <p className="mt-2 flex items-start gap-2 text-xs leading-5 text-[#826a35]">
                        <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                        Multiple or uncertain marks are flagged for your review. Confirm the paper before recording.
                      </p>
                    )}
                  </div>

                  <div className="space-y-2 border-t border-[#e5ebe6] pt-4">
                    <div className="flex items-center justify-between gap-2">
                      <label htmlFor="omr-student" className="text-sm font-semibold text-[#405b49]">Link to student</label>
                      {studentId && <span className="text-xs font-medium text-[#39714e]">Student selected</span>}
                    </div>
                    <Select value={studentId || undefined} onValueChange={setStudentId} disabled={studentsLoading || studentsError || !activeStudents.length}>
                      <SelectTrigger id="omr-student" aria-label="Select active student" className="h-11 border-[#d8e1da] bg-white">
                        <SelectValue placeholder={studentSelectLabel} />
                      </SelectTrigger>
                      <SelectContent>
                        {activeStudents.map((student) => (
                          <SelectItem key={student.id} value={String(student.id)}>
                            {studentName(student)}{student.studentCustomId ? ` · ${student.studentCustomId}` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {scanResult.rollNumber && !studentId && !studentsLoading && (
                      <p className="text-xs text-[#8d7134]">No active student matched roll {scanResult.rollNumber}. Choose the correct record above.</p>
                    )}
                    {studentsError && <p role="alert" className="text-xs text-[#a34938]">Could not load students. Reload the page to try again.</p>}
                    {!activeStudents.length && !studentsLoading && !studentsError && (
                      <p className="text-xs text-[#8d7134]">No active students are available for this batch.</p>
                    )}
                  </div>

                  <div className="flex flex-col gap-2 border-t border-[#e5ebe6] pt-4 sm:flex-row">
                    <Button variant="outline" onClick={clearScan} disabled={saveMutation.isPending} className="border-[#d6e0d8] sm:flex-1">
                      <RotateCcw className="h-4 w-4" aria-hidden="true" />
                      Start over
                    </Button>
                    <Button onClick={() => saveMutation.mutate()} disabled={!studentId || saveMutation.isPending} className="bg-[#315c45] text-white hover:bg-[#264c38] sm:flex-[1.5]">
                      {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <CheckCircle2 className="h-4 w-4" aria-hidden="true" />}
                      {saveMutation.isPending ? "Saving result…" : "Confirm & save result"}
                    </Button>
                  </div>
                  <p className="text-center text-[11px] leading-4 text-[#86948a]">The scan is reprocessed on save and linked to the selected student record.</p>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
