import { createContext, useContext, useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import { ApiError, request, type Me } from "./api";
import { signInWithSupabaseGoogle } from "./supabase-oauth";
import { legalVersion } from "@coach/core";
import { SessionController } from "./session-controller";
type Auth = { token: string | null; me: Me | null; loading: boolean; error: string;
  signIn(email: string, password: string, register: boolean, accepted?: boolean): Promise<void>;
  signInWithProvider(provider: "google" | "microsoft", accessToken: string, accepted?: boolean): Promise<void>;
  signOut(): Promise<void>; signOutAll(): Promise<void>; deleteAccount(): Promise<void>; refresh(): Promise<void> };
type SupabaseAuth = Auth & { signInWithSupabaseGoogle(password?: string, accepted?: boolean): Promise<void> };
const Context = createContext<SupabaseAuth | null>(null);
const key = "coach-session-v1";
async function persist(token: string | null) {
  if (Platform.OS === "web") return;
  if (token) await SecureStore.setItemAsync(key, token);
  else await SecureStore.deleteItemAsync(key);
}
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session] = useState(() => new SessionController<Me>({
    read: () => Platform.OS === "web" ? Promise.resolve(null) : SecureStore.getItemAsync(key),
    write: persist, load: current => request<Me>("/v1/me", current),
    expired: error => error instanceof ApiError && error.status === 401,
  }));
  const state = useSyncExternalStore(session.subscribe, session.snapshot, session.snapshot);
  useEffect(() => {
    void session.restore();
    return session.cancelPending;
  }, [session]);
  const value: SupabaseAuth = {
    ...state,
    refresh: () => session.refresh(),
    async signIn(email, password, register, accepted) {
      await session.authenticate(() => request<{ token: string }>(register ? "/v1/auth/register" : "/v1/auth/login", null, "POST",
        { email, password, ...(register ? { legalAccepted: accepted === true, legalVersion } : {}) }));
    },
    async signInWithProvider(provider, accessToken, accepted) {
      const legal = accepted ? { legalAccepted: true, legalVersion } : {};
      const credential = provider === "google" ? { provider, accessToken, ...legal } : { provider, idToken: accessToken, ...legal };
      await session.authenticate(() => request<{ token: string }>("/v1/auth/oauth", null, "POST", credential));
    },
    async signInWithSupabaseGoogle(password, accepted) {
      await session.authenticate(async () => {
        let response: { token: string } | undefined;
        await signInWithSupabaseGoogle(async accessToken => {
          response = await request<{ token: string }>("/v1/auth/supabase", null, "POST", {
            accessToken, ...(password ? { password } : {}), ...(accepted ? { legalAccepted: true, legalVersion } : {}),
          });
        });
        if (!response) throw new Error("Google sign-in was cancelled. Please try again.");
        return response;
      });
    },
    async signOut() {
      await session.signOut(current => request("/v1/auth/logout", current, "POST"));
    },
    async signOutAll() {
      await session.confirmAndClear(current => request("/v1/auth/logout-all", current, "POST"), true);
    },
    async deleteAccount() {
      await session.confirmAndClear(current => request("/v1/me", current, "DELETE"));
    },
  };
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useAuth() { const value = useContext(Context); if (!value) throw new Error("AuthProvider missing"); return value; }
