import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { Loading } from "@/components";
import LoginPage from "./login/page";

export default function HomePage() {
  const router = useRouter();
  const { isAuthenticated, loading } = useAuth();

  useEffect(() => {
    if (!loading && isAuthenticated) {
      router.push("/dashboard");
    }
  }, [loading, isAuthenticated, router]);

  if (loading) {
    return <Loading size="lg" text="Checking session..." fullScreen />;
  }

  if (isAuthenticated) {
    return <Loading size="lg" text="Redirecting to dashboard..." fullScreen />;
  }

  return <LoginPage />;
}