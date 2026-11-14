import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "wouter";
import { Layout } from "@/components/Layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  calculateStudentGpa,
  getStudentGrade,
  getStudentMonthIndex,
  groupStudentExamResults,
  STUDENT_PROFILE_MONTHS,
} from "@shared/student-profile";
import { getStudentMarksheetData } from "@shared/student-marksheet";
import { getSubjectMarkingRule } from "@shared/marking";
import {
  ArrowLeft,
  BookOpen,
  CalendarDays,
  CircleAlert,
  GraduationCap,
  Printer,
  Phone,
  RefreshCw,
  Wallet,
} from "lucide-react";

type StudentProfileData = {
  student: {
    id: number;
    studentCustomId: string | null;
    registrationNumber: string | null;
    name: string;
    batchId: number;
    batchName: string | null;
    mobileNumber: string | null;
    school: string | null;
    shift: string | null;
    academicGroup: string | null;
    admissionDate: string | null;
    isActive: boolean;
  };
  payments: Array<{
    id: number;
    month: string;
    amount: number;
    date: string;
    status: string;
    addedBy: string | null;
  }>;
  results: Array<{
    id: number;
    batchId: number;
    batchName: string | null;
    examName: string;
    subject: string;
    totalMarks: number;
    obtainedMarks: number;
    mcqMarks: number | null;
    cqMarks: number | null;
    practicalMarks: number | null;
    markingConfig: {
      totalMarks?: number;
      mcqEnabled?: boolean;
      cqEnabled?: boolean;
      practicalEnabled?: boolean;
      mcqMax?: number;
      cqMax?: number;
      practicalMax?: number;
    } | null;
    isModelTest: boolean;
    modelTestGroupId: string | null;
    date: string | null;
    draftStatus: string | null;
  }>;
};

class ProfileRequestError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function formatAmount(value: number) {
  return `৳${Number(value || 0).toLocaleString("en-BD", { maximumFractionDigits: 2 })}`;
}

function gradeClass(grade: string) {
  if (grade === "A+") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (grade === "A") return "border-green-200 bg-green-50 text-green-800";
  if (grade === "A-") return "border-teal-200 bg-teal-50 text-teal-800";
  if (grade === "B") return "border-sky-200 bg-sky-50 text-sky-800";
  if (grade === "C") return "border-amber-200 bg-amber-50 text-amber-800";
  if (grade === "D") return "border-orange-200 bg-orange-50 text-orange-800";
  return "border-rose-200 bg-rose-50 text-rose-800";
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
      <p className="mt-1 break-words text-sm font-semibold text-foreground">{value || "—"}</p>
    </div>
  );
}

export default function StudentProfile() {
  const params = useParams<{ id: string }>();
  const id = params.id || "";
  const [paymentYear, setPaymentYear] = useState(String(new Date().getFullYear()));
  const [printExamKey, setPrintExamKey] = useState<string | null>(null);

  const profileQuery = useQuery<StudentProfileData>({
    queryKey: ["/api/students", id, "profile"],
    queryFn: async () => {
      const response = await fetch(`/api/students/${encodeURIComponent(id)}/profile`, {
        credentials: "include",
      });
      if (!response.ok) {
        throw new ProfileRequestError(
          response.status,
          response.status === 404 ? "Student profile not found." : "Could not load this student profile.",
        );
      }
      return response.json() as Promise<StudentProfileData>;
    },
    enabled: Boolean(id),
    retry: (failureCount, error) =>
      !(error instanceof ProfileRequestError && error.status === 404) && failureCount < 2,
  });

  const profile = profileQuery.data;
  const student = profile?.student;

  const paymentYears = useMemo(() => {
    const years = new Set<string>([String(new Date().getFullYear())]);
    profile?.payments.forEach((payment) => {
      const date = payment.date ? new Date(payment.date) : null;
      years.add(date && !Number.isNaN(date.getTime()) ? String(date.getFullYear()) : String(new Date().getFullYear()));
    });
    return Array.from(years).sort((a, b) => Number(b) - Number(a));
  }, [profile?.payments]);

  const paymentsForYear = useMemo(() => {
    const targetYear = Number(paymentYear);
    return (profile?.payments ?? []).filter((payment) => {
      const date = payment.date ? new Date(payment.date) : null;
      const year = date && !Number.isNaN(date.getTime()) ? date.getFullYear() : new Date().getFullYear();
      return year === targetYear;
    });
  }, [profile?.payments, paymentYear]);

  const monthlyPayments = useMemo(() => {
    return STUDENT_PROFILE_MONTHS.map((month, monthIndex) => {
      const matches = paymentsForYear
        .filter((payment) => getStudentMonthIndex(payment.month) === monthIndex)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      return { month, payment: matches[0] };
    });
  }, [paymentsForYear]);

  const exams = useMemo(() => groupStudentExamResults(profile?.results ?? []), [profile?.results]);
  const printableExam = exams.find((exam) => exam.key === printExamKey);
  const printableResults = printableExam?.results ?? [];
  const printableData = useMemo(() => getStudentMarksheetData(printableResults), [printableExam]);
  const overallGpa = calculateStudentGpa(profile?.results ?? []);
  const annualPaid = monthlyPayments.reduce((sum, item) => sum + (item.payment ? Number(item.payment.amount) || 0 : 0), 0);
  const paidMonths = monthlyPayments.filter((item) => item.payment).length;

  useEffect(() => {
    if (!printExamKey) return;
    const printTimer = window.setTimeout(() => window.print(), 120);
    const clearSelection = () => setPrintExamKey(null);
    window.addEventListener("afterprint", clearSelection);
    return () => {
      window.clearTimeout(printTimer);
      window.removeEventListener("afterprint", clearSelection);
    };
  }, [printExamKey]);

  const backLink = (
    <Link href="/manage" className="inline-flex min-h-9 items-center gap-2 rounded-md border border-border bg-card px-3 text-sm font-semibold text-foreground transition-colors hover:bg-muted">
      <ArrowLeft className="h-4 w-4" />
      Manage students
    </Link>
  );

  return (
    <Layout title="Student Profile" subtitle="Admissions, payment records, and academic progress">
      <div className="mx-auto max-w-6xl space-y-5 pb-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs font-medium text-muted-foreground">
            <span>Manage Data</span><span className="mx-2 text-border">/</span><span className="text-foreground">Student profile</span>
          </div>
          {backLink}
        </div>

        {profileQuery.isLoading && (
          <div className="space-y-5" aria-label="Loading student profile">
            <Card className="overflow-hidden">
              <div className="h-2 bg-primary/70" />
              <CardContent className="grid gap-6 p-5 sm:grid-cols-3 sm:p-7">
                <div className="space-y-3 sm:col-span-1">
                  <div className="h-7 w-2/3 animate-pulse rounded bg-muted" />
                  <div className="h-4 w-1/2 animate-pulse rounded bg-muted" />
                </div>
                {[0, 1, 2, 3].map((item) => <div key={item} className="h-12 animate-pulse rounded bg-muted/80" />)}
              </CardContent>
            </Card>
            <div className="grid gap-5 lg:grid-cols-2">
              {[0, 1].map((item) => <Card key={item} className="h-72 animate-pulse bg-muted/60" />)}
            </div>
          </div>
        )}

        {profileQuery.isError && (
          <Card className="border-rose-200">
            <CardContent className="flex flex-col items-center px-6 py-12 text-center">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-rose-50 text-rose-700">
                <CircleAlert className="h-6 w-6" />
              </div>
              <h2 className="text-lg font-bold text-foreground">
                {profileQuery.error instanceof ProfileRequestError && profileQuery.error.status === 404
                  ? "Student not found"
                  : "Unable to load student profile"}
              </h2>
              <p className="mt-2 max-w-md text-sm text-muted-foreground">
                {profileQuery.error instanceof ProfileRequestError && profileQuery.error.status === 404
                  ? "This student may have been removed, or the profile link may be out of date."
                  : "The profile could not be retrieved. Check your connection and try again."}
              </p>
              <div className="mt-5 flex flex-wrap justify-center gap-2">
                {profileQuery.error instanceof ProfileRequestError && profileQuery.error.status !== 404 && (
                  <Button variant="outline" onClick={() => profileQuery.refetch()} disabled={profileQuery.isFetching}>
                    <RefreshCw className={`h-4 w-4 ${profileQuery.isFetching ? "animate-spin" : ""}`} />
                    Try again
                  </Button>
                )}
                {backLink}
              </div>
            </CardContent>
          </Card>
        )}

        {student && profile && (
          <>
            <Card className="overflow-hidden border-primary/15">
              <div className="h-1.5 bg-primary" />
              <CardContent className="p-5 sm:p-7">
                <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">{student.name}</h1>
                      <Badge className={student.isActive
                        ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                        : "border-amber-200 bg-amber-50 text-amber-800"}>
                        {student.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Student ID <span className="font-semibold text-foreground">{student.studentCustomId || "Not assigned"}</span>
                    </p>
                    {student.mobileNumber && (
                      <a href={`tel:${student.mobileNumber}`} className="mt-3 inline-flex items-center gap-2 rounded-md px-2 py-1.5 text-sm font-semibold text-primary transition-colors hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                        <Phone className="h-4 w-4" />
                        {student.mobileNumber}
                      </a>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-x-8 gap-y-5 rounded-xl bg-muted/50 p-4 sm:min-w-[330px]">
                    <InfoItem label="Batch / class" value={student.batchName || "—"} />
                    <InfoItem label="Academic group" value={student.academicGroup || "—"} />
                    <InfoItem label="Shift" value={student.shift || "—"} />
                    <InfoItem label="School" value={student.school || "—"} />
                    <InfoItem label="Contact" value={student.mobileNumber || "Not provided"} />
                    <InfoItem label="Admitted" value={formatDate(student.admissionDate)} />
                  </div>
                </div>
                <div className="mt-6 grid gap-3 border-t border-border pt-5 sm:grid-cols-3">
                  <div className="flex items-center gap-3 rounded-lg bg-primary/[0.045] p-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary"><Wallet className="h-4 w-4" /></span>
                    <div><p className="text-xs text-muted-foreground">Payments recorded</p><p className="font-bold">{profile.payments.length} entries</p></div>
                  </div>
                  <div className="flex items-center gap-3 rounded-lg bg-primary/[0.045] p-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary"><BookOpen className="h-4 w-4" /></span>
                    <div><p className="text-xs text-muted-foreground">Exam records</p><p className="font-bold">{exams.length} {exams.length === 1 ? "exam" : "exams"}</p></div>
                  </div>
                  <div className="flex items-center gap-3 rounded-lg bg-primary/[0.045] p-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary"><GraduationCap className="h-4 w-4" /></span>
                    <div><p className="text-xs text-muted-foreground">Overall GPA</p><p className="font-bold">{overallGpa === null ? "—" : `${overallGpa.toFixed(2)} / 5.00`}</p></div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <section aria-labelledby="payments-heading">
              <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <Wallet className="h-5 w-5 text-primary" />
                    <h2 id="payments-heading" className="text-lg font-bold tracking-tight">Payments</h2>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">Monthly status and full collection history</p>
                </div>
                <label className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <CalendarDays className="h-4 w-4" />
                  Year
                  <select
                    value={paymentYear}
                    onChange={(event) => setPaymentYear(event.target.value)}
                    className="h-9 rounded-md border border-input bg-background px-3 font-semibold text-foreground shadow-sm outline-none focus:ring-2 focus:ring-ring"
                    aria-label="Select payment year"
                  >
                    {paymentYears.map((year) => <option key={year} value={year}>{year}</option>)}
                  </select>
                </label>
              </div>

              <div className="mb-4 grid gap-3 sm:grid-cols-3">
                <Card><CardContent className="p-4"><p className="text-xs font-medium text-muted-foreground">Collected in {paymentYear}</p><p className="mt-1 text-xl font-bold">{formatAmount(annualPaid)}</p></CardContent></Card>
                <Card><CardContent className="p-4"><p className="text-xs font-medium text-muted-foreground">Months recorded</p><p className="mt-1 text-xl font-bold">{paidMonths}<span className="ml-1 text-sm font-medium text-muted-foreground">/ 12</span></p></CardContent></Card>
                <Card><CardContent className="p-4"><p className="text-xs font-medium text-muted-foreground">Due months</p><p className="mt-1 text-xl font-bold">{12 - paidMonths}</p></CardContent></Card>
              </div>

              <div className="overflow-x-auto rounded-lg border border-border">
                <Table className="min-w-[600px]">
                  <TableHeader>
                    <TableRow className="bg-muted/50 hover:bg-muted/50">
                      <TableHead>Month</TableHead>
                      <TableHead>Payment date</TableHead>
                      <TableHead className="text-right">Paid amount</TableHead>
                      <TableHead className="text-right">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {monthlyPayments.map(({ month, payment }) => (
                      <TableRow key={month}>
                        <TableCell className="font-semibold">{month}</TableCell>
                        <TableCell className="whitespace-nowrap">{payment ? formatDate(payment.date) : "—"}</TableCell>
                        <TableCell className="text-right font-semibold tabular-nums">
                          {payment ? formatAmount(payment.amount) : "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          {payment ? (
                            <Badge className="border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">Paid</Badge>
                          ) : (
                            <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-800">Due</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </section>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Payment history</CardTitle>
                <CardDescription>Every payment recorded for this student</CardDescription>
              </CardHeader>
              <CardContent>
                {profile.payments.length ? (
                  <div className="overflow-x-auto rounded-lg border border-border">
                    <Table className="min-w-[650px]">
                      <TableHeader>
                        <TableRow className="bg-muted/50 hover:bg-muted/50">
                          <TableHead>Month</TableHead><TableHead>Payment date</TableHead><TableHead>Amount</TableHead><TableHead>Status</TableHead><TableHead>Record status</TableHead><TableHead>Recorded by</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {[...profile.payments].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map((payment) => (
                          <TableRow key={payment.id}>
                            <TableCell className="font-semibold">{payment.month}</TableCell>
                            <TableCell className="whitespace-nowrap">{formatDate(payment.date)}</TableCell>
                            <TableCell className="whitespace-nowrap font-semibold tabular-nums">{formatAmount(payment.amount)}</TableCell>
                            <TableCell><Badge className="border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">Paid</Badge></TableCell>
                            <TableCell><Badge variant="outline" className="capitalize">{payment.status || "Recorded"}</Badge></TableCell>
                            <TableCell>{payment.addedBy || "—"}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed border-border bg-muted/20 px-5 py-8 text-center">
                    <Wallet className="mx-auto h-6 w-6 text-muted-foreground/70" />
                    <p className="mt-2 text-sm font-semibold">No payments recorded</p>
                    <p className="mt-1 text-xs text-muted-foreground">Payment entries will appear here once recorded.</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <section aria-labelledby="results-heading" className="space-y-3">
              <div>
                <div className="flex items-center gap-2">
                  <GraduationCap className="h-5 w-5 text-primary" />
                  <h2 id="results-heading" className="text-lg font-bold tracking-tight">Exam &amp; test history</h2>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">Subject marks, grades, and grade-point averages</p>
              </div>

              {exams.length ? exams.map(({ key, results }, examIndex) => {
                const gradedResults = results.map((result) => ({ result, ...getStudentGrade(result.obtainedMarks, result.totalMarks) }));
                const attending = gradedResults.filter((item) => item.point !== null);
                const examGpa = attending.length
                  ? attending.reduce((sum, item) => sum + (item.point ?? 0), 0) / attending.length
                  : null;
                const totalObtained = attending.reduce((sum, item) => sum + item.result.obtainedMarks, 0);
                const totalMarks = attending.reduce((sum, item) => sum + item.result.totalMarks, 0);
                const exam = results[0];
                return (
                  <details key={key} open={examIndex === 0} className="group overflow-hidden rounded-xl border border-border bg-card shadow-sm">
                    <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-4 px-4 py-4 transition-colors hover:bg-muted/30 sm:px-5 [&::-webkit-details-marker]:hidden">
                      <div className="flex min-w-0 items-start gap-3">
                        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><BookOpen className="h-4 w-4" /></span>
                        <div className="min-w-0">
                          <h3 className="truncate font-bold">{exam.examName || "Assessment"}</h3>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {exam.isModelTest ? "Model test" : "Exam"} · {exam.batchName || student.batchName || "Batch not specified"} · {formatDate(exam.date)}
                            {exam.draftStatus && exam.draftStatus.toLowerCase() !== "published" && (
                              <span className="ml-2 inline-flex rounded border border-amber-200 bg-amber-50 px-1.5 py-0.5 font-semibold text-amber-800">{exam.draftStatus}</span>
                            )}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 pl-12 sm:pl-0">
                        <div className="text-right">
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Exam GPA</p>
                          <p className="font-bold tabular-nums">{examGpa === null ? "—" : `${examGpa.toFixed(2)} / 5.00`}</p>
                        </div>
                        <span className="text-xs font-semibold text-primary transition-transform group-open:rotate-180" aria-hidden="true">⌄</span>
                      </div>
                    </summary>
                    <div className="border-t border-border">
                      <div className="flex flex-wrap items-center justify-between gap-2 bg-muted/20 px-4 py-3 text-xs sm:px-5">
                        <span className="text-muted-foreground">{results.length} {results.length === 1 ? "subject" : "subjects"}{attending.length < results.length ? ` · ${results.length - attending.length} absent` : ""}</span>
                        <span className="font-semibold text-foreground">Total marks: {totalObtained} / {totalMarks}</span>
                      </div>
                      {(!exam.draftStatus || exam.draftStatus.toLowerCase() === "published") && (
                        <div className="flex justify-end px-4 py-3 sm:px-5">
                          <Button
                            type="button"
                            onClick={() => setPrintExamKey(key)}
                            className="gap-2"
                            data-testid={`button-print-marksheet-${examIndex}`}
                          >
                            <Printer className="h-4 w-4" />
                            Print / Download Marksheet
                          </Button>
                        </div>
                      )}
                      <div className="overflow-x-auto">
                        <Table className="min-w-[600px]">
                          <TableHeader>
                            <TableRow className="bg-muted/50 hover:bg-muted/50">
                              <TableHead>Subject</TableHead><TableHead className="text-center">Full marks</TableHead><TableHead className="text-center">Obtained</TableHead><TableHead>Breakdown</TableHead><TableHead className="text-center">Percentage</TableHead><TableHead className="text-center">Grade point</TableHead><TableHead className="text-center">Grade</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {gradedResults.map(({ result, grade, point }) => {
                              const absent = result.obtainedMarks === -1;
                              return (
                                <TableRow key={result.id} className={absent ? "bg-rose-50/60" : ""}>
                                  <TableCell className="font-semibold">{result.subject}</TableCell>
                                  <TableCell className="text-center tabular-nums">{result.totalMarks}</TableCell>
                                  <TableCell className="text-center font-semibold tabular-nums">{absent ? "Absent" : result.obtainedMarks}</TableCell>
                                  <TableCell className="text-xs text-muted-foreground">
                                    {absent ? "—" : [
                                      result.mcqMarks != null && `MCQ ${result.mcqMarks}`,
                                      result.cqMarks != null && `CQ ${result.cqMarks}`,
                                      result.practicalMarks != null && `Practical ${result.practicalMarks}`,
                                    ].filter(Boolean).join(" · ") || "—"}
                                  </TableCell>
                                  <TableCell className="text-center tabular-nums">{absent || result.totalMarks <= 0 ? "—" : `${Math.round((result.obtainedMarks / result.totalMarks) * 100)}%`}</TableCell>
                                  <TableCell className="text-center tabular-nums">{point === null ? "—" : point.toFixed(2)}</TableCell>
                                  <TableCell className="text-center"><Badge className={gradeClass(grade)}>{grade}</Badge></TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  </details>
                );
              }) : (
                <Card>
                  <CardContent className="px-5 py-10 text-center">
                    <GraduationCap className="mx-auto h-7 w-7 text-muted-foreground/70" />
                    <p className="mt-3 text-sm font-semibold">No exam results yet</p>
                    <p className="mt-1 text-xs text-muted-foreground">Recorded subject results will appear here with grades and GPA.</p>
                  </CardContent>
                </Card>
              )}
            </section>

            {printableExam && (
              <article id="student-marksheet-print" aria-label="Printable student marksheet">
                <header className="marksheet-header">
                  <p className="marksheet-kicker">Academic Record</p>
                  <h1>Dynamic Coaching Center</h1>
                  <p className="marksheet-tagline">Come to Learn, Leave to Shine</p>
                  <div className="marksheet-exam">
                    <h2>{printableResults[0]?.examName || "Examination"}</h2>
                    <p>
                      {printableResults[0]?.isModelTest ? "Model Test" : "Examination"}
                      {" · Session "}
                      {printableResults[0]?.date
                        ? new Date(printableResults[0].date).getFullYear()
                        : "—"}
                      {" · "}
                      {formatDate(printableResults[0]?.date)}
                    </p>
                  </div>
                </header>

                <section className="marksheet-student-info" aria-label="Student information">
                  <div><span>Student Name</span><strong>{student.name}</strong></div>
                  <div><span>Student ID</span><strong>{student.id}</strong></div>
                  <div><span>Class</span><strong>{student.batchName || "—"}</strong></div>
                  <div><span>Group</span><strong>{student.academicGroup || "—"}</strong></div>
                  <div><span>Roll / Registration</span><strong>{student.registrationNumber || "—"}</strong></div>
                </section>

                <table className="marksheet-table">
                  <thead>
                    <tr>
                      <th>Subject</th>
                      {printableData.componentColumns.map((component) => (
                        <th key={component}>{component === "cq" ? "CQ" : component === "mcq" ? "MCQ" : "Practical"}</th>
                      ))}
                      <th>Total</th>
                      <th>Grade</th>
                      <th>GP</th>
                    </tr>
                  </thead>
                  <tbody>
                    {printableData.rows.map(({ result, grade, point, isAbsent, components }) => (
                      <tr key={result.subject}>
                        <td>{result.subject}</td>
                        {printableData.componentColumns.map((component) => (
                          <td key={component}>
                            {isAbsent ? "—" : components[component] ?? "—"}
                          </td>
                        ))}
                        <td>{isAbsent ? "Absent" : `${result.obtainedMarks} / ${result.totalMarks}`}</td>
                        <td>{grade}</td>
                        <td>{point === null ? "—" : point.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <section className="marksheet-summary">
                  <div><span>Total Marks</span><strong>{printableData.totalObtained} / {printableData.totalFull}</strong></div>
                  <div><span>GPA</span><strong>{printableData.gpa === null ? "—" : `${printableData.gpa.toFixed(2)} / 5.00`}</strong></div>
                  <div className={printableData.passed ? "marksheet-pass" : "marksheet-fail"}>
                    <span>Final Result</span>
                    <strong>{printableData.passed ? "PASSED" : "FAILED"}</strong>
                  </div>
                </section>

                <footer className="marksheet-signatures">
                  <div><span>Authority / Principal</span></div>
                  <div><span>Class Teacher</span></div>
                </footer>
              </article>
            )}
          </>
        )}
      </div>
      <style>{`
        #student-marksheet-print { display: none; }
        @media print {
          @page { size: A5 landscape; margin: 8mm; }
          html, body, #root { width: 100% !important; min-height: 0 !important; margin: 0 !important; padding: 0 !important; background: #fff !important; }
          body * { visibility: hidden !important; }
          #student-marksheet-print, #student-marksheet-print * { visibility: visible !important; }
          #student-marksheet-print {
            display: block !important;
            position: absolute !important;
            inset: 0 auto auto 0 !important;
            width: 100% !important;
            color: #172033 !important;
            background: #fff !important;
            font-family: Arial, sans-serif !important;
            font-size: 9pt !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .marksheet-header { text-align: center; border-bottom: 2px solid #243b63; padding-bottom: 7px; }
          .marksheet-kicker { margin: 0 0 2px; font-size: 7pt; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; color: #64748b; }
          .marksheet-header h1 { margin: 0; color: #182b4b; font-size: 19pt; line-height: 1.15; }
          .marksheet-tagline { margin: 2px 0 0; color: #64748b; font-size: 7pt; letter-spacing: 1px; }
          .marksheet-exam { margin-top: 7px; }
          .marksheet-exam h2 { margin: 0; font-size: 12pt; color: #243b63; }
          .marksheet-exam p { margin: 2px 0 0; font-size: 8pt; color: #475569; }
          .marksheet-student-info { display: grid; grid-template-columns: 1.5fr 1fr 1fr 1fr 1.4fr; gap: 6px 10px; padding: 9px 0; border-bottom: 1px solid #cbd5e1; }
          .marksheet-student-info div, .marksheet-summary div { min-width: 0; }
          .marksheet-student-info span, .marksheet-summary span { display: block; color: #64748b; font-size: 6.5pt; font-weight: 700; letter-spacing: .4px; text-transform: uppercase; }
          .marksheet-student-info strong { display: block; margin-top: 2px; overflow-wrap: anywhere; font-size: 8pt; }
          .marksheet-table { width: 100%; border-collapse: collapse; margin-top: 9px; table-layout: auto; }
          .marksheet-table th, .marksheet-table td { border: 1px solid #b8c4d5; padding: 4px 6px; text-align: center; font-size: 7.5pt; }
          .marksheet-table th { background: #243b63 !important; color: #fff !important; font-weight: 700; }
          .marksheet-table th:first-child, .marksheet-table td:first-child { text-align: left; }
          .marksheet-table tbody tr:nth-child(even) { background: #f3f6fa !important; }
          .marksheet-summary { display: grid; grid-template-columns: 1fr 1fr 1fr; margin-top: 10px; border: 1px solid #b8c4d5; }
          .marksheet-summary div { padding: 6px 9px; border-right: 1px solid #d5dce6; }
          .marksheet-summary div:last-child { border-right: 0; }
          .marksheet-summary strong { display: block; margin-top: 3px; font-size: 10pt; }
          .marksheet-pass strong { color: #15803d !important; }
          .marksheet-fail strong { color: #b91c1c !important; }
          .marksheet-signatures { display: flex; justify-content: space-between; gap: 30mm; margin-top: 24mm; padding: 0 8mm; }
          .marksheet-signatures div { width: 38%; border-top: 1px solid #334155; text-align: center; padding-top: 4px; }
          .marksheet-signatures span { font-size: 7pt; font-weight: 600; }
        }
      `}</style>
    </Layout>
  );
}
