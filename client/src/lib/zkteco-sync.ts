/**
 * ZKTeco Client-Side Sync Bridge
 *
 * Fetches attendance punch logs from the local ZKTeco device over the coaching
 * center Wi-Fi and forwards them to the backend /api/attendance/sync-zkteco
 * endpoint.  All network calls are wrapped in try/catch with an AbortController
 * timeout so failures degrade gracefully instead of hanging indefinitely.
 *
 * Device endpoint: http://192.168.0.201:4370 (ZKTeco ADMS / HTTP relay)
 *  - The browser must be on the same Wi-Fi as the device for the fetch to
 *    succeed.  If it is not, a TypeError ("Failed to fetch") is caught and
 *    a human-readable Wi-Fi prompt is shown instead of an unhandled error.
 */

/** IP / port of the ZKTeco device (or local relay) on the coaching Wi-Fi. */
const DEVICE_BASE = "http://192.168.0.201:4370";

/** Device identifier stored alongside each raw punch log. */
const DEVICE_ID = "192.168.0.201";

/** Milliseconds before we abort the device fetch and show a timeout error. */
const CONNECT_TIMEOUT_MS = 6_000;

// ---------------------------------------------------------------------------
// Public status type – drives the UI state machine in the React component.
// ---------------------------------------------------------------------------
export type ZkSyncPhase =
  | { phase: "idle" }
  | { phase: "connecting" }
  | { phase: "fetching" }
  | { phase: "syncing"; count: number }
  | { phase: "success"; inserted: number; duplicates: number; total: number }
  | { phase: "error"; message: string };

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

interface PunchRecord {
  userId: string;
  deviceId: string;
  punchTime: string;
  [key: string]: unknown;
}

/**
 * Parse ZKTeco ADMS ATTLOG plain-text format into structured records.
 *
 * Each non-empty line is tab-separated:
 *   PIN \t DateTime \t Status \t Verify \t WorkCode \t Reserved
 *
 * Lines that are HTTP response preamble (e.g. "GET /…") or empty are skipped.
 */
function parseAttlog(raw: string): PunchRecord[] {
  const records: PunchRecord[] = [];

  for (const line of raw.split("\n")) {
    const t = line.trim();
    // Skip blank lines and HTTP preamble lines
    if (!t || t.startsWith("GET") || t.startsWith("POST") || t.startsWith("DEV")) continue;

    const fields = t.split("\t");
    if (fields.length < 2) continue;

    const userId    = (fields[0] ?? "").trim();
    const dateStr   = (fields[1] ?? "").trim(); // "YYYY-MM-DD HH:mm:ss"
    const status    = (fields[2] ?? "").trim();
    const verify    = (fields[3] ?? "").trim();
    const workCode  = (fields[4] ?? "").trim();

    if (!userId || !dateStr) continue;

    // Validate that punchTime is parseable before including the record
    const punchDate = new Date(dateStr);
    if (isNaN(punchDate.getTime())) continue;

    records.push({
      userId,
      deviceId: DEVICE_ID,
      punchTime: punchDate.toISOString(),
      status,
      verify,
      workCode,
    });
  }

  return records;
}

/**
 * Try to parse a JSON array response from a local HTTP relay that may return
 * records already in `{ userId, punchTime }` shape instead of ATTLOG text.
 */
function parseJsonLogs(raw: string): PunchRecord[] | null {
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    // Basic shape check
    if (parsed.length > 0 && typeof parsed[0] !== "object") return null;
    return (parsed as PunchRecord[]).map((r) => ({
      deviceId: DEVICE_ID,
      ...r,
    }));
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * Run the full ZKTeco sync flow and call `onStatus` with each phase update.
 *
 * Phases (in order):
 *   connecting → fetching → syncing(n) → success | error
 *
 * @param onStatus  Callback invoked on every phase transition.
 */
export async function syncZkteco(
  onStatus: (s: ZkSyncPhase) => void,
): Promise<void> {
  // ── 1. Attempt to reach the device ────────────────────────────────────────
  onStatus({ phase: "connecting" });

  let rawBody = "";
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), CONNECT_TIMEOUT_MS);

    // Prefer the ADMS ATTLOG endpoint; local relays often accept the same path.
    const res = await fetch(
      `${DEVICE_BASE}/iclock/cdata?table=ATTLOG&Stamp=0`,
      {
        method: "GET",
        signal: controller.signal,
        // No credentials needed for the local device.
      },
    );
    clearTimeout(timer);

    if (!res.ok) {
      onStatus({
        phase: "error",
        message: `Device responded with HTTP ${res.status}. Check the relay configuration.`,
      });
      return;
    }

    rawBody = await res.text();
  } catch (err: unknown) {
    const name = (err as { name?: string }).name ?? "";
    if (name === "AbortError") {
      onStatus({
        phase: "error",
        message:
          "Connection timed out. Please connect to the coaching center Wi-Fi to sync device logs.",
      });
    } else {
      onStatus({
        phase: "error",
        message:
          "Could not reach the attendance device. Please connect to the coaching center Wi-Fi to sync device logs.",
      });
    }
    return;
  }

  // ── 2. Parse the response body ─────────────────────────────────────────────
  onStatus({ phase: "fetching" });

  const records: PunchRecord[] =
    parseJsonLogs(rawBody) ?? parseAttlog(rawBody);

  if (records.length === 0) {
    onStatus({
      phase: "error",
      message:
        "No attendance records found on the device, or the response format was unexpected. " +
        "Ensure the device / relay is sending ATTLOG data.",
    });
    return;
  }

  // ── 3. Send records to the server ─────────────────────────────────────────
  onStatus({ phase: "syncing", count: records.length });

  try {
    const res = await fetch("/api/attendance/sync-zkteco", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(records),
    });

    const json = await res.json().catch(() => ({}));

    if (!res.ok) {
      onStatus({
        phase: "error",
        message: (json as { message?: string }).message ?? `Server error (${res.status})`,
      });
      return;
    }

    const { inserted = 0, duplicates = 0, total = records.length } = json as {
      inserted?: number;
      duplicates?: number;
      total?: number;
    };

    onStatus({ phase: "success", inserted, duplicates, total });
  } catch (err: unknown) {
    onStatus({
      phase: "error",
      message: (err as { message?: string }).message ?? "Failed to send records to the server.",
    });
  }
}
