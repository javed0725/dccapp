import { useState } from "react";
import { Download, FileSpreadsheet, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

type IndividualResultPdfButtonProps = {
  groupId: string;
  studentId?: number;
};

type ClassResultPdfDownloadProps = {
  groupId: string;
  groups: string[];
  session?: string;
};

function safeFilename(value: string, fallback: string) {
  const sanitized = value
    .replace(/\.pdf$/i, "")
    .replace(/[/\\?%*:|"<>]/g, "-")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/\s+/g, "_")
    .replace(/\.{2,}/g, ".")
    .replace(/^[.-]+|[.-]+$/g, "")
    .slice(0, 120);
  return `${sanitized || fallback}.pdf`;
}

function responseFilename(response: Response, fallback: string) {
  const disposition = response.headers.get("content-disposition") || "";
  const match = disposition.match(/filename\*?=(?:UTF-8''|")?([^";]+)/i);
  return safeFilename(match?.[1]?.replace(/"/g, "").trim() || fallback, fallback);
}

async function downloadPdf(url: string, fallbackFilename: string) {
  const response = await fetch(url, { credentials: "include" });
  if (!response.ok) {
    const contentType = response.headers.get("content-type") || "";
    let message = `Download failed (${response.status}). Please try again.`;
    if (contentType.includes("application/json")) {
      try {
        const payload = await response.json();
        message = payload?.message || payload?.error || message;
      } catch {
        // Keep the status-based message when an error response is malformed.
      }
    } else {
      const text = await response.text().catch(() => "");
      if (text) message = text.slice(0, 400);
    }
    throw new Error(message);
  }

  if (!response.headers.get("content-type")?.includes("application/pdf")) {
    throw new Error("The server did not return a PDF. Please try again.");
  }
  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = responseFilename(response, fallbackFilename);
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}

export function IndividualResultPdfButton({ groupId, studentId }: IndividualResultPdfButtonProps) {
  const [pending, setPending] = useState(false);
  const { toast } = useToast();

  const handleDownload = async () => {
    if (pending) return;
    setPending(true);
    const query = typeof studentId === "number" && Number.isFinite(studentId)
      ? `?studentId=${encodeURIComponent(String(studentId))}`
      : "";
    try {
      await downloadPdf(
        `/api/model-test-drafts/${encodeURIComponent(groupId)}/transcript.pdf${query}`,
        `model-test-${groupId}-transcript`,
      );
      toast({ title: "PDF downloaded", description: "The individual result PDF is ready." });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Could not download PDF",
        description: error instanceof Error ? error.message : "Please try again.",
      });
    } finally {
      setPending(false);
    }
  };

  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      className="gap-2"
      onClick={handleDownload}
      disabled={pending || !groupId}
      aria-busy={pending}
    >
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
      {pending ? "Preparing PDF…" : "Download Individual PDF"}
    </Button>
  );
}

export function ClassResultPdfDownload({ groupId, groups, session }: ClassResultPdfDownloadProps) {
  const [academicGroup, setAcademicGroup] = useState("all");
  const [selectedSession, setSelectedSession] = useState(session || "");
  const [pending, setPending] = useState(false);
  const { toast } = useToast();

  const handleDownload = async () => {
    if (pending) return;
    setPending(true);
    const params = new URLSearchParams();
    if (academicGroup !== "all") params.set("academicGroup", academicGroup);
    const cleanSession = selectedSession.trim().slice(0, 40);
    if (cleanSession) params.set("session", cleanSession);
    const query = params.toString();
    try {
      await downloadPdf(
        `/api/model-test-drafts/${encodeURIComponent(groupId)}/tabulation.pdf${query ? `?${query}` : ""}`,
        `model-test-${groupId}-class-result`,
      );
      toast({ title: "Class result PDF downloaded", description: "The tabulation sheet is ready." });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Could not download class PDF",
        description: error instanceof Error ? error.message : "Please try again.",
      });
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-green-200 bg-white/80 p-3 sm:flex-row sm:items-end sm:flex-wrap">
      <div className="flex min-w-[160px] flex-col gap-1.5">
        <label htmlFor={`pdf-group-${groupId}`} className="text-xs font-semibold text-slate-600">Academic group</label>
        <Select value={academicGroup} onValueChange={setAcademicGroup}>
          <SelectTrigger id={`pdf-group-${groupId}`} className="h-9">
            <SelectValue placeholder="All Groups" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Groups</SelectItem>
            {groups.map((group) => <SelectItem key={group} value={group}>{group}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="flex min-w-[130px] flex-col gap-1.5">
        <label className="text-xs font-semibold text-slate-600" htmlFor={`pdf-session-${groupId}`}>Session (optional)</label>
        <Input
          id={`pdf-session-${groupId}`}
          value={selectedSession}
          onChange={(event) => setSelectedSession(event.target.value.slice(0, 40))}
          maxLength={40}
          placeholder="e.g. 2025"
          className="h-9"
        />
      </div>
      <Button
        type="button"
        size="sm"
        className="gap-2 bg-green-700 text-white hover:bg-green-800"
        onClick={handleDownload}
        disabled={pending || !groupId}
        aria-busy={pending}
      >
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />}
        {pending ? "Preparing sheet…" : "Download Class Result Sheet (PDF)"}
      </Button>
    </div>
  );
}
