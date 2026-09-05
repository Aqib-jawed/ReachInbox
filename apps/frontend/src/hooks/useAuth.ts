import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth";
import { api, setAuthToken } from "@/lib/api";

export function useAuth() {
  const router = useRouter();
  const { user, token, setUser, setToken } = useAuthStore();
  const [loading, setLoading] = useState(true);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    router.push("/login");
  }, [router, setToken, setUser]);

  useEffect(() => {
    let isMounted = true;

    async function initAuth() {
      if (token) {
        setAuthToken(token);
        // If user is already set in store, we're done
        if (user) {
          if (isMounted) setLoading(false);
          return;
        }

        // Try to fetch current user from backend
        try {
          const res = await api.getCurrentUser();
          if (res.success && res.user && isMounted) {
            setUser(res.user);
            setLoading(false);
            return;
          }
        } catch {
          // Fallback to decoding JWT token from Google
        }

        // Decode JWT (frontend fallback)
        try {
          const parts = token.split(".");
          if (parts.length === 3) {
            const decoded = JSON.parse(atob(parts[1]));
            if (isMounted) {
              setUser({
                id: decoded.sub || decoded.id || "google_user",
                email: decoded.email || "user@example.com",
                name: decoded.name || decoded.email?.split("@")[0] || "User",
                avatar: decoded.picture || null,
                avatarUrl: decoded.picture || null,
              });
            }
          } else {
            logout();
          }
        } catch {
          logout();
        }
      }
      if (isMounted) setLoading(false);
    }

    initAuth();

    return () => {
      isMounted = false;
    };
  }, [token, user, setUser, logout]);

  return {
    user,
    token,
    isAuthenticated: !!token && !!user,
    loading,
    logout,
  };
}