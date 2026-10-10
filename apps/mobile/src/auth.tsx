import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import { ApiError, request, type Me } from "./api";
import { signInWithSupabaseGoogle } from "./supabase-oauth";
type Auth = { token: string | null; me: Me | null; loading: boolean; error: string; signIn(email: string, password: string, register: boolean): Promise<void>; signInWithProvider(provider: "google" | "microsoft", accessToken: string): Promise<void>; signOut(): Promise<void>; signOutAll(): Promise<void>; deleteAccount(): Promise<void>; refresh(): Promise<void> };
type SupabaseAuth = Auth & { signInWithSupabaseGoogle(password?: string): Promise<void> };
const Context = createContext<SupabaseAuth | null>(null);
const key = "coach-session-v1";
async function persist(token: string | null) {
  if (Platform.OS === "web") return;
  if (token) await SecureStore.setItemAsync(key, token);
  else await SecureStore.deleteItemAsync(key);
}
export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  async function load(current: string) {
    try { setMe(await request<Me>("/v1/me", current)); setError(""); }
    catch (failure) {
      if (failure instanceof ApiError && failure.status === 401) { await persist(null); setToken(null); setMe(null); }
      throw failure;
    }
  }
  useEffect(() => {
    (async () => {
      try {
        const saved = Platform.OS === "web" ? null : await SecureStore.getItemAsync(key);
        if (saved) { setToken(saved); await load(saved); }
      } catch (failure) { setError(failure instanceof Error ? failure.message : "Could not restore your session."); }
      finally { setLoading(false); }
    })();
  }, []);
  const value: SupabaseAuth = {
    token, me, loading, error,
    async refresh() { if (token) await load(token); },
    async signIn(email, password, register) {
      const response = await request<{ token: string }>(register ? "/v1/auth/register" : "/v1/auth/login", null, "POST", { email, password });
      await persist(response.token); setToken(response.token); await load(response.token);
    },
    async signInWithProvider(provider, accessToken) {
      const credential = provider === "google" ? { provider, accessToken } : { provider, idToken: accessToken };
      const response = await request<{ token: string }>("/v1/auth/oauth", null, "POST", credential);
      await persist(response.token); setToken(response.token); await load(response.token);
    },
    async signInWithSupabaseGoogle(password) {
      await signInWithSupabaseGoogle(async accessToken => {
        const response = await request<{ token: string }>("/v1/auth/supabase", null, "POST", {
          accessToken, ...(password ? { password } : {}),
        });
        await persist(response.token); setToken(response.token); await load(response.token);
      });
    },
    async signOut() {
      if (token) {
        try { await request("/v1/auth/logout", token, "POST"); }
        catch (failure) { if (!(failure instanceof ApiError && failure.status === 401)) throw failure; }
      }
      await persist(null); setToken(null); setMe(null); setError("");
    },
    async signOutAll() {
      if (token) {
        try { await request("/v1/auth/logout-all", token, "POST"); }
        catch (failure) { if (!(failure instanceof ApiError && failure.status === 401)) throw failure; }
      }
      await persist(null); setToken(null); setMe(null); setError("");
    },
    async deleteAccount() {
      if (!token) return;
      await request("/v1/me", token, "DELETE");
      await persist(null); setToken(null); setMe(null); setError("");
    },
  };
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useAuth() { const value = useContext(Context); if (!value) throw new Error("AuthProvider missing"); return value; }
