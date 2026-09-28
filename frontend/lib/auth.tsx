"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { api, ApiError } from "./api";
import { demoUsers } from "./demo-data";
import { normalizeRole, type AuthUser, type LoginCredentials, type UserRole } from "./types";

interface StoredSession {
  token: string;
  user: AuthUser;
}

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  isHydrated: boolean;
  isSubmitting: boolean;
  error: string | null;
  isDemoSession: boolean;
  login: (credentials: LoginCredentials) => Promise<AuthUser>;
  loginAsDemo: (role: UserRole) => Promise<AuthUser>;
  logout: () => void;
  clearError: () => void;
}

const STORAGE_KEY = "skilltrace.session.v1";
const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function getStoredSession(): StoredSession | null {
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    if (!value) return null;
    const parsed = JSON.parse(value) as StoredSession;
    if (!parsed.token || !parsed.user?.role) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<StoredSession | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDemoSession, setIsDemoSession] = useState(false);

  useEffect(() => {
    let mounted = true;
    const stored = getStoredSession();
    // Token being validated. If the user logs in/out while this request is
    // in flight, the stored token changes and this stale result must NOT
    // overwrite the fresh session, clear it, or force a redirect.
    const validatingToken = stored?.token ?? null;
    const isStale = () => {
      try {
        const current = window.localStorage.getItem(STORAGE_KEY);
        if (validatingToken === null) return current !== null;
        if (!current) return true;
        return (JSON.parse(current) as StoredSession)?.token !== validatingToken;
      } catch {
        return false;
      }
    };
    console.debug("[AUTH HYDRATION] starting");
    console.debug("[AUTH HYDRATION] stored session exists:", !!stored);

    if (stored?.token && !stored.token.startsWith("demo-")) {
      // Validate the JWT against the role-neutral /auth/me endpoint.
      // A trainee-only endpoint must never gate employer/admin sessions.
      console.debug("[AUTH HYDRATION] /auth/me started");
      api.getCurrentUser(stored.token)
        .then((me) => {
          if (!mounted || isStale()) return;
          const role = normalizeRole(me.role);
          console.debug("[AUTH HYDRATION] backend user role:", role);
          const profile = demoUsers[role];
          const user: AuthUser = {
            id: me.id,
            name: me.full_name || profile.name,
            email: me.email,
            role,
            organization: profile.organization,
          };
          const next: StoredSession = { token: stored.token, user };
          try {
            window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
          } catch {
            // Storage unavailable; in-memory session still works for this visit.
          }
          setSession(next);
          setIsDemoSession(false);
          setIsHydrated(true);
        })
        .catch((caught: unknown) => {
          if (!mounted || isStale()) return;
          const status = caught instanceof ApiError ? caught.status : 0;
          if (status === 0) {
            // Backend unreachable (offline): keep the stored session so the
            // UI can render cached/demo data, but do not redirect.
            setSession(stored);
            setIsDemoSession(false);
            setIsHydrated(true);
            return;
          }
          // 401/403/...: token is invalid or user inactive — clear and redirect.
          try {
            window.localStorage.removeItem(STORAGE_KEY);
          } catch {
            // Storage unavailable; in-memory clearing below still protects routes.
          }
          setSession(null);
          setIsDemoSession(false);
            setIsHydrated(true);
            if (!window.location.pathname.startsWith("/login")) {
              // Full reload guarantees every cached auth state is dropped.
              // eslint-disable-next-line @next/next/no-location-assign-relative-destination
              window.location.href = "/login";
            }
        });
    } else {
      // No session, or a legacy demo token (no longer minted): start clean.
      // Legacy demo tokens are NOT valid authentication.
      if (stored) {
        try {
          window.localStorage.removeItem(STORAGE_KEY);
        } catch {
          // Ignore storage errors during cleanup.
        }
      }
      setSession(null);
      setIsDemoSession(false);
      setIsHydrated(true);
    }

    return () => { mounted = false; };
  }, []);

  const persist = useCallback((next: StoredSession, demo: boolean) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Storage blocked/unavailable: keep the in-memory session so the
      // just-completed backend login still redirects to the dashboard.
    }
    console.debug("[AUTH] session stored:", (() => {
      try {
        return !!window.localStorage.getItem(STORAGE_KEY);
      } catch {
        return false;
      }
    })());
    setSession(next);
    setIsDemoSession(demo);
  }, []);

  const login = useCallback(
    async (credentials: LoginCredentials) => {
      setIsSubmitting(true);
      setError(null);
      try {
        // Real backend authentication only. The backend determines the role;
        // the UI role selector is a hint and never grants authorization.
        console.debug("[API AUTH] login request started");
        const result = await api.login(credentials);
        const role = normalizeRole(result.user.role);
        const profile = demoUsers[role];
        const user: AuthUser = {
          id: result.user.id,
          name: result.user.full_name || profile.name,
          email: result.user.email,
          role,
          organization: profile.organization,
        };
        const next: StoredSession = { token: result.access_token, user };
        persist(next, false);
        console.debug("[LOGIN DEBUG] session persisted");
        return user;
      } catch (caught) {
        const message =
          caught instanceof ApiError
            ? caught.message
            : "Unable to sign in. Please try again.";
        setError(message);
        throw caught;
      } finally {
        setIsSubmitting(false);
      }
    },
    [persist],
  );

  const loginAsDemo = useCallback(
    async (role: UserRole) =>
      login({
        email: `${role}@skilltrace.in`,
        password: "Demo@123",
        role,
      }),
    [login],
  );

  const clearError = useCallback(() => setError(null), []);

  const logout = useCallback(() => {
    window.localStorage.removeItem(STORAGE_KEY);
    setSession(null);
    setIsDemoSession(false);
    setError(null);
    // Full reload guarantees every cached auth state is dropped.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.href = "/login";
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user: session?.user ?? null,
      token: session?.token ?? null,
      isHydrated,
      isSubmitting,
      error,
      isDemoSession,
      login,
      loginAsDemo,
      logout,
      clearError,
    }),
    [
      session,
      isHydrated,
      isSubmitting,
      error,
      isDemoSession,
      login,
      loginAsDemo,
      clearError,
      logout,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
