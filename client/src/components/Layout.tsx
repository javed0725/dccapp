import { ReactNode } from "react";
import { MobileNav } from "./Navigation";
import { FloatingPortalButtons } from "./FloatingPortalButtons";
import { useQuery } from "@tanstack/react-query";
import { type User } from "@/lib/schemas";

interface LayoutProps {
  children: ReactNode;
  title: string;
  subtitle?: string;
  action?: ReactNode;
}

export function Layout({ children, title, subtitle, action }: LayoutProps) {
  const { data: user } = useQuery<User>({ queryKey: ["/api/user"] });
  const showFloatingButtons = user?.role === "teacher" || user?.role === "student";

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <main className="flex-1 flex flex-col min-w-0 bg-background relative w-full">
        <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-md border-b border-border/50 px-6 py-4 flex items-center justify-between shrink-0 w-full">
          <div>
            <h1 className="text-2xl font-bold font-display text-foreground">{title}</h1>
            {subtitle && <p className="text-muted-foreground text-sm mt-0.5">{subtitle}</p>}
          </div>
          {action && <div>{action}</div>}
        </header>

        {/* pb-28 ensures content never hides behind the floating bottom bar */}
        <div className="flex-1 px-1 py-3 md:p-4 pb-28 w-full animate-in fade-in duration-500 slide-in-from-bottom-4">
          <div className="w-full">
            {children}
          </div>
        </div>
      </main>

      {showFloatingButtons && <FloatingPortalButtons />}
      <MobileNav />
    </div>
  );
}
