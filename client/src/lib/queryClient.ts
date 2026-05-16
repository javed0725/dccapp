import { QueryClient, QueryCache, QueryFunction } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { saveQueryCache, loadAllQueryCaches } from "./offline-db";

const SESSION_EXPIRED_FALLBACK =
  "Your session has expired. Please log in again.";

// ── Persistence filter ───────────────────────────────────────────────────────
// These query key prefixes are never written to IndexedDB — they are either
// real-time, auth-sensitive, or meaningless to restore across sessions.

const SKIP_PERSIST_PREFIXES = [
  "/api/user",
  "/api/login",
  "/api/logout",
  "/api/notifications",
  "/api/collections",
];

function shouldPersistKey(queryKey: readonly unknown[]): boolean {
  const first = queryKey[0];
  if (typeof first !== "string") return false;
  for (const prefix of SKIP_PERSIST_PREFIXES) {
    if (first === prefix || first.startsWith(prefix + "/")) return false;
  }
  return true;
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
  const res = await fetch(url, {
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
    const res = await fetch(url, {
      credentials: "include",
    });

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

// ── QueryCache with auto-persist ─────────────────────────────────────────────
// Every successful query result is automatically saved to IndexedDB so the
// data survives page reloads and is available immediately when offline.

const persistingQueryCache = new QueryCache({
  onSuccess(data, query) {
    if (shouldPersistKey(query.queryKey)) {
      const key = JSON.stringify(query.queryKey);
      saveQueryCache(key, data); // fire-and-forget — never blocks the UI
    }
  },
});

export const queryClient = new QueryClient({
  queryCache: persistingQueryCache,
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      // 5 min stale — data serves from cache within this window, no re-fetch
      staleTime: 5 * 60_000,
      // Keep unused data in memory for 15 min so navigating back is instant
      gcTime: 15 * 60_000,
      retry: false,
      // offlineFirst: React Query will attempt the queryFn once even without
      // a network connection. If the fetch fails, any data already in the
      // cache (pre-loaded from IndexedDB at startup) is returned — so
      // student/class dropdowns and data grids remain populated offline.
      networkMode: "offlineFirst",
    },
    mutations: {
      retry: false,
    },
  },
});

// ── Boot-time cache hydration from IndexedDB ─────────────────────────────────
// This IIFE runs synchronously when the module is first imported — before any
// React component renders. It reads every previously-persisted query snapshot
// out of IndexedDB and injects it into the React Query in-memory cache via
// setQueryData. Components that mount offline will immediately receive real
// data instead of empty arrays, so dropdowns and student lists work without
// any network connection.

(async function hydrateFromIDB() {
  try {
    const entries = await loadAllQueryCaches();
    let count = 0;
    for (const { key, data } of entries) {
      try {
        const queryKey = JSON.parse(key) as unknown[];
        // Only pre-fill slots that React Query hasn't already populated with
        // fresh network data (avoids clobbering an online fetch that wins the race).
        if (queryClient.getQueryData(queryKey) === undefined) {
          queryClient.setQueryData(queryKey, data);
          count++;
        }
      } catch {
        // Malformed key — skip silently
      }
    }
    if (count > 0) {
      console.log(`[OfflineCache] Hydrated ${count} cached quer${count === 1 ? "y" : "ies"} from IndexedDB`);
    }
  } catch (err) {
    console.warn("[OfflineCache] Hydration failed:", err);
  }
})();
