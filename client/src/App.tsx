import { Switch, Route, Redirect, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Dashboard from "@/pages/Dashboard";
import Income from "@/pages/Income";
import Admission from "@/pages/Admission";
import Expenses from "@/pages/Expenses";
import Deposits from "@/pages/Deposits";
import ManageData from "@/pages/ManageData";
import EntryMarks from "@/pages/EntryMarks";
import Attendance from "@/pages/Attendance";
import Marksheet from "@/pages/Marksheet";
import LoginPage from "@/pages/Login";
import Notifications from "@/pages/Notifications";
import NotFound from "@/pages/not-found";
import LandingPage from "@/pages/LandingPage";
import TeacherDirectory from "@/pages/TeacherDirectory";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { type User } from "@/lib/schemas";
import { Bell } from "lucide-react";
import { PortalProvider, usePortal } from "@/lib/portal-context";
import { NetworkStatus } from "@/components/NetworkStatus";

function NotificationHeader({ effectiveRole }: { effectiveRole: string }) {
  const [, setLocation] = useLocation();
  const isAdmin = effectiveRole === "admin";
  const { data: unreadData } = useQuery<{ count: number }>({
    queryKey: ["/api/notifications/unread-count"],
    enabled: isAdmin,
    refetchInterval: 30000,
  });
  const unreadCount = unreadData?.count ?? 0;

  return (
    <header className="flex items-center justify-between px-4 h-16 shrink-0 bg-white backdrop-blur-md border-b z-20">
      <div className="flex items-center gap-4">
        <SidebarTrigger data-testid="button-sidebar-toggle" className="md:flex" />
        <div className="font-display font-black text-primary truncate tracking-tight hidden sm:block text-xl uppercase">
          Dynamic Coaching Center
        </div>
      </div>
      <div className="flex items-center gap-2">
        <NetworkStatus />
        {isAdmin && (
          <button
            data-testid="button-notification-bell"
            onClick={() => setLocation("/notifications")}
            className="relative p-2 rounded-xl hover:bg-primary/5 transition-colors"
          >
            <Bell className="w-6 h-6 text-primary" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[9px] font-black rounded-full flex items-center justify-center">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </button>
        )}
      </div>
    </header>
  );
}

/**
 * Determines which portal login to redirect to when a user is unauthenticated.
 * Priority: URL path prefix → localStorage last_portal → landing page.
 */
function getPortalLoginPath(currentPath: string): string {
  if (currentPath.startsWith("/student")) return "/student";
  if (currentPath.startsWith("/teacher")) return "/teacher";
  if (currentPath.startsWith("/admin")) return "/admin";
  const lastPortal = localStorage.getItem("last_portal");
  if (lastPortal && ["/student", "/teacher", "/admin"].includes(lastPortal)) return lastPortal;
  return "/";
}

function PortalAwareRedirect() {
  const [location] = useLocation();
  return <Redirect to={getPortalLoginPath(location)} />;
}

/**
 * Returns the portal this browser/PWA is locked into, or null for first-time
 * visitors who can still see the public landing page. Lock-in is established
 * when the user installs the PWA with a preferred route or visits any portal
 * login page (Login.tsx writes `last_portal` on mount).
 */
function getLockedPortal(): string | null {
  const isStandalone =
    typeof window !== "undefined" &&
    (window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true);
  if (isStandalone) {
    const preferred = localStorage.getItem("pwa_preferred_route");
    if (preferred && ["/student", "/teacher", "/admin"].includes(preferred)) {
      return preferred;
    }
  }
  const lastPortal = localStorage.getItem("last_portal");
  if (lastPortal && ["/student", "/teacher", "/admin"].includes(lastPortal)) {
    return lastPortal;
  }
  return null;
}

/**
 * Root ("/") route. The landing page is reachable ONLY when the user
 * intentionally navigated there (the floating logo button sets a session
 * flag before navigating to "/"). On any other entry to "/" — fresh PWA
 * launch, direct URL, browser refresh in a new tab — we send the user to
 * the portal login page their app context is bound to.
 *
 * First-time visitors with no portal binding still see the public landing
 * page (there's nowhere else for them to go).
 */
function RootRoute() {
  if (typeof window !== "undefined") {
    const intent = sessionStorage.getItem("intent_landing");
    if (!intent) {
      const locked = getLockedPortal();
      if (locked) return <Redirect to={locked} />;
    }
  }
  return <LandingPage />;
}

function Router() {
  const { data: user, isLoading } = useQuery<User>({
    queryKey: ["/api/user"],
    retry: false,
  });
  const [location] = useLocation();
  const { activePortal } = usePortal();

  // Authority teachers can act as admin when they've switched to the admin portal
  const effectiveRole: string =
    user?.isAuthority && activePortal === "admin" ? "admin" : (user?.role ?? "");

  // Root ("/") is a NEUTRAL public zone — always show the landing page,
  // regardless of auth state. This must run before any auth/role redirects
  // so logged-in users can manually navigate back to "/" and stay there.
  if (location === "/") {
    return <RootRoute />;
  }

  // Home path based on effective role
  const roleHomePath =
    effectiveRole === "admin" ? "/admin" :
    effectiveRole === "teacher" ? "/teacher" :
    effectiveRole === "student" ? "/student" : "/";

  // During auth check, show public pages immediately — no blank screen
  if (isLoading) {
    return (
      <Switch>
        <Route path="/" component={RootRoute} />
        <Route path="/student"><LoginPage fixedRole="student" /></Route>
        <Route path="/teacher"><LoginPage fixedRole="teacher" /></Route>
        <Route path="/admin"><LoginPage fixedRole="admin" /></Route>
        <Route path="/login" component={LoginPage} />
        <Route>
          <div className="min-h-screen flex items-center justify-center bg-white">
            <div className="w-8 h-8 border-2 border-sky-600 border-t-transparent rounded-full animate-spin" />
          </div>
        </Route>
      </Switch>
    );
  }

  if (!user) {
    return (
      <Switch>
        <Route path="/" component={RootRoute} />
        <Route path="/student"><LoginPage fixedRole="student" /></Route>
        <Route path="/teacher"><LoginPage fixedRole="teacher" /></Route>
        <Route path="/admin"><LoginPage fixedRole="admin" /></Route>
        <Route path="/login" component={LoginPage} />
        <Route><PortalAwareRedirect /></Route>
      </Switch>
    );
  }

  return (
    <SidebarProvider defaultOpen={false}>
      <div className="flex h-svh w-full overflow-hidden bg-background">
        <AppSidebar effectiveRole={effectiveRole} />
        <div className="flex flex-col flex-1 overflow-hidden relative">
          <NotificationHeader effectiveRole={effectiveRole} />

          <main className="flex-1 overflow-auto bg-muted/30 px-2 py-3 md:p-6 pb-28 md:pb-28 w-full">
            <Switch>
              {/* Root redirect based on effective role */}
              {effectiveRole === "admin" ? (
                <Route path="/" component={Dashboard} />
              ) : effectiveRole === "student" ? (
                <Route path="/" component={Dashboard} />
              ) : (
                <Route path="/"><Redirect to="/teacher" /></Route>
              )}

              {/* Role-specific entry points */}
              <Route path="/admin">
                {effectiveRole === "admin" ? <Dashboard /> : <Redirect to={roleHomePath} />}
              </Route>
              <Route path="/student">
                {effectiveRole === "student" ? <Dashboard /> : <Redirect to={roleHomePath} />}
              </Route>
              <Route path="/teacher">
                {(effectiveRole === "teacher" || (user.isAuthority && activePortal === "teacher")) ? <Admission /> : <Redirect to={roleHomePath} />}
              </Route>

              {effectiveRole === "student" && (
                <Route path="/teachers" component={TeacherDirectory} />
              )}
              <Route path="/income" component={Income} />
              <Route path="/results" component={EntryMarks} />
              {(effectiveRole === "teacher" || effectiveRole === "admin") && (
                <Route path="/attendance" component={Attendance} />
              )}
              <Route path="/marksheet" component={Marksheet} />
              <Route path="/admission">
                {(effectiveRole === "teacher" || (user.isAuthority && activePortal === "teacher")) ? <Admission /> : <Redirect to={roleHomePath} />}
              </Route>
              {effectiveRole === "admin" && (
                <>
                  <Route path="/expenses" component={Expenses} />
                  <Route path="/deposits" component={Deposits} />
                  <Route path="/manage" component={ManageData} />
                  <Route path="/notifications" component={Notifications} />
                </>
              )}
              <Route path="/login"><Redirect to={roleHomePath} /></Route>
              <Route component={NotFound} />
            </Switch>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <PortalProvider>
        <TooltipProvider>
          <Router />
          <Toaster />
        </TooltipProvider>
      </PortalProvider>
    </QueryClientProvider>
  );
}
