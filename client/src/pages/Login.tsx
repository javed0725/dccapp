import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Shield, Lock, User as UserIcon, GraduationCap, ChevronLeft, ArrowRight, Sparkles, Eye, EyeOff } from "lucide-react";
import coachingLogo from "@assets/IMG_20260126_081644_1769393818079.jpg";
import { type User } from "@/lib/schemas";

type LoginRole = "admin" | "teacher" | "student";

const roleDetails: Record<LoginRole, { label: string; title: string; description: string; icon: typeof Shield; color: string; path: string }> = {
  teacher: {
    label: "Teacher",
    title: "Teacher Login",
    description: "Access class management, admissions, payments, and result entry.",
    icon: UserIcon,
    color: "bg-blue-50 text-blue-600",
    path: "/teacher",
  },
  admin: {
    label: "Authority",
    title: "Authority Login",
    description: "Access the core dashboard, reports, teacher management, and notifications.",
    icon: Shield,
    color: "bg-indigo-50 text-indigo-600",
    path: "/admin",
  },
  student: {
    label: "Student",
    title: "Student Login",
    description: "Access your payment history, account status, and published results.",
    icon: GraduationCap,
    color: "bg-purple-50 text-purple-600",
    path: "/student",
  },
};

function getRedirectPath(role: string): string {
  if (role === "admin") return "/admin";
  if (role === "teacher") return "/teacher";
  if (role === "student") return "/student";
  return "/"; // fallback
}

export default function LoginPage({ fixedRole }: { fixedRole?: LoginRole }) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [role, setRole] = useState<LoginRole | null>(fixedRole ?? null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const selectedRole = fixedRole ?? role;
  const selectedRoleDetails = selectedRole ? roleDetails[selectedRole] : null;

  const loginMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/login", data);
      return res.json();
    },
    onSuccess: async (user: User) => {
      if (user.role === "deactivated") {
        await apiRequest("POST", "/api/logout").catch(() => undefined);
        queryClient.setQueryData(["/api/user"], null);
        toast({
          variant: "destructive",
          title: "Account deactivated",
          description: "Your account has been deactivated. Please contact the administrator.",
        });
        return;
      }

      const validRole = user.role as LoginRole;
      if (fixedRole && validRole !== fixedRole) {
        await apiRequest("POST", "/api/logout").catch(() => undefined);
        queryClient.setQueryData(["/api/user"], null);
        const correctLabel = roleDetails[validRole]?.label ?? user.role;
        toast({
          variant: "destructive",
          title: "Wrong login page",
          description: `Please use the ${correctLabel} login page for this account.`,
        });
        return;
      }

      const redirectPath = getRedirectPath(user.role);
      localStorage.setItem("last_portal", redirectPath);
      // Authority teachers always start in Teacher portal; clear any previous admin mode
      if (user.isAuthority) {
        localStorage.setItem("activePortal", "teacher");
      } else {
        localStorage.removeItem("activePortal");
      }
      queryClient.setQueryData(["/api/user"], user);
      setLocation(redirectPath);
      toast({ title: "Logged in successfully" });
    },
    onError: (error: Error) => {
      toast({ variant: "destructive", title: "Login failed", description: error.message });
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loginMutation.mutate({ username, password });
  };

  return (
    <div className="min-h-screen relative flex flex-col items-center justify-center bg-[#F8FAFC] selection:bg-indigo-500/30">
      {/* Premium Background Effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-600/5 blur-[120px] rounded-full animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-600/5 blur-[120px] rounded-full animate-pulse" style={{ animationDelay: '2s' }} />
      </div>

      <div className="w-full max-w-xl relative z-10 px-6 space-y-8 py-10 pb-16">
        {/* Branding Section */}
        <div className="text-center space-y-6 animate-in fade-in slide-in-from-top-4 duration-1000">
          <div className="inline-flex relative group">
            <div className="absolute -inset-1 bg-primary/20 rounded-3xl blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200" />
            <div className="relative flex items-center justify-center w-24 h-24 rounded-3xl bg-white border border-primary/10 shadow-xl overflow-hidden p-2">
              <img src={coachingLogo} alt="Coaching Logo" className="w-full h-full object-contain" />
            </div>
          </div>
          <div className="space-y-2">
            <h1 className="text-4xl md:text-5xl font-black tracking-tight text-primary font-display">
              Dynamic Coaching Center
            </h1>
            <p className="text-slate-500 text-sm font-bold uppercase tracking-[0.3em] flex items-center justify-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" /> Come to Learn, Leave to Shine
            </p>
          </div>
        </div>

        {!selectedRole ? (
          /* Role Selection Cards */
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-300">
            {Object.entries(roleDetails).map(([id, item]) => (
              <button
                key={id}
                data-testid={`button-login-${id}`}
                onClick={() => setLocation(item.path)}
                className="group relative flex flex-col items-center text-center p-5 rounded-[1.5rem] bg-white border border-primary/5 shadow-sm hover:shadow-md hover:border-primary/20 transition-all duration-500"
              >
                <div className={`p-3 rounded-xl ${item.color} mb-4 group-hover:scale-110 transition-all duration-500`}>
                  <item.icon className="w-6 h-6" />
                </div>
                <h3 className="text-base font-bold text-slate-900 mb-1 tracking-tight">{item.label}</h3>
                <p className="text-xs text-slate-500 font-medium leading-relaxed">{item.description}</p>
                <div className="absolute bottom-4 opacity-0 group-hover:opacity-100 transform translate-y-2 group-hover:translate-y-0 transition-all duration-500 text-primary">
                  <ArrowRight className="w-4 h-4" />
                </div>
              </button>
            ))}
          </div>
        ) : (
          /* Premium Login Card */
          <div className="max-w-md mx-auto w-full animate-in fade-in slide-in-from-bottom-8 duration-700">
            <div className="relative group">
              <div className="absolute -inset-0.5 bg-primary/10 rounded-[2.5rem] blur opacity-20 group-hover:opacity-40 transition duration-1000" />
              <Card className="relative bg-white border-primary/10 rounded-[2.5rem] shadow-xl overflow-hidden">
                <CardContent className="p-10">
                  {!fixedRole && (
                    <Button
                      data-testid="button-login-back"
                      variant="ghost"
                      size="sm"
                      onClick={() => setRole(null)}
                      className="mb-8 -ml-2 text-slate-400 hover:text-slate-900 hover:bg-slate-50 font-bold text-xs tracking-widest"
                    >
                      <ChevronLeft className="w-4 h-4 mr-2" /> BACK
                    </Button>
                  )}

                  <div className="mb-10 space-y-2">
                    <h2 className="text-2xl font-black text-slate-900 flex items-center gap-3 uppercase">
                      <span className="p-2 rounded-xl bg-primary/5 border border-primary/10 text-primary">
                        {selectedRoleDetails && <selectedRoleDetails.icon className="w-5 h-5" />}
                      </span>
                      {selectedRoleDetails?.title}
                    </h2>
                    <p className="text-slate-500 text-sm font-medium">{selectedRoleDetails?.description}</p>
                  </div>

                  <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="space-y-2">
                      <Label htmlFor={`username-${selectedRole}`} className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 ml-1">Identity</Label>
                      <div className="relative group/input">
                        <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within/input:text-primary transition-colors" />
                        <Input
                          id={`username-${selectedRole}`}
                          data-testid={`input-username-${selectedRole}`}
                          autoComplete="username"
                          placeholder="Username"
                          className="pl-12 h-14 bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-400 focus:border-primary/50 focus:ring-primary/10 rounded-2xl transition-all"
                          value={username}
                          onChange={(e) => setUsername(e.target.value)}
                          required
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`password-${selectedRole}`} className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 ml-1">Password</Label>
                      <div className="relative group/input">
                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within/input:text-primary transition-colors" />
                        <Input
                          id={`password-${selectedRole}`}
                          data-testid={`input-password-${selectedRole}`}
                          autoComplete="current-password"
                          type={showPassword ? "text" : "password"}
                          placeholder="••••••••"
                          className="pl-12 pr-12 h-14 bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-400 focus:border-primary/50 focus:ring-primary/10 rounded-2xl transition-all"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          required
                        />
                        <button
                          type="button"
                          data-testid={`button-toggle-password-${selectedRole}`}
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-primary transition-colors focus:outline-none"
                        >
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                    <Button
                      type="submit"
                      data-testid={`button-submit-login-${selectedRole}`}
                      className="w-full h-14 bg-primary hover:bg-primary/90 text-white font-bold rounded-2xl shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 transition-all duration-300"
                      disabled={loginMutation.isPending}
                    >
                      {loginMutation.isPending ? "AUTHENTICATING..." : "Login"}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </div>

      {/* Footer Branding */}
      <div className="relative z-10 w-full text-center pb-8 animate-in fade-in duration-1000 delay-700">
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.4em]">
          Powered by DCC © 2026
        </p>
      </div>
    </div>
  );
}
