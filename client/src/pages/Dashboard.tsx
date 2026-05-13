import { Layout } from "@/components/Layout";
import { useIncomes, useExpenses, useDeposits, useBatches, useStudents } from "@/hooks/use-finance";
import { Users, History, CheckCircle2, Clock, Wallet, TrendingUp, CreditCard, BarChart3, GraduationCap, BookOpen, UserCircle2, Download } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useQuery } from "@tanstack/react-query";
import { type User } from "@/lib/schemas";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_FULL = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export default function Dashboard() {
  
  const { data: user } = useQuery<User>({ 
    queryKey: ["/api/user"],
    retry: false
  });

  const isAdmin = user?.role === "admin";
  const isTeacher = user?.role === "teacher";
  const isStudent = user?.role === "student";

  // All data queries — enabled only once the user is confirmed, so nothing
  // fires during the auth-loading state and there is no double-fetch on mount.
  const { data: teachers, isLoading: loadingTeachers } = useQuery<User[]>({ 
    queryKey: ["/api/admin/teachers"],
    enabled: isAdmin,
  });
  
  const { data: incomes, isLoading: loadingIncomes } = useIncomes();
  const { data: expenses, isLoading: loadingExpenses } = useExpenses();
  const { data: deposits, isLoading: loadingDeposits } = useDeposits();
  const { data: batches, isLoading: loadingBatches } = useBatches();
  const { data: students, isLoading: loadingStudents } = useStudents();
  
  const { data: results, isLoading: loadingResults } = useQuery<any[]>({
    queryKey: ["/api/results"],
    enabled: isStudent,
  });

  if (!user || loadingIncomes || loadingExpenses || loadingDeposits || loadingBatches || loadingStudents || loadingResults || (isAdmin && loadingTeachers)) {
    return <DashboardSkeleton />;
  }

  if (isStudent) {
    const historyIncomes = incomes || [];
    const studentProfile = (students as any[])?.find(s => s.userId === user?.id);
    const studentBatch = batches?.find(b => b.id === studentProfile?.batchId);
    const batchLabel = studentBatch ? studentBatch.name : null;

    return (
      <Layout 
        title="Student Dashboard" 
        subtitle="Track your payments and account status"
      >
        <div className="space-y-6">

          {/* ── Student Profile Card ── */}
          <Card className="border-none bg-white shadow-[0_2px_15px_-3px_rgba(0,0,0,0.07),0_10px_20px_-2px_rgba(0,0,0,0.04)] rounded-2xl overflow-hidden">
            <CardContent className="p-0">
              <div className="flex items-center gap-5 px-6 py-5">
                {/* Avatar circle */}
                <div className="shrink-0 w-16 h-16 rounded-full bg-gradient-to-br from-indigo-500 to-blue-400 flex items-center justify-center shadow-md">
                  <UserCircle2 className="w-9 h-9 text-white" />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <h2 className="text-xl font-extrabold text-[#1E293B] leading-tight truncate">
                    {studentProfile?.name ?? user?.username ?? "Student"}
                  </h2>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5">
                    {studentProfile?.studentCustomId && (
                      <span className="text-xs font-semibold text-indigo-600 bg-indigo-50 px-2.5 py-0.5 rounded-full">
                        ID: {studentProfile.studentCustomId}
                      </span>
                    )}
                    {batchLabel && (
                      <span className="text-xs font-semibold text-slate-600 bg-slate-100 px-2.5 py-0.5 rounded-full">
                        {batchLabel}
                      </span>
                    )}
                    {studentProfile?.shift && (
                      <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-full">
                        {studentProfile.shift} Shift
                      </span>
                    )}
                    {studentProfile?.academicGroup && (
                      <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full">
                        {studentProfile.academicGroup}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-slate-500 mt-2">
                    📞 Mobile: <span className="font-semibold text-slate-700">{studentProfile?.mobileNumber ?? "Not Provided"}</span>
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-none bg-white shadow-[0_2px_15px_-3px_rgba(0,0,0,0.07),0_10px_20px_-2px_rgba(0,0,0,0.04)] rounded-2xl overflow-hidden">
            <CardHeader className="bg-white border-b border-[#F1F5F9] py-8 px-8">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-[#F8FAFC] text-[#94A3B8] border border-[#F1F5F9]">
                  <History className="w-6 h-6" />
                </div>
                <div>
                  <CardTitle className="text-2xl text-[#1E293B] font-extrabold tracking-tight">My Payment History</CardTitle>
                  <p className="text-sm font-medium text-[#64748B] mt-1">Overview of all tuition payments recorded</p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-[#F8FAFC] border-none">
                      <TableHead className="py-5 px-8 font-bold text-[#64748B] uppercase text-[11px] tracking-[0.2em]">Month</TableHead>
                      <TableHead className="py-5 px-8 font-bold text-[#64748B] uppercase text-[11px] tracking-[0.2em]">Amount</TableHead>
                      <TableHead className="py-5 px-8 font-bold text-[#64748B] uppercase text-[11px] tracking-[0.2em]">Payment Date</TableHead>
                      <TableHead className="py-5 px-8 font-bold text-[#64748B] uppercase text-[11px] tracking-[0.2em]">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {MONTHS_FULL.map((month) => {
                      const payment = historyIncomes.find(inc => inc.month === month);
                      return (
                        <TableRow key={month} className="hover:bg-[#F8FAFC]/50 border-[#F1F5F9] transition-colors group">
                          <TableCell className="py-6 px-8 font-bold text-[#1E293B] group-hover:text-[#4F46E5] transition-colors">{month}</TableCell>
                          <TableCell className="py-6 px-8 text-[#1E293B]">
                            {payment ? <span className="font-black text-lg">৳{payment.amount.toLocaleString()}</span> : <span className="text-[#CBD5E1] font-bold">-</span>}
                          </TableCell>
                          <TableCell className="py-6 px-8 text-[#64748B] font-bold">
                            {payment ? format(new Date(payment.date), "dd/MM/yyyy") : "N/A"}
                          </TableCell>
                          <TableCell className="py-6 px-8">
                            {payment ? (
                              <Badge variant="secondary" className={payment.status === "Verified" ? "bg-[#F0FDF4] text-[#16A34A] border-none px-5 py-2 rounded-full font-bold text-[10px] uppercase tracking-widest" : "bg-[#EFF6FF] text-[#2563EB] border-none px-5 py-2 rounded-full font-bold text-[10px] uppercase tracking-widest"}>
                                {payment.status === "Verified" ? "Approved" : "Received"}
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-[#94A3B8] border-[#E2E8F0] bg-[#F8FAFC] font-bold px-5 py-2 rounded-full text-[10px] uppercase tracking-widest">Pending</Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      </Layout>
    );
  }

  // Balance is driven ONLY by teacher collection clearances (deposits).
  // Verified incomes are informational only — they are already captured as a
  // deposit when the admin clears a teacher's collection, so including them
  // here would double-count every payment.
  const totalDepositsAmount = deposits?.reduce((sum, item) => sum + (Number(item.amount) || 0), 0) || 0;
  const totalIncome = totalDepositsAmount;
  const totalExpense = expenses?.reduce((sum, item) => sum + (Number(item.amount) || 0), 0) || 0;
  const balance = totalIncome - totalExpense;

  const batchData = batches?.map(batch => {
    const batchStudents = (students?.filter(s => s.batchId === batch.id && s.isActive !== false) || []).sort((a, b) => parseInt(a.studentCustomId || '0') - parseInt(b.studentCustomId || '0'));
    const batchIncomes = incomes?.filter(inc => inc.batchId === batch.id) || [];
    const studentRows = batchStudents.map(student => {
      const studentPayments = batchIncomes.filter(inc => inc.studentId === student.id);
      const monthlyPayments: Record<string, number> = {};
      studentPayments.forEach(p => { monthlyPayments[p.month] = (monthlyPayments[p.month] || 0) + (Number(p.amount) || 0); });
      return { name: student.name, monthlyPayments };
    });
    return { ...batch, studentRows };
  });

  // Calculate monthly summaries (only for months with income or expenses)
  const monthlyData = MONTHS_FULL.map(month => {
    const allMonthIncomes = incomes?.filter(inc => inc.month === month) || [];
    const verifiedMonthIncomes = allMonthIncomes.filter(inc => inc.status === "Verified");
    const monthExpenses = expenses?.filter(exp => exp.month === month) || [];
    const monthDeposits = (deposits as any[])?.filter(dep => dep.month === month) || [];

    // Balance only from cleared deposits — same principle as global balance above.
    const studentPaymentsTotal = verifiedMonthIncomes.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
    const depositsTotal = monthDeposits.reduce((sum: number, item: any) => sum + (Number(item.amount) || 0), 0);
    const totalIncome = depositsTotal;
    const totalExpense = monthExpenses.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
    const paidStudentsCount = new Set(allMonthIncomes.map(inc => inc.studentId)).size;
    
    return {
      month,
      hasData: depositsTotal > 0 || totalExpense > 0 || studentPaymentsTotal > 0,
      totalIncome,
      totalExpense,
      balance: totalIncome - totalExpense,
      paidStudentsCount
    };
  }).filter(m => m.hasData).reverse();

  const totalStudents = students?.filter(s => s.isActive !== false).length || 0;
  const batchStats = batches?.map(batch => ({
    ...batch,
    studentCount: students?.filter(s => s.batchId === batch.id && s.isActive !== false).length || 0,
  })) || [];

  function downloadBatchPDF(batch: NonNullable<typeof batchData>[number]) {
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

    // Title
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text(`Dynamic Coaching Center — ${batch.name}`, 14, 16);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100);
    doc.text(`Payment Record · Generated ${format(new Date(), "dd MMM yyyy")} · ${batch.studentRows.length} students`, 14, 23);
    doc.setTextColor(0);

    const head = [["#", "Student Name", ...MONTHS_SHORT]];
    const body = batch.studentRows.map((student, idx) => [
      String(idx + 1),
      student.name,
      ...MONTHS_FULL.map(m =>
        student.monthlyPayments[m] ? `${student.monthlyPayments[m].toLocaleString()}` : "—"
      ),
    ]);

    autoTable(doc, {
      startY: 28,
      head,
      body,
      styles: { fontSize: 8, cellPadding: 2.5, lineColor: [220, 220, 220], lineWidth: 0.3 },
      headStyles: { fillColor: [67, 56, 202], textColor: 255, fontStyle: "bold", halign: "center" },
      columnStyles: {
        0: { halign: "center", cellWidth: 8 },
        1: { cellWidth: 42, fontStyle: "bold" },
        ...Object.fromEntries(
          MONTHS_SHORT.map((_, i) => [i + 2, { halign: "center", cellWidth: 18 }])
        ),
      },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      didParseCell(data) {
        if (data.section === "body" && data.column.index >= 2) {
          const val = data.cell.raw as string;
          if (val === "—") {
            data.cell.styles.textColor = [200, 200, 200];
          } else {
            data.cell.styles.textColor = [5, 150, 105];
            data.cell.styles.fontStyle = "bold";
          }
        }
      },
    });

    doc.save(`${batch.name.replace(/\s+/g, "_")}_payments.pdf`);
  }

  return (
    <Layout 
      title={isAdmin ? "Authority Dashboard" : "Teacher Dashboard"} 
      subtitle={isAdmin ? "Manage Coaching Operations" : "Manage your classes and profile"}
    >
      <div className="space-y-10">
        {/* Enrollment Statistics */}
        <div className="pb-4">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-1.5 h-7 bg-indigo-500 rounded-full" />
            <h2 className="text-xl font-bold tracking-tight text-slate-800 dark:text-slate-100">Enrollment Statistics</h2>
          </div>

          {/* Total Enrolled Card — always full width, premium banner */}
          <div className="relative overflow-hidden w-full rounded-2xl bg-gradient-to-br from-indigo-600 via-indigo-700 to-blue-800 px-5 py-4 mb-3 shadow-[0_8px_30px_-6px_rgba(67,56,202,0.5)] flex items-center justify-between">
            {/* Glass shimmer orbs */}
            <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full bg-white/10 blur-2xl pointer-events-none" />
            <div className="absolute bottom-0 left-1/3 w-24 h-24 rounded-full bg-blue-400/10 blur-xl pointer-events-none" />

            <div className="relative z-10">
              <p className="text-indigo-300 text-[10px] font-bold uppercase tracking-[0.18em] mb-1">Total Enrolled</p>
              <p className="text-white text-4xl font-black leading-none tabular-nums">{totalStudents}</p>
              <p className="text-indigo-300/80 text-xs font-medium mt-1.5">
                <span className="text-white font-bold">{batchStats.length}</span> active {batchStats.length === 1 ? "batch" : "batches"}
              </p>
            </div>
            <div className="relative z-10 p-3 bg-white/15 backdrop-blur-sm rounded-xl border border-white/20 shrink-0">
              <GraduationCap className="w-7 h-7 text-white" />
            </div>
          </div>

          {/* Batch-wise compact grid — always below, responsive columns */}
          {batchStats.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
              {batchStats.map((batch) => (
                <div
                  key={batch.id}
                  className="group bg-white dark:bg-slate-900 rounded-xl px-3 py-2.5 border border-slate-100 dark:border-slate-800 shadow-[0_1px_4px_-1px_rgba(0,0,0,0.06)] hover:shadow-[0_4px_14px_-2px_rgba(99,102,241,0.14)] hover:border-indigo-100 dark:hover:border-indigo-900 transition-all duration-200 flex items-center gap-2.5 min-w-0"
                >
                  <div className="p-1.5 bg-indigo-50 dark:bg-indigo-900/30 rounded-lg shrink-0 group-hover:bg-indigo-100 transition-colors">
                    <BookOpen className="w-3.5 h-3.5 text-indigo-500" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium truncate leading-none mb-0.5">{batch.name}</p>
                    <div className="flex items-baseline gap-1">
                      <span className="text-base font-black text-slate-800 dark:text-slate-100 tabular-nums leading-none">{batch.studentCount}</span>
                      <span className="text-[10px] text-slate-400 font-medium">{batch.studentCount === 1 ? "student" : "students"}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center justify-center py-5 text-slate-400 text-sm font-medium bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-dashed border-slate-200 dark:border-slate-700">
              No batches yet. Add from Manage.
            </div>
          )}
        </div>

        {monthlyData.length > 0 && (() => {
          const currentMonthName = MONTHS_FULL[new Date().getMonth()];
          // Open the first (latest) month that has data
          const defaultOpen = monthlyData.length > 0 ? [monthlyData[0].month] : [];
          return (
            <div>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-2 h-8 bg-emerald-500 rounded-full" />
                <h2 className="text-2xl font-bold">Monthly Overview</h2>
              </div>
              <Accordion type="multiple" defaultValue={defaultOpen} className="space-y-3">
                {monthlyData.map(month => {
                  const isCurrentMonth = month.month === currentMonthName;
                  return (
                    <AccordionItem
                      key={month.month}
                      value={month.month}
                      className="border-none bg-white dark:bg-slate-900 shadow-[0_4px_20px_-2px_rgba(0,0,0,0.08)] rounded-2xl overflow-hidden"
                    >
                      <AccordionTrigger className="px-6 py-4 hover:no-underline hover:bg-slate-50 dark:hover:bg-slate-800/50 [&[data-state=open]]:bg-gradient-to-br [&[data-state=open]]:from-slate-50 [&[data-state=open]]:to-slate-100 dark:[&[data-state=open]]:from-slate-900 dark:[&[data-state=open]]:to-slate-800 border-b border-slate-100 dark:border-slate-800 transition-colors duration-200">
                        <div className="flex items-center justify-between w-full pr-3">
                          <div className="flex items-center gap-3">
                            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">{month.month}</h3>
                            {isCurrentMonth && (
                              <span className="text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400 px-2 py-0.5 rounded-full">
                                Current
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-4 text-sm">
                            <span className="text-slate-400 dark:text-slate-500 text-xs hidden sm:inline">
                              ৳{month.totalIncome.toLocaleString()} in · ৳{month.totalExpense.toLocaleString()} out
                            </span>
                            <span className={`font-bold text-sm ${month.balance >= 0 ? 'text-indigo-600 dark:text-indigo-400' : 'text-red-500 dark:text-red-400'}`}>
                              Balance: ৳{month.balance.toLocaleString()}
                            </span>
                          </div>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="p-3">
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                          <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-900/20 dark:to-emerald-800/20 rounded-xl p-3 flex flex-col items-center justify-center text-center border border-emerald-200 dark:border-emerald-800/30">
                            <div className="p-1.5 rounded-lg bg-emerald-500/20 mb-1.5">
                              <Wallet className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                            </div>
                            <p className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 uppercase tracking-wider mb-1">Income</p>
                            <p className="text-sm font-extrabold text-emerald-600 dark:text-emerald-400 w-full text-center">৳{month.totalIncome.toLocaleString()}</p>
                          </div>
                          <div className="bg-gradient-to-br from-rose-50 to-rose-100 dark:from-rose-900/20 dark:to-rose-800/20 rounded-xl p-3 flex flex-col items-center justify-center text-center border border-rose-200 dark:border-rose-800/30">
                            <div className="p-1.5 rounded-lg bg-rose-500/20 mb-1.5">
                              <CreditCard className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                            </div>
                            <p className="text-[10px] font-bold text-rose-700 dark:text-rose-300 uppercase tracking-wider mb-1">Expenses</p>
                            <p className="text-sm font-extrabold text-rose-600 dark:text-rose-400 w-full text-center">৳{month.totalExpense.toLocaleString()}</p>
                          </div>
                          <div className={`bg-gradient-to-br ${month.balance >= 0 ? 'from-indigo-50 to-indigo-100 dark:from-indigo-900/20 dark:to-indigo-800/20 border border-indigo-200 dark:border-indigo-800/30' : 'from-red-50 to-red-100 dark:from-red-900/20 dark:to-red-800/20 border border-red-200 dark:border-red-800/30'} rounded-xl p-3 flex flex-col items-center justify-center text-center`}>
                            <div className={`p-1.5 rounded-lg ${month.balance >= 0 ? 'bg-indigo-500/20' : 'bg-red-500/20'} mb-1.5`}>
                              <BarChart3 className={`w-3.5 h-3.5 ${month.balance >= 0 ? 'text-indigo-600 dark:text-indigo-400' : 'text-red-600 dark:text-red-400'}`} />
                            </div>
                            <p className={`text-[10px] font-bold ${month.balance >= 0 ? 'text-indigo-700 dark:text-indigo-300' : 'text-red-700 dark:text-red-300'} uppercase tracking-wider mb-1`}>Balance</p>
                            <p className={`text-sm font-extrabold ${month.balance >= 0 ? 'text-indigo-600 dark:text-indigo-400' : 'text-red-600 dark:text-red-400'} w-full text-center`}>৳{Math.abs(month.balance).toLocaleString()}</p>
                          </div>
                          <div className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-800/20 rounded-xl p-3 flex flex-col items-center justify-center text-center border border-orange-200 dark:border-orange-800/30">
                            <div className="p-1.5 rounded-lg bg-orange-500/20 mb-1.5">
                              <GraduationCap className="w-3.5 h-3.5 text-orange-600 dark:text-orange-400" />
                            </div>
                            <p className="text-[10px] font-bold text-orange-700 dark:text-orange-300 uppercase tracking-wider mb-1">Paid</p>
                            <p className="text-sm font-extrabold text-orange-600 dark:text-orange-400 w-full text-center">{month.paidStudentsCount}</p>
                          </div>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  );
                })}
              </Accordion>
            </div>
          );
        })()}
        <div className="flex items-center gap-3">
          <div className="w-2 h-8 bg-indigo-500 rounded-full" />
          <h2 className="text-2xl font-bold">Batch Tracking</h2>
        </div>
        {batchData?.map(batch => (
          <Card key={batch.id} className="overflow-hidden border-none shadow-xl shadow-slate-200/50 dark:shadow-none ring-1 ring-slate-200 dark:ring-slate-800">
            <div className="px-6 py-5 bg-slate-50/50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-xl text-slate-900 dark:text-slate-100">{batch.name}</h3>
                <p className="text-sm text-slate-500">{batch.studentRows.length} students enrolled</p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => downloadBatchPDF(batch)}
                className="flex items-center gap-1.5 text-indigo-600 border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700 shrink-0"
                data-testid={`button-download-pdf-${batch.id}`}
              >
                <Download className="w-3.5 h-3.5" />
                PDF
              </Button>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent bg-slate-50/30 dark:bg-slate-900/20">
                    <TableHead className="min-w-[200px] sticky left-0 bg-white dark:bg-slate-950 z-10 font-bold text-slate-900 dark:text-slate-100 py-4">Student Name</TableHead>
                    {MONTHS_SHORT.map(m => <TableHead key={m} className="text-center min-w-[80px] font-semibold text-slate-600 dark:text-slate-400">{m}</TableHead>)}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {batch.studentRows.map((student, idx) => (
                    <TableRow key={`${batch.id}-${student.name}-${idx}`} className="group hover:bg-indigo-50/30 dark:hover:bg-indigo-900/10 transition-colors">
                      <TableCell className="font-semibold sticky left-0 bg-white dark:bg-slate-950 z-10 border-r border-slate-100 dark:border-slate-800 py-4 group-hover:text-indigo-600 transition-colors">{student.name}</TableCell>
                      {MONTHS_FULL.map(m => (
                        <TableCell key={m} className="text-center text-sm border-r border-slate-100 dark:border-slate-800 last:border-r-0">
                          {student.monthlyPayments[m] ? <div className="inline-flex items-center justify-center px-2 py-1 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 rounded-lg font-bold text-xs ring-1 ring-emerald-100 dark:ring-emerald-900/50">৳{student.monthlyPayments[m]}</div> : <span className="text-slate-200 dark:text-slate-800">•</span>}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                  {batch.studentRows.length === 0 && <TableRow><TableCell colSpan={14} className="h-32 text-center text-slate-400 font-medium">No students found in this batch.</TableCell></TableRow>}
                </TableBody>
              </Table>
            </div>
          </Card>
        ))}
      </div>
    </Layout>
  );
}

function SummaryCard({ title, amount, value, icon: Icon, color, bg, size = "md" }: any) {
  const displayValue = amount !== undefined ? `৳${amount.toLocaleString()}` : (value !== undefined ? value.toString() : "0");
  return (
    <Card className="glass-card group hover:-translate-y-1 transition-all duration-300 border-indigo-500/10 bg-[#1e293b] border-slate-800">
      <CardContent className="p-6">
        <div className="flex justify-between items-start">
          <div className="space-y-1">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{title}</p>
            <h2 className={`${size === "lg" ? "text-3xl" : "text-2xl"} font-extrabold text-white`}>{displayValue}</h2>
          </div>
          <div className={`p-3 rounded-2xl ${bg} ${color} group-hover:scale-110 transition-transform duration-300`}><Icon className="w-6 h-6" /></div>
        </div>
      </CardContent>
    </Card>
  );
}

function DashboardSkeleton() {
  return (
    <Layout title="Dashboard" subtitle="Gathering your financial data...">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-10">{[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-32 rounded-2xl w-full" />)}</div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10"><Skeleton className="md:col-span-2 h-48 rounded-2xl" /><Skeleton className="h-48 rounded-2xl" /></div>
      <div className="space-y-8"><Skeleton className="h-[400px] rounded-2xl w-full" /></div>
    </Layout>
  );
}
