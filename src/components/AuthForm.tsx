"use client";

import { useState } from "react";
import { useAuth } from "@/context/AuthContext";

type AuthMode = "login" | "register";

export default function AuthForm({ onAuthenticated }: { onAuthenticated: () => void }) {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setError(null); setLoading(true);
    try {
      if (mode === "login") { await login(email, password); onAuthenticated(); }
      else { await register(email, password, fullName); onAuthenticated(); }
    } catch (err) { setError(err instanceof Error ? err.message : "Authentication failed."); }
    finally { setLoading(false); }
  };

  return (
    <div className="rounded-xl border p-8 shadow-sm" style={{ borderColor: "var(--border-default)", background: "var(--bg-card)" }}>
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-900">{mode === "login" ? "Sign in" : "Create account"}</h2>
        <button type="button" onClick={() => setMode(mode === "login" ? "register" : "login")}
          className="text-sm link">
          {mode === "login" ? "Register instead" : "Already have an account?"}
        </button>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
            className="input" />
        </div>
        {mode === "register" && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Full name</label>
            <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)}
              className="input" />
          </div>
        )}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Password</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required
            className="input" />
        </div>
        {error && <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600">{error}</div>}
        <button type="submit" className="w-full btn-primary py-3" disabled={loading}>
          {loading ? "Submitting…" : mode === "login" ? "Sign in" : "Create account"}
        </button>
      </form>
    </div>
  );
}
