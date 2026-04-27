import { createContext, useContext, useState, type ReactNode } from "react";

export type Portal = "teacher" | "admin";

interface PortalContextValue {
  activePortal: Portal;
  setActivePortal: (portal: Portal) => void;
}

const PortalContext = createContext<PortalContextValue>({
  activePortal: "teacher",
  setActivePortal: () => {},
});

export function PortalProvider({ children }: { children: ReactNode }) {
  const [activePortal, setActivePortal] = useState<Portal>(
    () => (localStorage.getItem("activePortal") as Portal) || "teacher"
  );

  const handleSetPortal = (portal: Portal) => {
    setActivePortal(portal);
    localStorage.setItem("activePortal", portal);
    localStorage.setItem("last_portal", portal === "admin" ? "/admin" : "/teacher");
  };

  return (
    <PortalContext.Provider value={{ activePortal, setActivePortal: handleSetPortal }}>
      {children}
    </PortalContext.Provider>
  );
}

export const usePortal = () => useContext(PortalContext);
