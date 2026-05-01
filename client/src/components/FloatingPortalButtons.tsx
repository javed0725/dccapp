import { SiFacebook } from "react-icons/si";
import { ArrowLeftRight, GraduationCap, ShieldCheck } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { usePortal } from "@/lib/portal-context";
import { type User } from "@/lib/schemas";
import coachingLogo from "@assets/IMG_20260126_081644_1769393818079.jpg";

export function FloatingPortalButtons() {
  const { data: user } = useQuery<User>({ queryKey: ["/api/user"] });
  const [, setLocation] = useLocation();
  const { activePortal } = usePortal();

  const isAuthorityTeacher = user?.isAuthority && user?.role === "teacher";
  const inAdminMode = isAuthorityTeacher && activePortal === "admin";
  const inAuthorityPortal = user?.role === "admin" || inAdminMode;
  const showSwitchFab = isAuthorityTeacher || inAuthorityPortal;

  const isTeacherOrStudent = user?.role === "teacher" || user?.role === "student";

  const switchPortalMutation = useMutation({
    mutationFn: async (target: "teacher" | "admin") => {
      await apiRequest("POST", "/api/logout");
      return target;
    },
    onSuccess: (target) => {
      const targetLoginPath = target === "admin" ? "/admin" : "/teacher";
      localStorage.setItem("last_portal", targetLoginPath);
      localStorage.removeItem("activePortal");
      queryClient.clear();
      setLocation(targetLoginPath);
    },
  });

  function handleSwitchPortal() {
    const target: "teacher" | "admin" = inAuthorityPortal ? "teacher" : "admin";
    switchPortalMutation.mutate(target);
  }

  if (!isTeacherOrStudent && !showSwitchFab) return null;

  return (
    <div
      className="fixed right-4 z-[250] flex flex-col items-center gap-3"
      style={{ bottom: "calc(84px + env(safe-area-inset-bottom, 0px) + 12px)" }}
    >
      {showSwitchFab && (
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              data-testid="button-floating-switch-portal"
              aria-label={inAuthorityPortal ? "Switch to Teacher" : "Switch to Authority"}
              onClick={handleSwitchPortal}
              disabled={switchPortalMutation.isPending}
              className="w-12 h-12 rounded-full bg-indigo-600 text-white flex items-center justify-center shadow-lg shadow-indigo-500/40 hover:scale-110 active:scale-95 transition-transform duration-200 ring-1 ring-black/5 disabled:opacity-60 disabled:pointer-events-none"
            >
              {inAuthorityPortal
                ? <GraduationCap className="w-5 h-5" />
                : <ShieldCheck className="w-5 h-5" />
              }
            </button>
          </TooltipTrigger>
          <TooltipContent side="left" className="font-bold">
            {inAuthorityPortal ? "Switch to Teacher" : "Switch to Authority"}
          </TooltipContent>
        </Tooltip>
      )}

      {isTeacherOrStudent && (
        <>
          <Tooltip>
            <TooltipTrigger asChild>
              <a
                href="https://www.facebook.com/dcoachingcenter"
                target="_blank"
                rel="noopener noreferrer"
                data-testid="button-floating-facebook"
                aria-label="Facebook Page"
                className="w-12 h-12 rounded-full bg-[#1877F2] text-white flex items-center justify-center shadow-lg shadow-black/25 hover:scale-110 active:scale-95 transition-transform duration-200 ring-1 ring-black/5"
              >
                <SiFacebook className="w-6 h-6" />
              </a>
            </TooltipTrigger>
            <TooltipContent side="left" className="font-bold">
              Facebook Page
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => {
                  sessionStorage.setItem("intent_landing", "1");
                  window.location.href = "/";
                }}
                data-testid="button-floating-website"
                aria-label="Visit Website"
                className="w-12 h-12 rounded-full bg-white p-1.5 flex items-center justify-center shadow-lg shadow-black/25 hover:scale-110 active:scale-95 transition-transform duration-200 ring-1 ring-black/10 overflow-hidden"
              >
                <img
                  src={coachingLogo}
                  alt="Visit Website"
                  className="w-full h-full object-contain rounded-full"
                />
              </button>
            </TooltipTrigger>
            <TooltipContent side="left" className="font-bold">
              Visit Website
            </TooltipContent>
          </Tooltip>
        </>
      )}
    </div>
  );
}
