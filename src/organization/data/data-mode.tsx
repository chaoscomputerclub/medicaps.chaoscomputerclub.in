import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import type { DataMode } from "./types";

type Ctx = { mode: DataMode; setMode: (m: DataMode) => void };

const DataModeContext = createContext<Ctx>({ mode: "member", setMode: () => {} });

/**
 * Until the API exists, screens read from one of two fixture sets. The switch is
 * exposed in the portal sidebar so empty/zero-states are reviewable in place.
 */
export function DataModeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<DataMode>("member");
  const setMode = useCallback((m: DataMode) => setModeState(m), []);
  return <DataModeContext.Provider value={{ mode, setMode }}>{children}</DataModeContext.Provider>;
}

export function useDataMode() {
  return useContext(DataModeContext);
}
