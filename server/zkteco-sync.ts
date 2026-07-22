/**
 * ZKTeco K40 Attendance Sync Service
 * Connects to the device via TCP, pulls punch logs, and saves new entries to NeonDB.
 * Public IP: 36.255.83.199  Port: 4370
 */

import { db } from "./db";
import { zktecoLogs, students } from "@shared/schema";
import { eq, and, desc } from "drizzle-orm";

const ZKTECO_IP   = "36.255.83.199";
const ZKTECO_PORT = 4370;
const ZKTECO_TIMEOUT = 10_000; // 10 s socket timeout

// Track last sync state in memory
let lastSyncAt: Date | null = null;
let lastSyncStatus: "idle" | "running" | "success" | "error" = "idle";
let lastSyncMessage = "Never synced";
let lastSyncCount = 0;

export function getZkSyncStatus() {
  return { lastSyncAt, lastSyncStatus, lastSyncMessage, lastSyncCount };
}

/**
 * Map punchType integer (ZKTeco inOutStatus) → human-readable string.
 * 0 = check-in, 1 = check-out, 2 = break-out, 3 = break-in, 4 = OT-in, 5 = OT-out
 */
function parsePunchType(inOutStatus: number): string {
  const types: Record<number, string> = {
    0: "check-in",
    1: "check-out",
    2: "break-out",
    3: "break-in",
    4: "ot-in",
    5: "ot-out",
  };
  return types[inOutStatus] ?? "unknown";
}

/**
 * Build a lookup map from studentCustomId → student.id so we can match
 * ZKTeco device user IDs to internal student records.
 */
async function buildStudentMap(): Promise<Map<string, number>> {
  const all = await db.select({ id: students.id, customId: students.studentCustomId }).from(students);
  const map = new Map<string, number>();
  for (const s of all) {
    if (s.customId) map.set(s.customId.trim(), s.id);
  }
  return map;
}

/**
 * Main sync function. Connects to ZKTeco device, fetches all attendance records,
 * deduplicates against existing DB rows, and inserts new ones.
 * Returns { inserted, total, error? }
 */
export async function syncZktecoAttendance(): Promise<{
  inserted: number;
  total: number;
  error?: string;
}> {
  if (lastSyncStatus === "running") {
    return { inserted: 0, total: 0, error: "Sync already in progress" };
  }

  lastSyncStatus = "running";
  lastSyncMessage = "Connecting to device…";

  try {
    // Dynamically import node-zklib (CommonJS module)
    const ZKLib = (await import("node-zklib")).default;

    const zk = new ZKLib(ZKTECO_IP, ZKTECO_PORT, "tcp", ZKTECO_TIMEOUT);

    console.log(`[ZKTeco] Connecting to ${ZKTECO_IP}:${ZKTECO_PORT}…`);
    await zk.createSocket();

    console.log(`[ZKTeco] Fetching attendance logs…`);
    const result = await zk.getAttendances();

    // node-zklib may return { data: { attendances: [...] } } or { data: [...] }
    const rawLogs: any[] = Array.isArray(result?.data)
      ? result.data
      : Array.isArray(result?.data?.attendances)
      ? result.data.attendances
      : [];

    await zk.disconnect();
    console.log(`[ZKTeco] Pulled ${rawLogs.length} total records from device.`);

    if (rawLogs.length === 0) {
      lastSyncStatus = "success";
      lastSyncAt = new Date();
      lastSyncCount = 0;
      lastSyncMessage = "Device returned 0 records.";
      return { inserted: 0, total: 0 };
    }

    // Build student map for matching
    const studentMap = await buildStudentMap();

    // Fetch existing synced timestamps to avoid duplicates
    // Key: `${deviceUserId}_${timestamp.getTime()}`
    const existing = await db
      .select({ deviceUserId: zktecoLogs.deviceUserId, timestamp: zktecoLogs.timestamp })
      .from(zktecoLogs);

    const existingKeys = new Set(
      existing.map((r) => `${r.deviceUserId}_${new Date(r.timestamp).getTime()}`)
    );

    // Build new records to insert
    const toInsert: typeof zktecoLogs.$inferInsert[] = [];
    for (const log of rawLogs) {
      const deviceUserId = String(log.deviceUserId ?? log.uid ?? log.userId ?? "").trim();
      const attTime: Date | null = log.attTime instanceof Date
        ? log.attTime
        : log.attTime
        ? new Date(log.attTime)
        : null;

      if (!deviceUserId || !attTime || isNaN(attTime.getTime())) continue;

      const key = `${deviceUserId}_${attTime.getTime()}`;
      if (existingKeys.has(key)) continue; // already saved

      const punchType = parsePunchType(log.inOutStatus ?? 0);
      const studentId = studentMap.get(deviceUserId) ?? null;

      toInsert.push({
        deviceUserId,
        studentId,
        timestamp: attTime,
        punchType,
        verifyMethod: typeof log.verifyMethod === "number" ? log.verifyMethod : null,
      });
    }

    // Batch insert new records
    if (toInsert.length > 0) {
      // Insert in chunks of 100 to stay within query size limits
      const CHUNK = 100;
      for (let i = 0; i < toInsert.length; i += CHUNK) {
        await db.insert(zktecoLogs).values(toInsert.slice(i, i + CHUNK));
      }
    }

    lastSyncStatus = "success";
    lastSyncAt = new Date();
    lastSyncCount = toInsert.length;
    lastSyncMessage = `Synced ${toInsert.length} new record(s) from ${rawLogs.length} total on device.`;
    console.log(`[ZKTeco] ${lastSyncMessage}`);

    return { inserted: toInsert.length, total: rawLogs.length };
  } catch (err: any) {
    const msg = err?.message || String(err);
    console.error("[ZKTeco] Sync error:", msg);
    lastSyncStatus = "error";
    lastSyncMessage = `Sync failed: ${msg}`;
    return { inserted: 0, total: 0, error: msg };
  }
}
