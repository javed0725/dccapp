import { useMemo, useState } from "react";
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
import {
  ArrowLeft,
  BookOpen,
  CalendarDays,
  CircleAlert,
  GraduationCap,
  Phone,
  RefreshCw,
  Wallet,
} from "lucide-react";

type StudentProfileData = {
  student: {
    id: number;
    studentCustomId: string | null;
    name: string;
    batchId: number;
    batchName: string | null;
    mobileNumber: string | null;
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
  const overallGpa = calculateStudentGpa(profile?.results ?? []);
  const annualPaid = monthlyPayments.reduce((sum, item) => sum + (item.payment ? Number(item.payment.amount) || 0 : 0), 0);
  const paidMonths = monthlyPayments.filter((item) => item.payment).length;

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
          </>
        )}
      </div>
    </Layout>
  );
}
