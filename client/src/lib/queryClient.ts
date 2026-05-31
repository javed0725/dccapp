import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";

const SESSION_EXPIRED_FALLBACK = "Your session has expired. Please log in again.";

// ── Network timeout ───────────────────────────────────────────────────────────
// 10 s — long enough for slow 3G/Teletalk, short enough that a stalled request
// fails visibly instead of freezing the UI.
const FETCH_TIMEOUT_MS = 10_000;

export function fetchWithTimeout(
  url: string,
  init?: RequestInit,
  timeoutMs = FETCH_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(new Error("Request timed out after " + timeoutMs + "ms")),
    timeoutMs,
  );
  return fetch(url, { ...init, signal: controller.signal }).finally(() =>
    clearTimeout(timer),
  );
}

// ── Retry helpers ─────────────────────────────────────────────────────────────
// Only retry on genuine network failures (no route, packet drop, DNS miss,
// our own timeout abort).  Never retry 4xx / 5xx — those are server decisions.
function isRetryableNetworkError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  return (
    err.name === "AbortError" ||          // our timeout
    err.name === "TypeError" ||           // "Failed to fetch" / CORS preflight drop
    err.message.includes("timed out") ||
    err.message.includes("Failed to fetch") ||
    err.message.includes("Network request failed") ||
    err.message.includes("NetworkError")
  );
}

// Exponential backoff: 1 s → 2 s → 4 s (capped at 8 s).
function backoffMs(attempt: number): number {
  return Math.min(1_000 * Math.pow(2, attempt), 8_000);
}

export async function fetchWithRetry(
  url: string,
  init?: RequestInit,
  timeoutMs = FETCH_TIMEOUT_MS,
  maxRetries = 2,
): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (attempt > 0) {
      const delay = backoffMs(attempt - 1);
      console.info(
        `[DCC Network] Retry ${attempt}/${maxRetries} for ${url} ` +
          `(backoff ${delay} ms, online=${navigator.onLine})`,
      );
      await new Promise((r) => setTimeout(r, delay));
    }
    try {
      return await fetchWithTimeout(url, init, timeoutMs);
    } catch (err) {
      lastError = err;
      if (!isRetryableNetworkError(err)) throw err; // HTTP error — don't retry
    }
  }
  throw lastError;
}

// ── Auth helpers ─────────────────────────────────────────────────────────────

function isAuthCheckUrl(url: string): boolean {
  try {
    const path = url.startsWith("http") ? new URL(url).pathname : url.split("?")[0];
    return path === "/api/user" || path === "/api/login" || path === "/api/logout";
  } catch {
    return false;
  }
}

let lastUnauthorizedAt = 0;
function handleUnauthorized(message: string) {
  const now = Date.now();
  if (now - lastUnauthorizedAt < 1500) return;
  lastUnauthorizedAt = now;

  queryClient.setQueryData(["/api/user"], null);

  toast({
    title: "Session expired",
    description: message,
    variant: "destructive",
  });

  if (typeof window !== "undefined") {
    const path = window.location.pathname;
    const safePaths = new Set(["/", "/login", "/admin", "/teacher", "/student"]);
    if (!safePaths.has(path)) {
      window.location.href = "/login";
    }
  }
}

async function parseErrorMessage(res: Response): Promise<string> {
  const text = (await res.text()) || res.statusText;
  try {
    const json = JSON.parse(text);
    if (json.message) return json.message as string;
    if (json.error) return json.error as string;
  } catch {
    /* not JSON */
  }
  return text || `Request failed with status ${res.status}`;
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const message = await parseErrorMessage(res);
    throw new Error(message);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const res = await fetchWithRetry(url, {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  if (res.status === 401 && !isAuthCheckUrl(url)) {
    const message = await parseErrorMessage(res.clone()).catch(
      () => SESSION_EXPIRED_FALLBACK,
    );
    handleUnauthorized(message || SESSION_EXPIRED_FALLBACK);
    throw new Error(message || SESSION_EXPIRED_FALLBACK);
  }

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const url = queryKey.join("/") as string;

    const res = await fetchWithRetry(url, { credentials: "include" });

    if (res.status === 401) {
      if (unauthorizedBehavior === "returnNull") {
        return null;
      }
      if (!isAuthCheckUrl(url)) {
        const message = await parseErrorMessage(res.clone()).catch(
          () => SESSION_EXPIRED_FALLBACK,
        );
        handleUnauthorized(message || SESSION_EXPIRED_FALLBACK);
        throw new Error(message || SESSION_EXPIRED_FALLBACK);
      }
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: 5 * 60_000,
      gcTime: 15 * 60_000,
      retry: false, // retries handled in fetchWithRetry above
    },
    mutations: {
      retry: false,
    },
  },
});
