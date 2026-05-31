import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// ── Network diagnostic logger ─────────────────────────────────────────────────
// Captures connectivity failures (ERR_CONNECTION_TIMED_OUT, ERR_NAME_NOT_RESOLVED,
// "Failed to fetch", our own AbortError timeouts) and logs them with ISP/network
// context so we can identify Robi / Teletalk / Airtel-specific routing issues.
if (typeof window !== "undefined") {
  const netInfo = () => {
    const conn = (navigator as any).connection;
    return conn
      ? `type=${conn.effectiveType} rtt=${conn.rtt}ms downlink=${conn.downlink}Mbps`
      : "Network Information API unavailable";
  };

  // Catch unhandled promise rejections from fetch/timeout
  window.addEventListener("unhandledrejection", (event) => {
    const err = event.reason;
    if (!(err instanceof Error)) return;
    const isNetworkIssue =
      err.name === "AbortError" ||
      err.name === "TypeError" ||
      err.message.includes("timed out") ||
      err.message.includes("Failed to fetch") ||
      err.message.includes("NetworkError") ||
      err.message.includes("Network request failed");
    if (isNetworkIssue) {
      console.warn(
        `[DCC Network] ${err.name}: ${err.message} | online=${navigator.onLine} | ${netInfo()}`,
      );
    }
  });

  // Connection state changes
  window.addEventListener("online",  () => console.info(`[DCC Network] Reconnected | ${netInfo()}`));
  window.addEventListener("offline", () => console.warn("[DCC Network] Connection lost — app is offline"));

  // Log effective connection type on load so we have a baseline in the logs
  window.addEventListener("load", () => {
    console.info(`[DCC Network] Page loaded | online=${navigator.onLine} | ${netInfo()}`);
  });
}

createRoot(document.getElementById("root")!).render(<App />);
