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

interface QueryCacheEntry {
  key: string;
  data: unknown;
  savedAt: number;
}

interface OfflineDB extends DBSchema {
  pending: {
    key: string;
    value: OfflinePending;
    indexes: { byType: OfflineActionType; bySavedAt: number };
  };
  session: {
    key: string;
    value: OfflineSession;
  };
  queryCache: {
    key: string;
    value: QueryCacheEntry;
  };
}

let _db: IDBPDatabase<OfflineDB> | null = null;

async function getDB(): Promise<IDBPDatabase<OfflineDB>> {
  if (_db) return _db;
  _db = await openDB<OfflineDB>("dcc-offline", 3, {
    upgrade(db, oldVersion) {
      if (oldVersion < 1) {
        const store = db.createObjectStore("pending", { keyPath: "id" });
        store.createIndex("byType", "type");
        store.createIndex("bySavedAt", "savedAt");
      }
      if (oldVersion < 2) {
        db.createObjectStore("session", { keyPath: "username" });
      }
      if (oldVersion < 3) {
        db.createObjectStore("queryCache", { keyPath: "key" });
      }
    },
  });
  return _db;
}

export const getAuthDB = getDB;

// ── Offline action queue ─────────────────────────────────────────────────────

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

// ── React Query cache persistence ────────────────────────────────────────────

const QUERY_CACHE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export async function saveQueryCache(key: string, data: unknown): Promise<void> {
  try {
    const db = await getDB();
    await db.put("queryCache", { key, data, savedAt: Date.now() });
  } catch {
    // Non-critical — never break the app over a cache write failure
  }
}

export async function loadAllQueryCaches(): Promise<QueryCacheEntry[]> {
  try {
    const db = await getDB();
    const all = await db.getAll("queryCache");
    const cutoff = Date.now() - QUERY_CACHE_MAX_AGE_MS;
    return all.filter((e) => e.savedAt > cutoff);
  } catch {
    return [];
  }
}
