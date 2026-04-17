import { useState, useEffect, useRef } from "react";
import { Layout } from "@/components/Layout";
import { useIncomes, useCreateIncome, useDeleteIncome, useBatches, useStudents } from "@/hooks/use-finance";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Search, Filter, Calendar as CalendarIcon, CheckCircle, History as HistoryIcon, MessageCircle, ChevronDown, Check } from "lucide-react";
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
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = students.find((s) => s.id.toString() === value);

  const filtered = students.filter((s) => {
    const q = query.toLowerCase();
    return (
      s.name.toLowerCase().includes(q) ||
      (s.studentCustomId ?? "").toLowerCase().includes(q)
    );
  });

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery("");
    }
  }, [open]);

  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
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

      {open && (
        <div className="absolute z-[200] mt-1 w-full rounded-md border border-border bg-popover shadow-lg">
          <div className="p-2 border-b border-border">
            <Input
              ref={inputRef}
              placeholder="Search name or ID..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="h-8 text-sm"
              onPointerDown={(e) => e.stopPropagation()}
              autoComplete="off"
            />
          </div>
          <div className="max-h-52 overflow-y-auto overscroll-contain">
            {filtered.length === 0 ? (
              <div className="py-6 text-center text-sm text-muted-foreground">
                No students found
              </div>
            ) : (
              filtered.map((student) => (
                <div
                  key={student.id}
                  className="flex items-center gap-2 cursor-pointer select-none px-3 py-2.5 text-sm hover:bg-accent hover:text-accent-foreground active:bg-accent/80"
                  onPointerDown={(e) => {
                    e.preventDefault();
                    onChange(student.id.toString());
                    setOpen(false);
                  }}
                >
                  {value === student.id.toString() && (
                    <Check className="h-3.5 w-3.5 shrink-0 text-primary" />
                  )}
                  <span className={value === student.id.toString() ? "font-medium" : ""}>
                    {student.name}
                    {student.studentCustomId && (
                      <span className="text-muted-foreground ml-1">({student.studentCustomId})</span>
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
  const filteredStudents = (students as any[])?.filter(s => s.batchId === Number(selectedBatchId)) || [];

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

  function onSubmit(values: z.infer<typeof formSchema>) {
    createMutation.mutate(values, {
      onSuccess: () => {
        setOpen(false);
        form.reset();
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

            {/* Class-wise grouped accordion */}
            {isLoading ? (
                <div className="bg-card rounded-2xl border border-border shadow-sm p-12 text-center text-muted-foreground">
                    Loading...
                </div>
            ) : !filteredIncomes || filteredIncomes.length === 0 ? (
                <div className="bg-card rounded-2xl border border-border shadow-sm p-12 text-center text-muted-foreground">
                    No records found.
                </div>
            ) : (() => {
                // Group by batchId, preserving insertion order
                const groups: Record<number, { batchName: string; records: IncomeWithRelations[] }> = {};
                filteredIncomes.forEach((inc: any) => {
                    const bId = inc.batchId as number;
                    if (!groups[bId]) groups[bId] = { batchName: inc.batch?.name ?? `Batch ${bId}`, records: [] };
                    groups[bId].records.push(inc);
                });
                const groupEntries = Object.entries(groups);
                const defaultOpen = groupEntries.map(([id]) => id);
                return (
                    <Accordion type="multiple" defaultValue={defaultOpen} className="space-y-3">
                        {groupEntries.map(([batchId, { batchName, records }]) => (
                            <AccordionItem
                                key={batchId}
                                value={batchId}
                                className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden"
                            >
                                <AccordionTrigger className="px-5 py-4 hover:no-underline hover:bg-muted/30 [&[data-state=open]]:bg-muted/20">
                                    <div className="flex items-center gap-3">
                                        <span className="font-bold text-base text-foreground">{batchName}</span>
                                        <Badge variant="secondary" className="text-xs font-semibold">
                                            {records.length} record{records.length !== 1 ? "s" : ""}
                                        </Badge>
                                    </div>
                                </AccordionTrigger>
                                <AccordionContent className="p-0">
                                    <Table>
                                        <TableHeader>
                                            <TableRow className="hover:bg-transparent">
                                                <TableHead>Student Name</TableHead>
                                                <TableHead>Batch</TableHead>
                                                <TableHead>Month</TableHead>
                                                {isAdmin && <TableHead>Added By</TableHead>}
                                                <TableHead>Date</TableHead>
                                                <TableHead className="text-right">Amount</TableHead>
                                                <TableHead className="w-[90px]"></TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {records.map((inc: any) => (
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
                                                    <TableCell className="font-medium">
                                                        <div className="flex items-center gap-2">
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
                                                    <TableCell>
                                                        <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-medium">
                                                            {inc.batch?.name}
                                                        </span>
                                                    </TableCell>
                                                    <TableCell>{inc.month}</TableCell>
                                                    {isAdmin && <TableCell>{inc.addedBy || "N/A"}</TableCell>}
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
                        ))}
                    </Accordion>
                );
            })()}
        </div>
    </Layout>
  );
}
