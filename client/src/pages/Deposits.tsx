import { useState } from "react";
import { Layout } from "@/components/Layout";
import { useDeposits, useCreateDeposit, useDeleteDeposit } from "@/hooks/use-finance";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Plus, Trash2, Search, Filter, ChevronDown, ChevronUp } from "lucide-react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { insertDepositSchema } from "@/lib/schemas";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

const formSchema = insertDepositSchema.extend({
  amount: z.coerce.number().min(1, "Amount must be greater than 0"),
  month: z.string().min(1, "Please select a month"),
});

type Deposit = {
  id: number;
  description: string;
  amount: number;
  month: string;
  date: string | Date;
};

function groupByMonth(deposits: Deposit[]) {
  const order = MONTHS;
  const groups: Record<string, Deposit[]> = {};
  for (const dep of deposits) {
    const key = dep.month || "Other";
    if (!groups[key]) groups[key] = [];
    groups[key].push(dep);
  }
  return Object.entries(groups).sort(([a], [b]) => {
    const ai = order.indexOf(a);
    const bi = order.indexOf(b);
    if (ai === -1 && bi === -1) return a.localeCompare(b);
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });
}

function MonthGroup({
  month,
  deposits,
  onDelete,
  isPending,
}: {
  month: string;
  deposits: Deposit[];
  onDelete: (id: number) => void;
  isPending: boolean;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const total = deposits.reduce((sum, d) => sum + d.amount, 0);

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
          <span className="text-xs text-muted-foreground">({deposits.length} {deposits.length === 1 ? "item" : "items"})</span>
        </div>
        <span className="font-bold text-emerald-600 text-sm">+৳{total.toLocaleString()}</span>
      </button>

      {!collapsed && (
        <div className="divide-y divide-border/50">
          {deposits.map((deposit) => (
            <div key={deposit.id} className="group flex items-center gap-3 px-4 py-3 hover:bg-muted/20 transition-colors">
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{deposit.description}</p>
                <p className="text-xs text-muted-foreground">{format(new Date(deposit.date), "MMM d, yyyy")}</p>
              </div>
              <span className="font-semibold text-emerald-600 text-sm shrink-0">+৳{deposit.amount.toLocaleString()}</span>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onDelete(deposit.id)}
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

export default function Deposits() {
  const [open, setOpen] = useState(false);
  const { data: deposits, isLoading } = useDeposits();
  const createMutation = useCreateDeposit();
  const deleteMutation = useDeleteDeposit();
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
          title: "Deposit recorded",
          description: `Successfully recorded deposit for ${values.description}`,
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
    if (confirm("Are you sure you want to delete this deposit?")) {
      deleteMutation.mutate(id, {
        onSuccess: () => {
          toast({ title: "Deposit deleted" });
        },
      });
    }
  }

  const filteredDeposits = (deposits as Deposit[] | undefined)?.filter((dep) =>
    dep.description.toLowerCase().includes(search.toLowerCase()) ||
    (dep.month || "").toLowerCase().includes(search.toLowerCase())
  );

  const grouped = groupByMonth(filteredDeposits || []);
  const totalAll = filteredDeposits?.reduce((s, d) => s + d.amount, 0) ?? 0;

  return (
    <Layout
      title="Deposit Tracking"
      subtitle="Record additional income and deposits"
      action={
        <Dialog open={open} onOpenChange={setOpen}>
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
                        <Input placeholder="e.g. Donation, Sponsorship" {...field} />
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
                <Button
                  type="submit"
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
                  disabled={createMutation.isPending}
                >
                  {createMutation.isPending ? "Saving..." : "Record Deposit"}
                </Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      }
    >
      <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
        <div className="p-4 border-b border-border/50 flex flex-col sm:flex-row gap-4 justify-between items-center bg-muted/20">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search deposits..."
              className="pl-9 bg-background"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Filter className="w-4 h-4" />
              {filteredDeposits?.length || 0} records
            </span>
            {totalAll > 0 && (
              <span className="font-bold text-emerald-600">Total: +৳{totalAll.toLocaleString()}</span>
            )}
          </div>
        </div>

        <div className="p-4">
          {isLoading ? (
            <p className="text-center text-muted-foreground py-12">Loading records...</p>
          ) : grouped.length === 0 ? (
            <p className="text-center text-muted-foreground py-12">No deposit records found.</p>
          ) : (
            grouped.map(([month, items]) => (
              <MonthGroup
                key={month}
                month={month}
                deposits={items}
                onDelete={handleDelete}
                isPending={deleteMutation.isPending}
              />
            ))
          )}
        </div>
      </div>
    </Layout>
  );
}
