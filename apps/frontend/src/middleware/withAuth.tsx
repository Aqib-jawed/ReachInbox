import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { Loading } from "@/components";

export function withAuth<P extends object>(Component: React.ComponentType<P>) {
  return function ProtectedComponent(props: P) {
    const router = useRouter();
    const { isAuthenticated, loading } = useAuth();

    useEffect(() => {
      if (!loading && !isAuthenticated) {
        router.push("/login");
      }
    }, [loading, isAuthenticated, router]);

    if (loading) {
      return <Loading size="lg" text="Authenticating session..." fullScreen />;
    }

    if (!isAuthenticated) {
      return (
        <div className="flex h-screen w-full items-center justify-center bg-slate-950 text-slate-400 text-sm">
          Redirecting to login...
        </div>
      );
    }

    return <Component {...props} />;
  };
}