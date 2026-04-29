import { Link, useLocation } from "wouter";
import { Wallet, FileText, Key, LogOut, UserCircle, LayoutDashboard, Home, Banknote, Settings, BookUser, ClipboardCheck } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { type User } from "@/lib/schemas";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from "@/components/ui/dropdown-menu";

export function Navigation() {
  return null; // Sidebar entirely removed
}

export function MobileNav() {
  const [location] = useLocation();
  const { data: user } = useQuery<User>({ queryKey: ["/api/user"] });
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const { toast } = useToast();

  const passwordMutation = useMutation({
    mutationFn: async (newPassword: string) => {
      await apiRequest("PATCH", "/api/user/password", { password: newPassword });
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Password updated successfully" });
      setOpen(false);
      setPassword("");
    },
    onError: (error: any) => {
      toast({ variant: "destructive", title: "Error", description: error.message || "Failed to update password" });
    }
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/logout");
    },
    onSuccess: () => {
      window.location.href = "/auth";
    },
  });

  if (!user) return null;

  const adminLinks = [
    { href: "/admin", label: "Home", icon: Home },
    { href: "/income", label: "Payment", icon: Wallet },
    { href: "/results", label: "Results", icon: FileText },
    { href: "/attendance", label: "Attendance", icon: ClipboardCheck },
    { href: "/expenses", label: "Expenses", icon: Banknote },
    { href: "/manage", label: "Manage", icon: Settings },
  ];

  const teacherLinks = [
    { href: "/admission", label: "Home", icon: Home },
    { href: "/income", label: "Payment", icon: Wallet },
    { href: "/results", label: "Results", icon: FileText },
    { href: "/attendance", label: "Attendance", icon: ClipboardCheck },
  ];

  const studentLinks = [
    { href: "/student", label: "Home", icon: LayoutDashboard },
    { href: "/results", label: "Results", icon: FileText },
    { href: "/teachers", label: "Teachers", icon: BookUser },
  ];

  const links = user.role === "admin" ? adminLinks : 
                user.role === "teacher" ? teacherLinks : 
                studentLinks;

  return (
    /* Outer wrapper: creates safe-area space at bottom so content isn't hidden */
    <div className="h-[84px] shrink-0" aria-hidden="true">
      <nav className="fixed bottom-4 left-4 right-4 z-[300]">
        <div
          className="flex justify-around items-center px-3 h-[60px] rounded-[24px]"
          style={{
            background: "rgba(255,255,255,0.82)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            boxShadow: "0 8px 32px rgba(0,0,0,0.13), 0 1.5px 6px rgba(0,0,0,0.07), inset 0 1px 0 rgba(255,255,255,0.7)",
            border: "1px solid rgba(255,255,255,0.5)",
          }}
        >
          {links.map((link) => {
            const isActive = location === link.href;
            const Icon = link.icon;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`
                  flex flex-col items-center justify-center gap-0.5 px-3 py-1.5 rounded-2xl transition-all duration-200 flex-1
                  ${isActive
                    ? "text-primary"
                    : "text-slate-400 hover:text-slate-600"
                  }
                `}
              >
                <div className={`relative transition-all duration-200 ${isActive ? "scale-110" : ""}`}>
                  {isActive && (
                    <span className="absolute inset-0 rounded-full bg-primary/10 scale-[2] -z-10" />
                  )}
                  <Icon className="w-5 h-5" strokeWidth={isActive ? 2.5 : 1.8} />
                </div>
                <span className={`text-[9px] font-bold uppercase tracking-wide transition-all ${isActive ? "opacity-100" : "opacity-70"}`}>
                  {link.label}
                </span>
              </Link>
            );
          })}

          {user.role !== "admin" && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex flex-col items-center justify-center gap-0.5 px-3 py-1.5 rounded-2xl text-slate-400 hover:text-slate-600 transition-all duration-200 flex-1 outline-none">
                  <UserCircle className="w-5 h-5" strokeWidth={1.8} />
                  <span className="text-[9px] font-bold uppercase tracking-wide opacity-70">Account</span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                side="top"
                className="w-56 mb-3 rounded-2xl p-2 shadow-xl border-border bg-popover"
                style={{ zIndex: 400 }}
              >
                <Dialog open={open} onOpenChange={setOpen}>
                  <DialogTrigger asChild>
                    <DropdownMenuItem
                      onSelect={(e) => e.preventDefault()}
                      className="gap-3 cursor-pointer py-3 rounded-xl focus:bg-secondary transition-colors font-medium"
                    >
                      <Key className="w-4 h-4 text-primary" />
                      <span>Change Password</span>
                    </DropdownMenuItem>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-md rounded-[2rem] border-none p-0 overflow-hidden shadow-2xl" style={{ zIndex: 500 }}>
                    <div className="p-8 space-y-8">
                      <DialogHeader>
                        <DialogTitle className="text-2xl font-black text-[#1E293B] uppercase tracking-tight">Update Password</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-6">
                        <div className="space-y-3">
                          <Label htmlFor="password_mobile" className="text-[10px] font-bold uppercase tracking-widest text-[#64748B] ml-1">New Password</Label>
                          <Input
                            id="password_mobile"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Min 6 characters"
                            className="h-14 rounded-2xl border-[#E2E8F0] bg-[#F8FAFC] text-[#1E293B] placeholder:text-[#94A3B8] focus:ring-2 focus:ring-[#4F46E5]/10 focus:border-[#4F46E5] transition-all"
                          />
                        </div>
                        <Button
                          className="w-full h-14 bg-[#4F46E5] hover:bg-[#4338CA] text-white rounded-2xl font-bold text-sm uppercase tracking-widest transition-all active:scale-95 disabled:opacity-50 shadow-lg shadow-indigo-100"
                          onClick={() => passwordMutation.mutate(password)}
                          disabled={passwordMutation.isPending || password.length < 6}
                        >
                          {passwordMutation.isPending ? "Updating..." : "Establish New Secret"}
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
                <DropdownMenuSeparator className="my-2" />
                <DropdownMenuItem
                  onClick={() => logoutMutation.mutate()}
                  className="gap-3 cursor-pointer py-3 rounded-xl text-destructive focus:text-destructive focus:bg-destructive/5 transition-colors font-medium"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Logout</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </nav>
    </div>
  );
}
