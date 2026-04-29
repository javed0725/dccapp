import { SiFacebook } from "react-icons/si";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import coachingLogo from "@assets/IMG_20260126_081644_1769393818079.jpg";

export function FloatingPortalButtons() {
  return (
    <div
      className="fixed right-4 z-[250] flex flex-col items-center gap-3"
      style={{ bottom: "calc(84px + env(safe-area-inset-bottom, 0px) + 12px)" }}
    >
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
    </div>
  );
}
