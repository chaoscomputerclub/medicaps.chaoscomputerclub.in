import React, { useState, useEffect, useCallback } from "react";
import ReactDOM from "react-dom/client";
import { Provider } from "react-redux";
import { BrowserRouter } from "react-router-dom";
import { store } from "@/store";
import { useAppSelector } from "@/store/hooks";
import { Toaster } from "@/components/ui/sonner";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AppRoutes } from "./AppRoutes";
import { TacticalLoader } from "@/components/TacticalLoader";
import "./styles.css";

/**
 * Global Host for on-demand tactical glowing loader across the app.
 * Can be triggered anywhere using `useGlobalLoader()` or `dispatch(showGlobalLoader())`.
 */
function GlobalLoaderHost() {
  const isLoading = useAppSelector((state) => state.ui.globalLoading);
  const label = useAppSelector((state) => state.ui.globalLoadingLabel);

  if (!isLoading) return null;

  return (
    <TacticalLoader
      variant="fullscreen"
      label={label || "TRANSMISSION IN PROGRESS"}
      subtext="SYNCHRONIZING TELEMETRY WITH CAMPUS NODE"
    />
  );
}

function Root() {
  const [contentReady, setContentReady] = useState(false);
  const [booted, setBooted] = useState(false);

  useEffect(() => {
    // Initial boot sequence: display the glowing tactical loader during initial mounting
    // and session settlement, then smoothly trigger the split curtain wipe
    const timer = setTimeout(() => {
      setContentReady(true);
    }, 700);

    return () => clearTimeout(timer);
  }, []);

  const handleComplete = useCallback(() => {
    setBooted(true);
  }, []);

  return (
    <Provider store={store}>
      <BrowserRouter>
        <AppRoutes />
        <Toaster theme="dark" />
        <GlobalLoaderHost />
      </BrowserRouter>

      {/* Initial Tactical Boot Loader — active until content is ready, then wipes apart */}
      {!booted && (
        <TacticalLoader
          isLoading={!contentReady}
          onComplete={handleComplete}
          label="SYSTEM SYNCHRONIZING"
          subtext="ESTABLISHING SECURE PROTOCOL // MEDI-CAPS CHAPTER"
        />
      )}
    </Provider>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <Root />
    </ErrorBoundary>
  </React.StrictMode>
);
