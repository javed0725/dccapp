import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryClient, apiRequest, fetchWithTimeout } from "@/lib/queryClient";
import { api, buildUrl } from "@shared/routes";
import { Income, Expense, Deposit, Batch, Student, InsertIncome, InsertExpense, InsertDeposit } from "@/lib/schemas";
import { usePortal } from "@/lib/portal-context";

// ── useIncomes ───────────────────────────────────────────────────────────────
// Custom queryFn is required here because the URL needs ?portal= appended,
// which can't be inferred from the multi-segment queryKey.
// The 18-second timeout and stale-cache fallback are applied explicitly so
// slow networks show cached data rather than a blank/error screen.
export function useIncomes() {
  const { activePortal } = usePortal();
  return useQuery<any[]>({
    queryKey: [api.incomes.list.path, activePortal],
    queryFn: async ({ queryKey }) => {
      const url = `${api.incomes.list.path}?portal=${activePortal}`;
      try {
        const res = await fetchWithTimeout(url, { credentials: "include" });
        if (!res.ok) throw new Error("Failed to fetch incomes");
        return res.json();
      } catch (err) {
        // On connectivity failure return stale cache data so the income list
        // keeps rendering even when the server is unreachable.
        const stale = queryClient.getQueryData<any[]>(queryKey);
        if (
          stale !== undefined &&
          (err instanceof Error &&
            (err.message.toLowerCase().includes("failed to fetch") ||
              err.message.toLowerCase().includes("timed out") ||
              !navigator.onLine))
        ) {
          return stale;
        }
        throw err;
      }
    },
  });
}

// ── The remaining hooks omit a custom queryFn intentionally.
// The global default queryFn (getQueryFn) already applies:
//   • fetchWithTimeout  (18 s cap)
//   • stale-cache fallback on connectivity errors
//   • 401 → session-expired toast + redirect
// This keeps each hook minimal and DRY.

export function useBatches() {
  return useQuery<Batch[]>({
    queryKey: [api.batches.list.path],
  });
}

export function useStudents() {
  return useQuery<any[]>({
    queryKey: [api.students.list.path],
  });
}

export function useExpenses() {
  return useQuery<Expense[]>({
    queryKey: [api.expenses.list.path],
  });
}

export function useDeposits() {
  return useQuery<Deposit[]>({
    queryKey: [api.deposits.list.path],
  });
}

export function useCreateBatch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", api.batches.create.path, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.batches.list.path] });
    },
  });
}

export function useDeleteBatch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const url = buildUrl(api.batches.delete.path, { id });
      const res = await apiRequest("DELETE", url);
      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.message || "Failed to delete batch");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.batches.list.path] });
    },
  });
}

export function useCreateStudent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", api.students.create.path, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.students.list.path] });
    },
  });
}

export function useDeleteStudent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const url = buildUrl(api.students.delete.path, { id });
      await apiRequest("DELETE", url);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.students.list.path] });
    },
  });
}

export function useUpdateStudent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<Student> }) => {
      const res = await apiRequest("PATCH", `/api/students/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.students.list.path] });
    },
  });
}

export function useCreateIncome() {
  return useMutation({
    mutationFn: async (data: InsertIncome) => {
      const res = await apiRequest("POST", "/api/incomes", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.incomes.list.path] });
    },
  });
}

export function useDeleteIncome() {
  return useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/incomes/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.incomes.list.path] });
    },
  });
}

export function useCreateExpense() {
  return useMutation({
    mutationFn: async (data: InsertExpense) => {
      const res = await apiRequest("POST", "/api/expenses", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.expenses.list.path] });
    },
  });
}

export function useDeleteExpense() {
  return useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/expenses/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.expenses.list.path] });
    },
  });
}

export function useCreateDeposit() {
  return useMutation({
    mutationFn: async (data: InsertDeposit) => {
      const res = await apiRequest("POST", "/api/deposits", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.deposits.list.path] });
    },
  });
}

export function useDeleteDeposit() {
  return useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/deposits/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.deposits.list.path] });
    },
  });
}
