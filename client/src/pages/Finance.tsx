import { useState } from "react";
import { Layout } from "@/components/Layout";
import { useExpenses, useCreateExpense, useDeleteExpense, useDeposits, useCreateDeposit, useDeleteDeposit } from "@/hooks/use-finance";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Plus, Trash2, Search, Filter, ChevronDown, ChevronUp, Receipt, PiggyBank } from "lucide-react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { insertExpenseSchema, insertDepositSchema } from "@/lib/schemas";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

type Tab = "expenses" | "deposits";

// ── Shared helpers ────────────────────────────────────────────────────────────

function groupByMonth<T extends { month: string }>(items: T[]) {
  const groups: Record<string, T[]> = {};
  for (const item of items) {
    const key = item.month || "Other";
    if (!groups[key]) groups[key] = [];
    groups[key].push(item);
  }
  return Object.entries(groups).sort(([a], [b]) => {
    const ai = MONTHS.indexOf(a);
    const bi = MONTHS.indexOf(b);
    if (ai === -1 && bi === -1) return b.localeCompare(a);
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return bi - ai;
  });
}

// ── Expense month group ───────────────────────────────────────────────────────

type Expense = { id: number; description: string; amount: number; month: string; date: string | Date };

function ExpenseMonthGroup({ month, expenses, onDelete, isPending, defaultOpen = false }: {
  month: string; expenses: Expense[]; onDelete: (id: number) => void; isPending: boolean; defaultOpen?: boolean;
}) {
  const [collapsed, setCollapsed] = useState(!defaultOpen);
  const total = expenses.reduce((sum, e) => sum + e.amount, 0);
  return (
    <div className="border border-border rounded-xl overflow-hidden mb-3">
      <button onClick={() => setCollapsed(!collapsed)} className="w-full flex items-center justify-between px-4 py-3 bg-muted/30 hover:bg-muted/50 transition-colors">
        <div className="flex items-center gap-3">
          {collapsed ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronUp className="w-4 h-4 text-muted-foreground" />}
          <span className="font-bold text-primary text-sm">{month}</span>
          <span className="text-xs text-muted-foreground">({expenses.length} {expenses.length === 1 ? "item" : "items"})</span>
        </div>
        <span className="font-bold text-red-600 text-sm">-৳{total.toLocaleString()}</span>
      </button>
      {!collapsed && (
        <div className="divide-y divide-border/50">
          {expenses.map((expense) => (
            <div key={expense.id} className="group flex items-center gap-3 px-4 py-3 hover:bg-muted/20 transition-colors">
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{expense.description}</p>
                <p className="text-xs text-muted-foreground">{format(new Date(expense.date), "MMM d, yyyy")}</p>
              </div>
              <span className="font-semibold text-red-600 text-sm shrink-0">-৳{expense.amount.toLocaleString()}</span>
              <Button variant="ghost" size="icon" onClick={() => onDelete(expense.id)}
                className="opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive hover:bg-destructive/10 h-7 w-7 shrink-0"
                disabled={isPending}>
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Deposit month group ───────────────────────────────────────────────────────

type Deposit = { id: number; description: string; amount: number; month: string; date: string | Date };

function DepositMonthGroup({ month, deposits, onDelete, isPending, defaultOpen = false }: {
  month: string; deposits: Deposit[]; onDelete: (id: number) => void; isPending: boolean; defaultOpen?: boolean;
}) {
  const [collapsed, setCollapsed] = useState(!defaultOpen);
  const total = deposits.reduce((sum, d) => sum + d.amount, 0);
  return (
    <div className="border border-border rounded-xl overflow-hidden mb-3">
      <button onClick={() => setCollapsed(!collapsed)} className="w-full flex items-center justify-between px-4 py-3 bg-muted/30 hover:bg-muted/50 transition-colors">
        <div className="flex items-center gap-3">
          {collapsed ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronUp className="w-4 h-4 text-muted-foreground" />}
          <span className="font-bold text-primary text-sm">{month}</span>
          <span className="text-xs text-muted-foreground">({deposits.length} {deposits.length === 1 ? "item" : "items"})</span>
        </div>
        <span className="font-bold text-emerald-600 text-sm">+৳{total.toLocaleString()}</span>
      </button>
      {!collapsed && (
        <div className="divide-y divide-border/50">
          {deposits.map((deposit) => (
            <div key={deposit.id} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/20 transition-colors">
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{deposit.description}</p>
                <p className="text-xs text-muted-foreground">{format(new Date(deposit.date), "MMM d, yyyy")}</p>
              </div>
              <span className="font-semibold text-emerald-600 text-sm shrink-0">+৳{deposit.amount.toLocaleString()}</span>
              <Button variant="ghost" size="icon" onClick={() => onDelete(deposit.id)}
                className="text-destructive hover:text-destructive hover:bg-destructive/10 h-7 w-7 shrink-0"
                disabled={isPending} data-testid={`button-delete-deposit-${deposit.id}`}>
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Expense form schema ───────────────────────────────────────────────────────

const expenseFormSchema = insertExpenseSchema.extend({
  amount: z.coerce.number().min(1, "Amount must be greater than 0"),
  month: z.string().min(1, "Please select a month"),
});

const depositFormSchema = insertDepositSchema.extend({
  amount: z.coerce.number().min(1, "Amount must be greater than 0"),
  month: z.string().min(1, "Please select a month"),
});

// ── Main Finance page ─────────────────────────────────────────────────────────

export default function Finance() {
  const [activeTab, setActiveTab] = useState<Tab>("expenses");
  const [expenseOpen, setExpenseOpen] = useState(false);
  const [depositOpen, setDepositOpen] = useState(false);
  const [depositDeleteId, setDepositDeleteId] = useState<number | null>(null);
  const [expenseSearch, setExpenseSearch] = useState("");
  const [depositSearch, setDepositSearch] = useState("");
  const { toast } = useToast();

  // Expenses
  const { data: expenses, isLoading: loadingExpenses } = useExpenses();
  const createExpense = useCreateExpense();
  const deleteExpense = useDeleteExpense();

  // Deposits
  const { data: deposits, isLoading: loadingDeposits } = useDeposits();
  const createDeposit = useCreateDeposit();
  const deleteDeposit = useDeleteDeposit();

  const expenseForm = useForm<z.infer<typeof expenseFormSchema>>({
    resolver: zodResolver(expenseFormSchema),
    defaultValues: { description: "", amount: 0, month: "" },
  });

  const depositForm = useForm<z.infer<typeof depositFormSchema>>({
    resolver: zodResolver(depositFormSchema),
    defaultValues: { description: "", amount: 0, month: "" },
  });

  function onExpenseSubmit(values: z.infer<typeof expenseFormSchema>) {
    createExpense.mutate(values, {
      onSuccess: () => {
        setExpenseOpen(false);
        expenseForm.reset();
        toast({ title: "Expense added", description: `Recorded expense for ${values.description}` });
      },
      onError: (e) => toast({ variant: "destructive", title: "Error", description: e.message }),
    });
  }

  function onDepositSubmit(values: z.infer<typeof depositFormSchema>) {
    createDeposit.mutate(values, {
      onSuccess: () => {
        setDepositOpen(false);
        depositForm.reset();
        toast({ title: "Deposit recorded", description: `Recorded deposit for ${values.description}` });
      },
      onError: (e) => toast({ variant: "destructive", title: "Error", description: e.message }),
    });
  }

  function handleExpenseDelete(id: number) {
    if (confirm("Are you sure you want to delete this expense?")) {
      deleteExpense.mutate(id, { onSuccess: () => toast({ title: "Expense deleted" }) });
    }
  }

  function handleDepositDeleteConfirm() {
    if (depositDeleteId === null) return;
    deleteDeposit.mutate(depositDeleteId, {
      onSuccess: () => { toast({ title: "Deposit deleted" }); setDepositDeleteId(null); },
      onError: () => { toast({ variant: "destructive", title: "Failed to delete deposit" }); setDepositDeleteId(null); },
    });
  }

  const filteredExpenses = (expenses as Expense[] | undefined)?.filter(e =>
    e.description.toLowerCase().includes(expenseSearch.toLowerCase()) ||
    (e.month || "").toLowerCase().includes(expenseSearch.toLowerCase())
  );
  const filteredDeposits = (deposits as Deposit[] | undefined)?.filter(d =>
    d.description.toLowerCase().includes(depositSearch.toLowerCase()) ||
    (d.month || "").toLowerCase().includes(depositSearch.toLowerCase())
  );

  const groupedExpenses = groupByMonth(filteredExpenses || []);
  const groupedDeposits = groupByMonth(filteredDeposits || []);
  const expenseTotal = filteredExpenses?.reduce((s, e) => s + e.amount, 0) ?? 0;
  const depositTotal = filteredDeposits?.reduce((s, d) => s + d.amount, 0) ?? 0;

  const action = activeTab === "expenses" ? (
    <Dialog open={expenseOpen} onOpenChange={setExpenseOpen}>
      <DialogTrigger asChild>
        <Button variant="destructive" className="shadow-lg hover:shadow-xl transition-all">
          <Plus className="w-4 h-4 mr-2" /> Add Expense
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px] z-[500]">
        <DialogHeader>
          <DialogTitle>Add New Expense</DialogTitle>
          <DialogDescription>Record a new operational cost or purchase.</DialogDescription>
        </DialogHeader>
        <Form {...expenseForm}>
          <form onSubmit={expenseForm.handleSubmit(onExpenseSubmit)} className="space-y-4 pt-4">
            <FormField control={expenseForm.control} name="month" render={({ field }) => (
              <FormItem>
                <FormLabel>Month</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl><SelectTrigger><SelectValue placeholder="Select month" /></SelectTrigger></FormControl>
                  <SelectContent className="z-[600] max-h-52 overflow-y-auto" position="popper" sideOffset={4}>
                    {MONTHS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={expenseForm.control} name="description" render={({ field }) => (
              <FormItem>
                <FormLabel>Description</FormLabel>
                <FormControl><Input placeholder="e.g. Office Rent" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={expenseForm.control} name="amount" render={({ field }) => (
              <FormItem>
                <FormLabel>Amount (৳)</FormLabel>
                <FormControl><Input type="number" placeholder="0.00" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <Button type="submit" variant="destructive" className="w-full" disabled={createExpense.isPending}>
              {createExpense.isPending ? "Adding..." : "Record Expense"}
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  ) : (
    <Dialog open={depositOpen} onOpenChange={setDepositOpen}>
      <DialogTrigger asChild>
        <Button className="shadow-lg hover:shadow-xl transition-all bg-emerald-600 hover:bg-emerald-700 text-white">
          <Plus className="w-4 h-4 mr-2" /> Add Deposit
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px] z-[500]">
        <DialogHeader>
          <DialogTitle>Add New Deposit</DialogTitle>
          <DialogDescription>Record an additional income or deposit.</DialogDescription>
        </DialogHeader>
        <Form {...depositForm}>
          <form onSubmit={depositForm.handleSubmit(onDepositSubmit)} className="space-y-4 pt-4">
            <FormField control={depositForm.control} name="month" render={({ field }) => (
              <FormItem>
                <FormLabel>Month</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl><SelectTrigger><SelectValue placeholder="Select month" /></SelectTrigger></FormControl>
                  <SelectContent className="z-[600] max-h-52 overflow-y-auto" position="popper" sideOffset={4}>
                    {MONTHS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={depositForm.control} name="description" render={({ field }) => (
              <FormItem>
                <FormLabel>Description</FormLabel>
                <FormControl><Input placeholder="e.g. Donation, Sponsorship" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={depositForm.control} name="amount" render={({ field }) => (
              <FormItem>
                <FormLabel>Amount (৳)</FormLabel>
                <FormControl><Input type="number" placeholder="0.00" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <Button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white" disabled={createDeposit.isPending}>
              {createDeposit.isPending ? "Saving..." : "Record Deposit"}
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );

  return (
    <Layout title="Finance" subtitle="Track expenses and deposits" action={action}>

      {/* Tab toggle */}
      <div className="flex gap-1 p-1 bg-muted/40 rounded-xl w-fit mb-5 border border-border/50">
        <button
          onClick={() => setActiveTab("expenses")}
          className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-bold transition-all duration-200 ${
            activeTab === "expenses"
              ? "bg-white shadow-sm text-red-600 border border-border/60"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Receipt className="w-4 h-4" />
          Expenses
        </button>
        <button
          onClick={() => setActiveTab("deposits")}
          className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-bold transition-all duration-200 ${
            activeTab === "deposits"
              ? "bg-white shadow-sm text-emerald-600 border border-border/60"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <PiggyBank className="w-4 h-4" />
          Deposits
        </button>
      </div>

      {/* Content panel */}
      <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
        {activeTab === "expenses" ? (
          <>
            <div className="p-4 border-b border-border/50 flex flex-col sm:flex-row gap-4 justify-between items-center bg-muted/20">
              <div className="relative w-full sm:w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input placeholder="Search expenses..." className="pl-9 bg-background" value={expenseSearch} onChange={(e) => setExpenseSearch(e.target.value)} />
              </div>
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1.5"><Filter className="w-4 h-4" />{filteredExpenses?.length || 0} records</span>
                {expenseTotal > 0 && <span className="font-bold text-red-600">Total: -৳{expenseTotal.toLocaleString()}</span>}
              </div>
            </div>
            <div className="p-4">
              {loadingExpenses ? (
                <p className="text-center text-muted-foreground py-12">Loading records...</p>
              ) : groupedExpenses.length === 0 ? (
                <p className="text-center text-muted-foreground py-12">No expense records found.</p>
              ) : (
                groupedExpenses.map(([month, items], idx) => (
                  <ExpenseMonthGroup key={month} month={month} expenses={items} onDelete={handleExpenseDelete} isPending={deleteExpense.isPending} defaultOpen={idx === 0} />
                ))
              )}
            </div>
          </>
        ) : (
          <>
            <div className="p-4 border-b border-border/50 flex flex-col sm:flex-row gap-4 justify-between items-center bg-muted/20">
              <div className="relative w-full sm:w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input placeholder="Search deposits..." className="pl-9 bg-background" value={depositSearch} onChange={(e) => setDepositSearch(e.target.value)} />
              </div>
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1.5"><Filter className="w-4 h-4" />{filteredDeposits?.length || 0} records</span>
                {depositTotal > 0 && <span className="font-bold text-emerald-600">Total: +৳{depositTotal.toLocaleString()}</span>}
              </div>
            </div>
            <div className="p-4">
              {loadingDeposits ? (
                <p className="text-center text-muted-foreground py-12">Loading records...</p>
              ) : groupedDeposits.length === 0 ? (
                <p className="text-center text-muted-foreground py-12">No deposit records found.</p>
              ) : (
                groupedDeposits.map(([month, items], idx) => (
                  <DepositMonthGroup key={month} month={month} deposits={items} onDelete={(id) => setDepositDeleteId(id)} isPending={deleteDeposit.isPending} defaultOpen={idx === 0} />
                ))
              )}
            </div>
          </>
        )}
      </div>

      {/* Deposit delete confirmation */}
      <AlertDialog open={depositDeleteId !== null} onOpenChange={(open) => { if (!open) setDepositDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Deposit</AlertDialogTitle>
            <AlertDialogDescription>Are you sure you want to delete this deposit? This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDepositDeleteConfirm} className="bg-destructive text-destructive-foreground hover:bg-destructive/90" disabled={deleteDeposit.isPending}>
              {deleteDeposit.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
}
