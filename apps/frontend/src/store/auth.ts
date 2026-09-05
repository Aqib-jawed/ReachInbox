import { create } from "zustand";
import { User } from "@/types";
import { setAuthToken } from "@/lib/api";

export interface AuthState {
  user: User | null;
  token: string | null;
  setUser: (user: User | null) => void;
  setToken: (token: string | null) => void;
  logout: () => void;
}

const getStoredToken = (): string | null => {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("token") || localStorage.getItem("reachinbox_auth_token");
};

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: getStoredToken(),
  setUser: (user) => set({ user }),
  setToken: (token) => {
    if (token) {
      if (typeof window !== "undefined") {
        localStorage.setItem("token", token);
        localStorage.setItem("reachinbox_auth_token", token);
      }
      setAuthToken(token);
    } else {
      if (typeof window !== "undefined") {
        localStorage.removeItem("token");
        localStorage.removeItem("reachinbox_auth_token");
      }
      setAuthToken(null);
    }
    set({ token });
  },
  logout: () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("token");
      localStorage.removeItem("reachinbox_auth_token");
    }
    setAuthToken(null);
    set({ user: null, token: null });
  },
}));