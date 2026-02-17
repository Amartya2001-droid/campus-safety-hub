import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { logEvent, setupGlobalErrorHandlers } from "@/lib/observability";

setupGlobalErrorHandlers();
logEvent({ level: "info", message: "app_boot", context: { mode: import.meta.env.MODE } });

createRoot(document.getElementById("root")!).render(<App />);
