import { Switch, Route, Redirect, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Dashboard from "@/pages/Dashboard";
import Income from "@/pages/Income";
import Admission from "@/pages/Admission";
import Expenses from "@/pages/Expenses";
import ManageData from "@/pages/ManageData";
import EntryMarks from "@/pages/EntryMarks";
import Marksheet from "@/pages/Marksheet";
import LoginPage from "@/pages/Login";
import Notifications from "@/pages/Notifications";
import NotFound from "@/pages/not-found";
import LandingPage from "@/pages/LandingPage";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { type User } from "@/lib/schemas";
import { Bell } from "lucide-react";

function NotificationHeader({ user }: { user: User }) {
  const [, setLocation] = useLocation();
  const { data: unreadData } = useQuery<{ count: number }>({
    queryKey: ["/api/notifications/unread-count"],
    enabled: user?.role === "admin",
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
      {user?.role === "admin" && (
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
    </header>
  );
}

function Router() {
  const { data: user, isLoading } = useQuery<User>({ 
    queryKey: ["/api/user"],
    retry: false
  });
  const [location] = useLocation();
  const roleHomePath = user?.role === "teacher" ? "/admission" : "/";

  if (isLoading) return null;

  if (!user) {
    return (
      <Switch>
        <Route path="/" component={LandingPage} />
        <Route path="/student">
          <LoginPage fixedRole="student" />
        </Route>
        <Route path="/teacher">
          <LoginPage fixedRole="teacher" />
        </Route>
        <Route path="/admin">
          <LoginPage fixedRole="admin" />
        </Route>
        <Route path="/login" component={LoginPage} />
        <Route>
          <Redirect to="/" />
        </Route>
      </Switch>
    );
  }

  return (
    <SidebarProvider defaultOpen={false}>
      <div className="flex h-svh w-full overflow-hidden bg-background">
        <AppSidebar />
        <div className="flex flex-col flex-1 overflow-hidden relative">
          <NotificationHeader user={user} />

          <main className="flex-1 overflow-auto bg-muted/30 px-2 py-3 md:p-6 pb-28 md:pb-28 w-full">
            <Switch>
              {user.role === 'admin' ? (
                <Route path="/" component={Dashboard} />
              ) : user.role === 'student' ? (
                <Route path="/" component={Dashboard} />
              ) : (
                <Route path="/">
                  <Redirect to="/admission" />
                </Route>
              )}
              <Route path="/income" component={Income} />
              <Route path="/results" component={EntryMarks} />
              <Route path="/marksheet" component={Marksheet} />
              <Route path="/admission">
                {user.role === 'teacher' ? <Admission /> : <Redirect to="/" />}
              </Route>
              {user.role === 'admin' && (
                <>
                  <Route path="/expenses" component={Expenses} />
                  <Route path="/manage" component={ManageData} />
                  <Route path="/notifications" component={Notifications} />
                </>
              )}
              <Route path="/login">
                <Redirect to={roleHomePath} />
              </Route>
              <Route path="/student">
                <Redirect to={roleHomePath} />
              </Route>
              <Route path="/teacher">
                <Redirect to={roleHomePath} />
              </Route>
              <Route path="/admin">
                <Redirect to={roleHomePath} />
              </Route>
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
      <TooltipProvider>
        <Router />
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}
