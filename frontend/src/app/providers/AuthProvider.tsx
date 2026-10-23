import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { fetchAuthProfile } from "@/shared/api/profile";
import { supabase } from "@/shared/api/supabase";
import { AuthContext, type AuthContextValue, type AuthProfile } from "./auth-context";

interface AuthState {
  isLoading: boolean;
  user: AuthProfile | null;
}

/**
 * Session lifecycle (FND-12): reads the stored session, follows sign-in, sign-out and token
 * refresh, and resolves the profile (role, status, password flag) for the signed-in user.
 * Pass `value` to supply a fixed state, for tests and stories.
 */
export function AuthProvider({
  children,
  value,
}: {
  children: ReactNode;
  value?: AuthContextValue | undefined;
}) {
  const [state, setState] = useState<AuthState>({ isLoading: value === undefined, user: null });

  useEffect(() => {
    if (value !== undefined) return undefined;
    let active = true;
    let loadedFor: string | null = null;
    let mustChangePassword = false;

    const resolve = async (session: Session | null) => {
      if (session === null) {
        loadedFor = null;
        mustChangePassword = false;
        if (active) setState({ isLoading: false, user: null });
        return;
      }
      const profile = await fetchAuthProfile(session.user.id);
      if (!active) return;
      loadedFor = profile === null ? null : session.user.id;
      mustChangePassword = profile?.mustChangePassword === true;
      setState({ isLoading: false, user: profile });
    };

    void supabase.auth.getSession().then(({ data }) => resolve(data.session));

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      // A refresh normally changes nothing. While the profile still says the password must change,
      // it is read again, because the set-new-password page refreshes the session once the flag
      // is cleared.
      if (
        event === "TOKEN_REFRESHED" &&
        session !== null &&
        loadedFor === session.user.id &&
        !mustChangePassword
      ) {
        return;
      }
      // The callback must not await Supabase calls, so the profile read runs on the next tick.
      setTimeout(() => {
        void resolve(session);
      }, 0);
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, [value]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const contextValue = useMemo<AuthContextValue>(
    () =>
      value ?? {
        isAuthenticated: state.user !== null,
        isLoading: state.isLoading,
        user: state.user,
        signOut,
      },
    [value, state, signOut],
  );

  return <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>;
}
