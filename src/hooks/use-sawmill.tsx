import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { SAWMILL_KEY } from "@/lib/constants";
import { useStore } from "@/lib/store";
import { useAuth } from "@/hooks/use-auth";

interface SawmillApi {
  sawmillId: string;
  setSawmillId: (id: string) => void;
}

const SawmillContext = createContext<SawmillApi | null>(null);

export function allowedSawmillIds(access: string | undefined, sawmills: { id: string }[]): string[] {
  if (access === "both" || !access) return sawmills.map((s) => s.id);
  return sawmills.filter((s) => s.id === access).map((s) => s.id);
}

export function SawmillProvider({ children }: { children: ReactNode }) {
  const { db } = useStore();
  const { user } = useAuth();
  const ids = allowedSawmillIds(user?.sawmillAccess, db.sawmills);

  const [sawmillId, setSawmillIdState] = useState<string>(() => {
    const stored = localStorage.getItem(SAWMILL_KEY);
    return stored && db.sawmills.some((s) => s.id === stored) ? stored : db.sawmills[0]?.id ?? "rivebois";
  });

  // Force une scierie à laquelle l'utilisateur a accès
  const effective = ids.length > 0 ? (ids.includes(sawmillId) ? sawmillId : ids[0]) : sawmillId;

  useEffect(() => {
    localStorage.setItem(SAWMILL_KEY, effective);
    document.documentElement.setAttribute("data-theme", effective);
  }, [effective]);

  const api = useMemo(
    () => ({
      sawmillId: effective,
      setSawmillId: (id: string) => {
        if (ids.length === 0 || ids.includes(id)) setSawmillIdState(id);
      },
    }),
    [effective, ids]
  );

  return <SawmillContext.Provider value={api}>{children}</SawmillContext.Provider>;
}

export function useSawmill(): SawmillApi {
  const ctx = useContext(SawmillContext);
  if (!ctx) throw new Error("useSawmill doit être utilisé dans SawmillProvider");
  return ctx;
}
