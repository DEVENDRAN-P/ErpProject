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
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (mode === "login") {
        await login(email, password);
        onAuthenticated();
      } else {
        await register(email, password, fullName);
        onAuthenticated();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-3xl border border-slate-800 bg-slate-950/70 p-8">
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-2xl font-semibold text-white">{mode === "login" ? "Sign in" : "Create account"}</h2>
        <button
          type="button"
          onClick={() => setMode(mode === "login" ? "register" : "login")}
          className="text-sm text-cyan-300 hover:text-cyan-100"
        >
          {mode === "login" ? "Register instead" : "Already have an account?"}
        </button>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <label className="block text-sm text-slate-300">
          Email
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-900/80 px-4 py-3 text-sm text-white outline-none focus:border-cyan-500"
          />
        </label>
        {mode === "register" ? (
          <label className="block text-sm text-slate-300">
            Full name
            <input
              type="text"
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-900/80 px-4 py-3 text-sm text-white outline-none focus:border-cyan-500"
            />
          </label>
        ) : null}
        <label className="block text-sm text-slate-300">
          Password
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-900/80 px-4 py-3 text-sm text-white outline-none focus:border-cyan-500"
          />
        </label>
        {error ? <div className="rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</div> : null}
        <button
          type="submit"
          className="w-full rounded-xl bg-cyan-500 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400"
          disabled={loading}
        >
          {loading ? "Submitting…" : mode === "login" ? "Sign in" : "Create account"}
        </button>
      </form>
    </div>
  );
}
