import { useMemo, type ReactNode } from "react";
import { AuthContext, defaultAuthContext, type AuthContextValue } from "./auth-context";

export function AuthProvider({
  children,
  value,
}: {
  children: ReactNode;
  value?: AuthContextValue | undefined;
}) {
  const contextValue = useMemo(() => value ?? defaultAuthContext, [value]);

  return <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>;
}
