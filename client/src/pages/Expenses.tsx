import { useState } from "react";
import { Layout } from "@/components/Layout";
import { useExpenses, useCreateExpense, useDeleteExpense } from "@/hooks/use-finance";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Plus, Trash2, Search, Filter, ChevronDown, ChevronUp } from "lucide-react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { insertExpenseSchema } from "@/lib/schemas";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

const formSchema = insertExpenseSchema.extend({
  amount: z.coerce.number().min(1, "Amount must be greater than 0"),
  month: z.string().min(1, "Please select a month"),
});

type Expense = {
  id: number;
  description: string;
  amount: number;
  month: string;
  date: string | Date;
};

function groupByMonth(expenses: Expense[]) {
  const order = MONTHS;
  const groups: Record<string, Expense[]> = {};
  for (const exp of expenses) {
    const key = exp.month || "Other";
    if (!groups[key]) groups[key] = [];
    groups[key].push(exp);
  }
  // Descending: latest month first
  return Object.entries(groups).sort(([a], [b]) => {
    const ai = order.indexOf(a);
    const bi = order.indexOf(b);
    if (ai === -1 && bi === -1) return b.localeCompare(a);
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return bi - ai;
  });
}

function MonthGroup({
  month,
  expenses,
  onDelete,
  isPending,
  defaultOpen = false,
}: {
  month: string;
  expenses: Expense[];
  onDelete: (id: number) => void;
  isPending: boolean;
  defaultOpen?: boolean;
}) {
  const [collapsed, setCollapsed] = useState(!defaultOpen);
  const total = expenses.reduce((sum, e) => sum + e.amount, 0);

  return (
    <div className="border border-border rounded-xl overflow-hidden mb-3">
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="w-full flex items-center justify-between px-4 py-3 bg-muted/30 hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          {collapsed ? (
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          ) : (
            <ChevronUp className="w-4 h-4 text-muted-foreground" />
          )}
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
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onDelete(expense.id)}
                className="opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive hover:bg-destructive/10 h-7 w-7 shrink-0"
                disabled={isPending}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Expenses() {
  const [open, setOpen] = useState(false);
  const { data: expenses, isLoading } = useExpenses();
  const createMutation = useCreateExpense();
  const deleteMutation = useDeleteExpense();
  const { toast } = useToast();
  const [search, setSearch] = useState("");

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      description: "",
      amount: 0,
      month: "",
    },
  });

  function onSubmit(values: z.infer<typeof formSchema>) {
    createMutation.mutate(values, {
      onSuccess: () => {
        setOpen(false);
        form.reset();
        toast({
          title: "Expense added",
          description: `Successfully recorded expense for ${values.description}`,
        });
      },
      onError: (error) => {
        toast({
          variant: "destructive",
          title: "Error",
          description: error.message,
        });
      },
    });
  }

  function handleDelete(id: number) {
    if (confirm("Are you sure you want to delete this expense?")) {
      deleteMutation.mutate(id, {
        onSuccess: () => {
          toast({ title: "Expense deleted" });
        },
      });
    }
  }

  const filteredExpenses = (expenses as Expense[] | undefined)?.filter((exp) =>
    exp.description.toLowerCase().includes(search.toLowerCase()) ||
    (exp.month || "").toLowerCase().includes(search.toLowerCase())
  );

  const grouped = groupByMonth(filteredExpenses || []);
  const totalAll = filteredExpenses?.reduce((s, e) => s + e.amount, 0) ?? 0;

  return (
    <Layout
      title="Expense Tracking"
      subtitle="Monitor your operational costs"
      action={
        <Dialog open={open} onOpenChange={setOpen}>
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
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
                <FormField
                  control={form.control}
                  name="month"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Month</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select month" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent
                          className="z-[600] max-h-52 overflow-y-auto"
                          position="popper"
                          sideOffset={4}
                        >
                          {MONTHS.map((m) => (
                            <SelectItem key={m} value={m}>{m}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. Office Rent" {...field} />
                      </FormControl>
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
                <Button type="submit" variant="destructive" className="w-full" disabled={createMutation.isPending}>
                  {createMutation.isPending ? "Adding..." : "Record Expense"}
                </Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      }
    >
      <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
        {/* Search + summary bar */}
        <div className="p-4 border-b border-border/50 flex flex-col sm:flex-row gap-4 justify-between items-center bg-muted/20">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search expenses..."
              className="pl-9 bg-background"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Filter className="w-4 h-4" />
              {filteredExpenses?.length || 0} records
            </span>
            {totalAll > 0 && (
              <span className="font-bold text-red-600">Total: -৳{totalAll.toLocaleString()}</span>
            )}
          </div>
        </div>

        {/* Month-grouped list */}
        <div className="p-4">
          {isLoading ? (
            <p className="text-center text-muted-foreground py-12">Loading records...</p>
          ) : grouped.length === 0 ? (
            <p className="text-center text-muted-foreground py-12">No expense records found.</p>
          ) : (
            grouped.map(([month, items], idx) => (
              <MonthGroup
                key={month}
                month={month}
                expenses={items}
                onDelete={handleDelete}
                isPending={deleteMutation.isPending}
                defaultOpen={idx === 0}
              />
            ))
          )}
        </div>
      </div>
    </Layout>
  );
}
