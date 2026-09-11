import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Profile } from "@/lib/types";

interface AuthApi {
  user: Profile | null;
  loading: boolean;
  loginWithDiscord: () => Promise<{ error: string | null }>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthApi | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = useCallback(async (userId: string) => {
    const load = async () => {
      const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
      if (error) throw error;
      return data;
    };

    let data = await load();
    if (!data) {
      const { error } = await supabase.rpc("ensure_profile");
      if (error) throw error;
      data = await load();
    }

    if (data) {
      setUser({
        id: data.id,
        name: data.name ?? "",
        role: data.role ?? "visiteur",
        requestedRole: data.requested_role ?? "visiteur",
        sawmillAccess: data.sawmill_access ?? "both",
        clientEntryId: data.client_entry_id ?? null,
        pendingEntryId: data.pending_entry_id ?? null,
        taxExempt: data.tax_exempt ?? false,
        discountPercent: Number(data.discount_percent ?? 0),
        createdAt: data.created_at,
      });
    }
  }, []);

  useEffect(() => {
    let active = true;

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") {
        setUser(null);
        setLoading(false);
      }
      if (session?.user) {
        setLoading(true);
        setTimeout(() => {
          if (active) {
            void fetchProfile(session.user!.id)
              .catch(() => setUser(null))
              .finally(() => setLoading(false));
          }
        }, 0);
      }
    });

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!active) return;
        if (data.session?.user) {
          void fetchProfile(data.session.user.id)
            .catch(() => setUser(null))
            .finally(() => setLoading(false));
        } else {
          setLoading(false);
        }
      })
      .catch(() => {
        if (!active) return;
        setUser(null);
        setLoading(false);
      });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [fetchProfile]);

  const api = useMemo<AuthApi>(
    () => ({
      user,
      loading,
      loginWithDiscord: async () => {
        try {
          const { error } = await supabase.auth.signInWithOAuth({
            provider: "discord",
            options: {
              redirectTo: `${window.location.origin}/`,
              scopes: "identify email",
            },
          });
          return { error: error?.message ?? null };
        } catch {
          return { error: "Connexion Discord impossible. Réessayez dans quelques instants." };
        }
      },
      logout: async () => {
        await supabase.auth.signOut();
        setUser(null);
      },
    }),
    [user, loading]
  );

  return <AuthContext.Provider value={api}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthApi {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth doit être utilisé dans AuthProvider");
  return ctx;
}
