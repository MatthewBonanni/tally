import { RouterProvider } from "react-router-dom";
import { router } from "./router";
import { Unlock } from "@/pages/Unlock";
import { useAppStore } from "@/stores/useAppStore";

function App() {
  const { isUnlocked } = useAppStore();

  // For development without Tauri backend, skip unlock
  const isDev = import.meta.env.DEV && !window.__TAURI_INTERNALS__;

  if (!isUnlocked && !isDev) {
    return <Unlock />;
  }

  return <RouterProvider router={router} />;
}

export default App;
