"use client";

import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import Logo from "@/components/ui/Logo";

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg-page)" }}>
        <div className="flex flex-col items-center gap-4">
          <div className="animate-pulse">
            <Logo size={40} />
          </div>
          <span className="text-sm text-gray-500">Loading ProductPilot…</span>
        </div>
      </div>
    );
  }

  if (!user) return null;
  return <>{children}</>;
}
