import { openDB, DBSchema, IDBPDatabase } from "idb";
import type { OfflineSession } from "./offline-auth";

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
  session: {
    key: string; // username
    value: OfflineSession;
  };
}

let _db: IDBPDatabase<OfflineDB> | null = null;

async function getDB(): Promise<IDBPDatabase<OfflineDB>> {
  if (_db) return _db;
  _db = await openDB<OfflineDB>("dcc-offline", 2, {
    upgrade(db, oldVersion) {
      // v1 → create pending store
      if (oldVersion < 1) {
        const store = db.createObjectStore("pending", { keyPath: "id" });
        store.createIndex("byType", "type");
        store.createIndex("bySavedAt", "savedAt");
      }
      // v2 → add session store
      if (oldVersion < 2) {
        db.createObjectStore("session", { keyPath: "username" });
      }
    },
  });
  return _db;
}

// Shared DB getter for both pending actions and auth sessions
export const getAuthDB = getDB;

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
