import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryClient, apiRequest, fetchWithTimeout } from "@/lib/queryClient";
import { api, buildUrl } from "@shared/routes";
import { Income, Expense, Deposit, Batch, Student, InsertIncome, InsertExpense, InsertDeposit } from "@/lib/schemas";
import { usePortal } from "@/lib/portal-context";

export function useIncomes(enabled = true) {
  const { activePortal } = usePortal();
  return useQuery<any[]>({
    queryKey: [api.incomes.list.path, activePortal],
    enabled,
    queryFn: async () => {
      const url = `${api.incomes.list.path}?portal=${activePortal}`;
      const res = await fetchWithTimeout(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch incomes");
      return res.json();
    },
  });
}

export function useBatches(enabled = true) {
  return useQuery<Batch[]>({ queryKey: [api.batches.list.path], enabled });
}

export function useStudents(enabled = true) {
  return useQuery<any[]>({ queryKey: [api.students.list.path], enabled });
}

export function useExpenses(enabled = true) {
  return useQuery<Expense[]>({ queryKey: [api.expenses.list.path], enabled });
}

export function useDeposits(enabled = true) {
  return useQuery<Deposit[]>({ queryKey: [api.deposits.list.path], enabled });
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
      queryClient.invalidateQueries({ queryKey: [api.deposits.list.path] });
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
      queryClient.invalidateQueries({ queryKey: [api.deposits.list.path] });
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
