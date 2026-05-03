import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { api, buildUrl } from "@shared/routes";
import { Income, Expense, Deposit, Batch, Student, InsertIncome, InsertExpense, InsertDeposit } from "@/lib/schemas";
import { usePortal } from "@/lib/portal-context";

export function useIncomes() {
  const { activePortal } = usePortal();
  return useQuery<any[]>({
    queryKey: [api.incomes.list.path, activePortal],
    queryFn: async () => {
      const url = `${api.incomes.list.path}?portal=${activePortal}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch incomes");
      return res.json();
    },
    staleTime: 5 * 60_000,
  });
}

export function useBatches() {
  return useQuery<Batch[]>({
    queryKey: [api.batches.list.path],
    queryFn: async () => {
      const res = await fetch(api.batches.list.path);
      if (!res.ok) throw new Error("Failed to fetch batches");
      return res.json();
    },
    staleTime: 5 * 60_000,
  });
}

export function useStudents() {
  return useQuery<any[]>({
    queryKey: [api.students.list.path],
    queryFn: async () => {
      const res = await fetch(api.students.list.path);
      if (!res.ok) throw new Error("Failed to fetch students");
      return api.students.list.responses[200].parse(await res.json());
    },
    staleTime: 5 * 60_000,
  });
}

export function useCreateBatch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch(api.batches.create.path, {
        method: api.batches.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create batch");
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
      const res = await fetch(url, { method: api.batches.delete.method });
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
      const res = await fetch(api.students.create.path, {
        method: api.students.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create student");
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
      const res = await fetch(url, { method: api.students.delete.method });
      if (!res.ok) throw new Error("Failed to delete student");
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
      const res = await fetch(`/api/students/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update student");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.students.list.path] });
    },
  });
}

export function useExpenses() {
  return useQuery<Expense[]>({
    queryKey: [api.expenses.list.path],
    queryFn: async () => {
      const res = await fetch(api.expenses.list.path);
      if (!res.ok) throw new Error("Failed to fetch expenses");
      return res.json();
    },
    staleTime: 5 * 60_000,
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

export function useDeposits() {
  return useQuery<Deposit[]>({
    queryKey: [api.deposits.list.path],
    queryFn: async () => {
      const res = await fetch(api.deposits.list.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch deposits");
      return res.json();
    },
    staleTime: 5 * 60_000,
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
