import { Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarFooter, SidebarHeader } from "@/components/ui/sidebar";
import { LayoutDashboard, Wallet, Receipt, Settings, LogOut, FileCheck, Home, Bell } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation, Link } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { type User } from "@/lib/schemas";
import coachingLogo from "@assets/IMG_20260126_081644_1769393818079.jpg";

export function AppSidebar() {
  const { data: user } = useQuery<User>({ queryKey: ["/api/user"] });
  const [location] = useLocation();
  const [, setLocation] = useLocation();

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/logout");
    },
    onSuccess: () => {
      const loginPath = user?.role === "teacher" ? "/teacher" : user?.role === "admin" ? "/admin" : "/student";
      queryClient.setQueryData(["/api/user"], null);
      setLocation(loginPath);
    }
  });

  const { data: unreadData } = useQuery<{ count: number }>({
    queryKey: ["/api/notifications/unread-count"],
    enabled: user?.role === "admin",
    refetchInterval: 30000,
  });
  const unreadCount = unreadData?.count ?? 0;

  const menuItems = [
    { title: "Home", url: "/", icon: LayoutDashboard, roles: ["admin"] },
    { title: "Home", url: "/admission", icon: Home, roles: ["teacher"] },
    { title: "Payment", url: "/income", icon: Wallet, roles: ["teacher", "admin"] },
    { title: "Results", url: "/results", icon: FileCheck, roles: ["teacher", "student"] },
    { title: "Expenses", url: "/expenses", icon: Receipt, roles: ["admin"] },
    { title: "Manage", url: "/manage", icon: Settings, roles: ["admin"] },
    { title: "Notifications", url: "/notifications", icon: Bell, roles: ["admin"] },
  ].filter(item => user && item.roles.includes(user.role));

  return (
    <Sidebar className="border-r border-border/40 shadow-2xl bg-white/95 backdrop-blur-xl z-[110] h-[calc(100svh-80px)] max-h-[calc(100svh-80px)] overflow-hidden">
      <SidebarHeader className="px-5 py-6 flex flex-col items-center justify-center text-center border-b border-border/30">
        <div className="bg-white p-1.5 rounded-xl shadow-md w-14 h-14 overflow-hidden shrink-0 border border-primary/10 mb-3">
          <img src={coachingLogo} alt="Logo" className="w-full h-full object-contain" />
        </div>
        <div className="flex flex-col leading-tight items-center">
          <span className="text-sm font-black text-primary font-display tracking-tight uppercase">Dynamic Coaching</span>
          <span className="text-[10px] text-muted-foreground uppercase tracking-[0.3em] font-bold mt-0.5">Center</span>
        </div>
      </SidebarHeader>
      
      <SidebarContent className="px-3 py-4 overflow-y-auto">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-1">
              {menuItems.map((item) => {
                const isActive = location === item.url;
                const showBadge = item.url === "/notifications" && unreadCount > 0;
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={isActive} size="lg" className={`
                      transition-all duration-300 rounded-xl px-4 h-11
                      ${isActive 
                        ? "bg-primary text-white shadow-lg shadow-primary/30 hover:bg-primary" 
                        : "hover:bg-primary/5 text-primary/80 hover:text-primary font-bold"
                      }
                    `}>
                      <Link href={item.url} className="flex items-center gap-3 w-full h-full">
                        <div className="relative">
                          <item.icon className={`w-5 h-5 ${isActive ? "text-white" : "text-primary"}`} />
                          {showBadge && (
                            <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 text-white text-[9px] font-black rounded-full flex items-center justify-center">
                              {unreadCount > 9 ? "9+" : unreadCount}
                            </span>
                          )}
                        </div>
                        <span className="text-sm tracking-wide flex-1">{item.title}</span>
                        {showBadge && (
                          <span className="ml-auto bg-red-500 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full leading-none">
                            {unreadCount}
                          </span>
                        )}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-4 mt-auto border-t border-border/40 shrink-0">
        <div className="bg-slate-50/80 p-3 rounded-2xl flex flex-col gap-3 border border-border/50 shadow-inner">
          <div className="flex items-center gap-3 px-1">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm shrink-0">
              {user?.username?.charAt(0).toUpperCase()}
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-bold text-primary truncate">{user?.username}</span>
              <span className="text-[9px] text-muted-foreground uppercase font-black tracking-widest">{user?.role}</span>
            </div>
          </div>
          <Button 
            variant="destructive" 
            size="sm"
            onClick={() => logoutMutation.mutate()}
            disabled={logoutMutation.isPending}
            className="w-full rounded-xl h-9 font-black uppercase tracking-widest shadow-lg shadow-destructive/20 flex items-center justify-center gap-2 text-xs"
          >
            <LogOut className="w-4 h-4" />
            <span>Logout</span>
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
