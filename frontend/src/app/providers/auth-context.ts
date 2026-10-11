import { createContext, useContext } from "react";
import type { UserRole, AdminLevel, AccountStatus } from "@/shared/types/database.types";

export interface AuthProfile {
  id: string;
  username: string;
  fullName: string;
  role: UserRole;
  adminLevel: AdminLevel | null;
  status: AccountStatus;
  mustChangePassword: boolean;
}

export interface AuthContextValue {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: AuthProfile | null;
  signOut: () => Promise<void>;
}

export const defaultAuthContext: AuthContextValue = {
  isAuthenticated: false,
  isLoading: false,
  user: null,
  signOut: () => Promise.resolve(),
};

export const AuthContext = createContext<AuthContextValue>(defaultAuthContext);

export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
}
