import { useState, useEffect, useRef, useCallback } from "react";
import { saveForOffline } from "@/hooks/use-offline-sync";
import { Layout } from "@/components/Layout";
import { useIncomes, useCreateIncome, useDeleteIncome, useBatches, useStudents } from "@/hooks/use-finance";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Search, Filter, Calendar as CalendarIcon, CheckCircle, History as HistoryIcon, MessageCircle, ChevronDown, Check, Banknote } from "lucide-react";
import { buildPaymentWhatsAppUrl } from "@/lib/whatsapp";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { insertIncomeSchema, type Income as IncomeType, type Batch, type Student } from "@/lib/schemas";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

function StudentCombobox({
  students,
  value,
  onChange,
  disabled,
}: {
  students: any[];
  value: string;
  onChange: (val: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = students.find((s) => s.id.toString() === value);
  const filtered = students.filter((s) => {
    const q = query.toLowerCase();
    return (
      s.name.toLowerCase().includes(q) ||
      (s.studentCustomId ?? "").toLowerCase().includes(q)
    );
  });

  const openMenu = useCallback(() => {
    setOpen(true);
    setTimeout(() => inputRef.current?.focus(), 30);
  }, []);

  const closeMenu = useCallback(() => {
    setOpen(false);
    setQuery("");
  }, []);

  const pickStudent = useCallback(
    (id: string) => {
      onChange(id);
      closeMenu();
    },
    [onChange, closeMenu],
  );

  /* Close on outside click/tap */
  useEffect(() => {
    if (!open) return;
    function handleOutsideMouse(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        closeMenu();
      }
    }
    function handleOutsideTouch(e: TouchEvent) {
      const touch = e.changedTouches[0];
      const target = document.elementFromPoint(touch.clientX, touch.clientY);
      if (wrapperRef.current && target && !wrapperRef.current.contains(target)) {
        closeMenu();
      }
    }
    document.addEventListener("mousedown", handleOutsideMouse);
    document.addEventListener("touchend", handleOutsideTouch, { passive: true });
    return () => {
      document.removeEventListener("mousedown", handleOutsideMouse);
      document.removeEventListener("touchend", handleOutsideTouch);
    };
  }, [open, closeMenu]);

  return (
    <div ref={wrapperRef} className="w-full">
      {/* Trigger button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => (open ? closeMenu() : openMenu())}
        className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        data-testid="button-student-select"
      >
        <span className={selected ? "text-foreground" : "text-muted-foreground"}>
          {selected
            ? `${selected.name} (${selected.studentCustomId ?? "—"})`
            : disabled
            ? "Select batch first"
            : "Select a student"}
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
      </button>

      {/*
        Inline dropdown — NOT absolutely positioned.
        Renders in normal flow so the Dialog's own scroll accommodates it.
        This avoids overflow-hidden clipping and portal event-capture bugs.
      */}
      {open && (
        <div className="mt-1 rounded-md border border-border bg-popover shadow-2xl">
          {/* Search input */}
          <div className="p-2 border-b border-border">
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name or ID..."
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              data-testid="input-student-search"
              className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          {/* Scrollable list — touch-action pan-y lets the browser handle native scroll on mobile */}
          <div
            className="max-h-48 overflow-y-auto overscroll-contain"
            style={{ touchAction: "pan-y" }}
          >
            {filtered.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No students found
              </p>
            ) : (
              filtered.map((s) => (
                <div
                  key={s.id}
                  data-testid={`item-student-${s.id}`}
                  className="flex items-center gap-2 px-3 py-3 text-sm cursor-pointer select-none hover:bg-accent active:bg-accent/80"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pickStudent(s.id.toString())}
                >
                  {value === s.id.toString() && (
                    <Check className="h-3.5 w-3.5 shrink-0 text-primary" />
                  )}
                  <span className={value === s.id.toString() ? "font-medium" : ""}>
                    {s.name}
                    {s.studentCustomId && (
                      <span className="text-muted-foreground ml-1">
                        ({s.studentCustomId})
                      </span>
                    )}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const formSchema = insertIncomeSchema.extend({
  amount: z.coerce.number().min(1, "Amount must be greater than 0"),
  batchId: z.coerce.number().min(1, "Select a batch"),
  studentId: z.coerce.number().min(1, "Select a student"),
});

type IncomeWithRelations = IncomeType & {
  student?: Student;
  batch?: Batch;
  addedBy?: string;
};

export default function Income() {
  const { data: user } = useQuery<any>({ queryKey: ["/api/user"] });
  const [open, setOpen] = useState(false);
  const { data: incomes, isLoading } = useIncomes();
  const { data: batches } = useBatches();
  const { data: students } = useStudents();
  
  const createMutation = useCreateIncome();
  const deleteMutation = useDeleteIncome();
  const { toast } = useToast();
  const [search, setSearch] = useState("");

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      studentId: 0,
      batchId: 0,
      month: MONTHS[new Date().getMonth()],
      amount: 0,
    },
  });

  const selectedBatchId = form.watch("batchId");
  const selectedStudentId = form.watch("studentId");
  const filteredStudents = ((students as any[])?.filter(s => s.batchId === Number(selectedBatchId) && s.isActive !== false) || []).sort((a: any, b: any) => parseInt(a.studentCustomId || '0') - parseInt(b.studentCustomId || '0'));

  /* Fetch the last payment amount for the selected student from the server */
  const { data: lastPayment } = useQuery<{ amount: number } | null>({
    queryKey: ["/api/students", Number(selectedStudentId), "last-payment"],
    enabled: Number(selectedStudentId) > 0,
  });

  /* Auto-fill amount whenever a student is picked or their last-payment data arrives */
  useEffect(() => {
    if (Number(selectedStudentId) === 0) return;
    if (lastPayment && lastPayment.amount !== undefined) {
      form.setValue("amount", Number(lastPayment.amount));
    } else if (lastPayment === null) {
      form.setValue("amount", 0);
    }
  }, [lastPayment, selectedStudentId]);

  const verifyMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("PATCH", `/api/incomes/${id}/status`, { status: "Verified" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/incomes"] });
      toast({
        title: "Payment Verified",
        description: "The payment has been marked as verified.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Verification Failed",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  useEffect(() => {
    form.setValue("studentId", 0);
  }, [selectedBatchId, form]);

  async function onSubmit(values: z.infer<typeof formSchema>) {
    if (!navigator.onLine) {
      await saveForOffline({
        type: "payment",
        url: "/api/incomes",
        method: "POST",
        payload: values,
        label: `Payment — Student ${values.studentId} (${values.month})`,
      });
      setOpen(false);
      form.reset();
      toast({
        title: "Saved offline",
        description: "Payment will sync automatically when you're back online.",
      });
      return;
    }

    createMutation.mutate(values, {
      onSuccess: () => {
        setOpen(false);
        form.reset();
        queryClient.invalidateQueries({ queryKey: ["/api/collections/me"] });
        toast({
          title: "Payment added",
          description: "Payment recorded successfully",
        });
      },
      onError: (error: any) => {
        toast({
          variant: "destructive",
          title: "Error",
          description: error.message,
        });
      },
    });
  }

  function handleDelete(id: number) {
    if (confirm("Are you sure you want to delete this record?")) {
        deleteMutation.mutate(id, {
            onSuccess: () => {
                queryClient.invalidateQueries({ queryKey: ["/api/collections/me"] });
                queryClient.invalidateQueries({ queryKey: ["/api/collections"] });
                toast({ title: "Record deleted" });
            }
        });
    }
  }

  const filteredIncomes = (incomes as IncomeWithRelations[])?.filter(inc => 
    inc.student?.name.toLowerCase().includes(search.toLowerCase()) || 
    inc.batch?.name.toLowerCase().includes(search.toLowerCase())
  );

  const isAdmin = user?.role === "admin";
  const isTeacher = user?.role === "teacher";

  const [showDetails, setShowDetails] = useState(false);

  const { data: myCollection, refetch: refetchMyCollection } = useQuery<{ runningCollection: number; lastResetAt: string | null }>({
    queryKey: ["/api/collections/me"],
    enabled: isTeacher,
  });

  type CollectionDetail = { id: number; studentName: string; month: string; amount: number; date: string };
  const { data: collectionDetails } = useQuery<CollectionDetail[]>({
    queryKey: ["/api/collections/me/details"],
    enabled: isTeacher && showDetails,
  });

  if (user?.role === "student") {
    return (
      <Layout title="Payments" subtitle="View your payment history">
        <div className="flex flex-col items-center justify-center min-h-[400px] text-center p-8 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
          <div className="p-4 bg-indigo-100 text-indigo-600 rounded-full mb-4">
            <HistoryIcon className="w-10 h-10" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900">Personal History Only</h2>
          <p className="text-slate-500 max-w-md mt-2">
            Students can only view their own payment history from the Dashboard. You do not have permission to record or manage payments.
          </p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout 
        title="Payment Records" 
        subtitle="Manage tuition payments and income sources"
        action={
            isTeacher && (
                <Dialog open={open} onOpenChange={setOpen}>
                    <DialogTrigger asChild>
                        <Button className="shadow-lg hover:shadow-xl transition-all">
                            <Plus className="w-4 h-4 mr-2" /> Add Payment
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[425px]">
                        <DialogHeader>
                            <DialogTitle>Add New Payment</DialogTitle>
                            <DialogDescription>
                                Record a tuition payment from a student.
                            </DialogDescription>
                        </DialogHeader>
                        <Form {...form}>
                            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
                                <FormField
                                    control={form.control}
                                    name="batchId"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Batch</FormLabel>
                                            <Select onValueChange={field.onChange} value={field.value?.toString()}>
                                                <FormControl>
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="Select a batch" />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    {(batches as any[])?.map((batch) => (
                                                        <SelectItem key={batch.id} value={batch.id.toString()}>{batch.name}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="studentId"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Student</FormLabel>
                                            <FormControl>
                                                <StudentCombobox
                                                    students={filteredStudents}
                                                    value={field.value?.toString() ?? ""}
                                                    onChange={field.onChange}
                                                    disabled={!selectedBatchId}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="month"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Month</FormLabel>
                                            <Select onValueChange={field.onChange} value={field.value}>
                                                <FormControl>
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="Select a month" />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    {MONTHS.map((month) => (
                                                        <SelectItem key={month} value={month}>{month}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="amount"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Amount (৳)</FormLabel>
                                            <FormControl>
                                                <Input type="number" placeholder="0.00" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <div className="flex flex-col gap-1 text-xs text-muted-foreground bg-muted/30 p-2 rounded">
                                    <div className="flex items-center gap-2">
                                        <Plus className="w-3 h-3" />
                                        <span>Recorded by: {user?.username}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <CalendarIcon className="w-3 h-3" />
                                        <span>Recorded date will be set to: {format(new Date(), "PPpp")}</span>
                                    </div>
                                </div>
                                <Button type="submit" className="w-full" disabled={createMutation.isPending}>
                                    {createMutation.isPending ? "Adding..." : "Add Record"}
                                </Button>
                            </form>
                        </Form>
                    </DialogContent>
                </Dialog>
            )
        }
    >
        <div className="space-y-4">
            {/* Teacher Collection Box */}
            {isTeacher && (
              <div className="rounded-2xl border border-blue-200 bg-gradient-to-r from-blue-600 to-blue-500 shadow-lg overflow-hidden"
                data-testid="box-my-collection"
              >
                {/* Main row */}
                <div className="p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                      <Banknote className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <p className="text-blue-100 text-sm font-medium">My Current Collection</p>
                      <p className="text-white text-3xl font-black tracking-tight" data-testid="text-my-collection-amount">
                        ৳{(myCollection?.runningCollection ?? 0).toLocaleString()}
                      </p>
                      {myCollection?.lastResetAt && (
                        <p className="text-blue-200 text-xs mt-0.5">
                          Last cleared: {format(new Date(myCollection.lastResetAt), "dd MMM yyyy, hh:mm a")}
                        </p>
                      )}
                      {/* View Details toggle */}
                      <button
                        onClick={() => setShowDetails((v) => !v)}
                        className="mt-2 flex items-center gap-1 text-blue-100 hover:text-white text-xs font-semibold transition-colors"
                        data-testid="button-toggle-collection-details"
                      >
                        <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${showDetails ? "rotate-180" : ""}`} />
                        {showDetails ? "Hide Details" : "View Details"}
                      </button>
                    </div>
                  </div>
                  <p className="text-blue-100 text-xs text-center sm:text-right max-w-xs leading-relaxed">
                    Cash collected since last hand-over. Authority will reset this when you submit.
                  </p>
                </div>

                {/* Expandable detail list */}
                {showDetails && (
                  <div className="border-t border-blue-400/40 bg-blue-700/30 px-5 py-3 max-h-64 overflow-y-auto">
                    {!collectionDetails ? (
                      <p className="text-blue-200 text-xs text-center py-3">Loading...</p>
                    ) : collectionDetails.length === 0 ? (
                      <p className="text-blue-200 text-xs text-center py-3">No payments in current collection.</p>
                    ) : (
                      <ul className="space-y-1.5">
                        {collectionDetails.map((item) => (
                          <li key={item.id} className="flex items-center justify-between gap-3 text-xs">
                            <div className="flex items-center gap-2 min-w-0">
                              <div className="w-1.5 h-1.5 rounded-full bg-blue-300 shrink-0" />
                              <span className="text-white font-medium truncate">{item.studentName}</span>
                              <span className="text-blue-200 shrink-0">({item.month})</span>
                            </div>
                            <span className="text-emerald-300 font-bold shrink-0">+৳{item.amount.toLocaleString()}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                    <p className="text-blue-300 text-[10px] text-right mt-2">
                      {collectionDetails?.length ?? 0} payment{(collectionDetails?.length ?? 0) !== 1 ? "s" : ""} recorded
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Search bar */}
            <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
                <div className="p-4 flex flex-col sm:flex-row gap-4 justify-between items-center bg-muted/20">
                    <div className="relative w-full sm:w-72">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                            placeholder="Search student or batch..."
                            className="pl-9 bg-background"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Filter className="w-4 h-4" />
                        <span>{filteredIncomes?.length || 0} records found</span>
                    </div>
                </div>
            </div>

            {/* Class → Month double-nested accordion */}
            {isLoading ? (
                <div className="bg-card rounded-2xl border border-border shadow-sm p-12 text-center text-muted-foreground">
                    Loading...
                </div>
            ) : !filteredIncomes || filteredIncomes.length === 0 ? (
                <div className="bg-card rounded-2xl border border-border shadow-sm p-12 text-center text-muted-foreground">
                    No records found.
                </div>
            ) : (() => {
                // ── Level 1: group by batch ──────────────────────────────
                const batchGroups: Record<number, { batchName: string; records: IncomeWithRelations[] }> = {};
                filteredIncomes.forEach((inc: any) => {
                    const bId = inc.batchId as number;
                    if (!batchGroups[bId]) batchGroups[bId] = { batchName: inc.batch?.name ?? `Batch ${bId}`, records: [] };
                    batchGroups[bId].records.push(inc);
                });
                const batchEntries = Object.entries(batchGroups).sort(([, a], [, b]) =>
                    a.batchName.localeCompare(b.batchName)
                );

                return (
                    <Accordion type="multiple" className="space-y-3">
                        {batchEntries.map(([batchId, { batchName, records }]) => {
                            const batchTotal = records.reduce((s: number, r: any) => s + Number(r.amount), 0);

                            // ── Level 2: group by month inside this batch ──
                            const monthGroups: Record<string, IncomeWithRelations[]> = {};
                            records.forEach((inc: any) => {
                                const m = inc.month as string;
                                if (!monthGroups[m]) monthGroups[m] = [];
                                monthGroups[m].push(inc);
                            });
                            const monthEntries = Object.entries(monthGroups).sort(
                                ([a], [b]) => MONTHS.indexOf(b) - MONTHS.indexOf(a)
                            );

                            return (
                                <AccordionItem
                                    key={batchId}
                                    value={batchId}
                                    className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden"
                                >
                                    {/* ── Class header ── */}
                                    <AccordionTrigger className="px-5 py-4 hover:no-underline hover:bg-muted/30 [&[data-state=open]]:bg-muted/20">
                                        <div className="flex items-center gap-3 flex-wrap">
                                            <span className="font-bold text-base text-foreground">{batchName}</span>
                                            <Badge variant="secondary" className="text-xs font-semibold">
                                                {records.length} record{records.length !== 1 ? "s" : ""}
                                            </Badge>
                                            <span className="text-sm font-semibold text-emerald-600 ml-1">
                                                ৳{batchTotal.toLocaleString()}
                                            </span>
                                        </div>
                                    </AccordionTrigger>

                                    <AccordionContent className="p-0">
                                        {/* ── Month-level nested accordion ── */}
                                        <Accordion type="multiple" defaultValue={monthEntries.length > 0 ? [`${batchId}-${monthEntries[0][0]}`] : []} className="divide-y divide-border">
                                            {monthEntries.map(([month, monthRecords]) => {
                                                const monthTotal = monthRecords.reduce((s: number, r: any) => s + Number(r.amount), 0);
                                                return (
                                                    <AccordionItem
                                                        key={month}
                                                        value={`${batchId}-${month}`}
                                                        className="border-0"
                                                    >
                                                        {/* ── Month header ── */}
                                                        <AccordionTrigger className="px-6 py-3 hover:no-underline hover:bg-muted/20 [&[data-state=open]]:bg-muted/10 text-sm">
                                                            <div className="flex items-center gap-3 flex-wrap">
                                                                <span className="font-semibold text-foreground">{month}</span>
                                                                <Badge variant="outline" className="text-xs">
                                                                    {monthRecords.length} student{monthRecords.length !== 1 ? "s" : ""}
                                                                </Badge>
                                                                <span className="text-xs font-medium text-emerald-600">
                                                                    ৳{monthTotal.toLocaleString()}
                                                                </span>
                                                            </div>
                                                        </AccordionTrigger>

                                                        <AccordionContent className="p-0">
                                                            <Table>
                                                                <TableHeader>
                                                                    <TableRow className="hover:bg-transparent bg-muted/10">
                                                                        <TableHead className="pl-6">Student</TableHead>
                                                                        {isAdmin && <TableHead>Added By</TableHead>}
                                                                        <TableHead>Date</TableHead>
                                                                        <TableHead className="text-right">Amount</TableHead>
                                                                        <TableHead className="w-[90px]"></TableHead>
                                                                    </TableRow>
                                                                </TableHeader>
                                                                <TableBody>
                                                                    {monthRecords.map((inc: any) => (
                                                                        <TableRow
                                                                            key={inc.id}
                                                                            className={`group transition-colors ${
                                                                                inc.status === 'Pending'
                                                                                    ? 'bg-amber-500/5 hover:bg-amber-500/10'
                                                                                    : inc.status === 'Verified'
                                                                                    ? 'bg-emerald-500/5 hover:bg-emerald-500/10'
                                                                                    : 'hover:bg-muted/30'
                                                                            }`}
                                                                        >
                                                                            <TableCell className="font-medium pl-6">
                                                                                <div className="flex items-center gap-2 flex-wrap">
                                                                                    {inc.student?.name}
                                                                                    {inc.status === 'Pending' && (
                                                                                        <span className="text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">Pending</span>
                                                                                    )}
                                                                                    {inc.status === 'Verified' && (
                                                                                        <span className="text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                                                                                            <CheckCircle className="w-2.5 h-2.5" />
                                                                                            Verified
                                                                                        </span>
                                                                                    )}
                                                                                </div>
                                                                            </TableCell>
                                                                            {isAdmin && <TableCell className="text-muted-foreground text-sm">{inc.addedBy || "N/A"}</TableCell>}
                                                                            <TableCell className="text-muted-foreground text-sm">{format(new Date(inc.date), "MMM d, y")}</TableCell>
                                                                            <TableCell className="text-right font-medium text-emerald-600">
                                                                                <div className="flex items-center justify-end gap-3">
                                                                                    +৳{inc.amount.toLocaleString()}
                                                                                    {isAdmin && inc.status === 'Pending' && (
                                                                                        <Button
                                                                                            size="sm"
                                                                                            variant="outline"
                                                                                            className="h-7 text-[10px] bg-indigo-600 text-white border-indigo-600 hover:bg-indigo-700 hover:text-white"
                                                                                            onClick={() => verifyMutation.mutate(inc.id)}
                                                                                            disabled={verifyMutation.isPending}
                                                                                        >
                                                                                            {verifyMutation.isPending ? "..." : "Verify"}
                                                                                        </Button>
                                                                                    )}
                                                                                </div>
                                                                            </TableCell>
                                                                            <TableCell>
                                                                                <div className="flex items-center gap-1 justify-end opacity-0 group-hover:opacity-100">
                                                                                    {isAdmin && inc.student?.mobileNumber && (() => {
                                                                                        const url = buildPaymentWhatsAppUrl(
                                                                                            inc.student.mobileNumber,
                                                                                            inc.amount,
                                                                                            inc.student.name,
                                                                                            inc.month
                                                                                        );
                                                                                        return url ? (
                                                                                            <a href={url} target="_blank" rel="noopener noreferrer">
                                                                                                <Button variant="ghost" size="icon" className="text-[#25D366] hover:bg-[#25D366]/10 hover:text-[#25D366]">
                                                                                                    <MessageCircle className="w-4 h-4" />
                                                                                                </Button>
                                                                                            </a>
                                                                                        ) : null;
                                                                                    })()}
                                                                                    <Button
                                                                                        variant="ghost"
                                                                                        size="icon"
                                                                                        className="text-destructive"
                                                                                        onClick={() => handleDelete(inc.id)}
                                                                                    >
                                                                                        <Trash2 className="w-4 h-4" />
                                                                                    </Button>
                                                                                </div>
                                                                            </TableCell>
                                                                        </TableRow>
                                                                    ))}
                                                                </TableBody>
                                                            </Table>
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
                );
            })()}
        </div>
    </Layout>
  );
}
