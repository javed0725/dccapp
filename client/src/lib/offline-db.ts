import { openDB, DBSchema, IDBPDatabase } from "idb";

export type OfflineActionType = "payment" | "attendance" | "results_batch";

export interface OfflinePending {
  id: string;
  type: OfflineActionType;
  url: string;
  method: string;
  payload: unknown;
  savedAt: number;
  label: string;
}

interface OfflineDB extends DBSchema {
  pending: {
    key: string;
    value: OfflinePending;
    indexes: { byType: OfflineActionType; bySavedAt: number };
  };
}

let _db: IDBPDatabase<OfflineDB> | null = null;

async function getDB(): Promise<IDBPDatabase<OfflineDB>> {
  if (_db) return _db;
  _db = await openDB<OfflineDB>("dcc-offline", 1, {
    upgrade(db) {
      const store = db.createObjectStore("pending", { keyPath: "id" });
      store.createIndex("byType", "type");
      store.createIndex("bySavedAt", "savedAt");
    },
  });
  return _db;
}

export async function saveOfflineAction(action: Omit<OfflinePending, "id" | "savedAt">): Promise<string> {
  const db = await getDB();
  const id = `${action.type}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const entry: OfflinePending = { ...action, id, savedAt: Date.now() };
  await db.put("pending", entry);
  return id;
}

export async function getPendingActions(): Promise<OfflinePending[]> {
  const db = await getDB();
  return db.getAllFromIndex("pending", "bySavedAt");
}

export async function removePendingAction(id: string): Promise<void> {
  const db = await getDB();
  await db.delete("pending", id);
}

export async function getPendingCount(): Promise<number> {
  const db = await getDB();
  return db.count("pending");
}

export async function clearAllPending(): Promise<void> {
  const db = await getDB();
  await db.clear("pending");
}
