"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import LandingPage from "@/components/landing/LandingPage";
import Logo from "@/components/ui/Logo";

export default function RootPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) {
      router.replace("/dashboard");
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-pulse">
            <Logo size={40} />
          </div>
          <span className="text-sm text-gray-400">Loading…</span>
        </div>
      </div>
    );
  }

  if (user) return null;

  return <LandingPage />;
}
