import { createContext, useContext } from "react";
import type { AppConfig } from "./types";

export const ConfigContext = createContext<AppConfig | null>(null);

export function useConfig(): AppConfig {
  const c = useContext(ConfigContext);
  if (!c) throw new Error("config not loaded");
  return c;
}
