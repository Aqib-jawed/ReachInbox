import React from "react";
import { GoogleOAuthProvider } from "@react-oauth/google";
import { Toaster } from "react-hot-toast";

const GOOGLE_CLIENT_ID =
  (typeof import.meta !== "undefined" && (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID) ||
  (typeof process !== "undefined" && process.env?.NEXT_PUBLIC_GOOGLE_CLIENT_ID) ||
  "79016898831-pg41f8u8ff5keaposomcrpo765p9jgs3.apps.googleusercontent.com";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <div className="min-h-screen bg-slate-950 text-slate-100 font-sans antialiased">
        {children}
        <Toaster
          position="bottom-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: "#0f172a",
              color: "#f8fafc",
              border: "1px solid #334155",
              borderRadius: "0.75rem",
              fontSize: "0.875rem",
            },
            success: {
              iconTheme: {
                primary: "#10b981",
                secondary: "#0f172a",
              },
            },
            error: {
              iconTheme: {
                primary: "#f43f5e",
                secondary: "#0f172a",
              },
            },
          }}
        />
      </div>
    </GoogleOAuthProvider>
  );
}