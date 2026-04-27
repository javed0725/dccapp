import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";

const SESSION_EXPIRED_FALLBACK =
  "Your session has expired. Please log in again.";

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

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
