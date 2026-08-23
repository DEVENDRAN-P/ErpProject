"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import Logo from "@/components/ui/Logo";
import { auth } from "@/lib/firebase";

const firebaseConfigured = !!auth;

export default function SignupPage() {
  const { register, registerWithGoogle } = useAuth();
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setError(null);
    if (password !== confirmPassword) { setError("Passwords do not match."); return; }
    if (password.length < 6) { setError("Password must be at least 6 characters."); return; }
    setLoading(true);
    try { await register(email, password, displayName); router.push("/dashboard"); }
    catch (err: any) { setError(err.message); } finally { setLoading(false); }
  };

  const handleGoogle = async () => {
    setError(null); setGoogleLoading(true);
    try { await registerWithGoogle(); router.push("/dashboard"); }
    catch (err: any) { setError(err.message); } finally { setGoogleLoading(false); }
  };

  return (
    <main className="min-h-screen flex items-center justify-center px-4" style={{ background: "var(--bg-page)" }}>
      <div className="w-full max-w-[400px] space-y-8 page-enter">
        <div className="flex flex-col items-center gap-3">
          <Logo size={48} />
          <div className="text-center">
            <h1 className="text-xl font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>Create your NexGen account</h1>
            <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>Start managing product data intelligence</p>
          </div>
        </div>

        <div className="rounded-xl border p-7" style={{ borderColor: "var(--border-default)", background: "var(--bg-card)", boxShadow: "var(--shadow-sm)" }}>
          <button onClick={handleGoogle} disabled={googleLoading}
            className="w-full flex items-center justify-center gap-3 rounded-lg border px-4 py-3 text-sm font-medium transition disabled:opacity-50 mb-5"
            style={{ borderColor: "var(--border-default)", color: "var(--text-primary)" }}>
            {googleLoading ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--neutral-300)]" style={{ borderTopColor: "var(--accent-primary)" }} />
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
            )}
            {googleLoading ? "Creating account…" : "Continue with Google"}
          </button>

          <div className="relative mb-5">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t" style={{ borderColor: "var(--border-default)" }} /></div>
            <div className="relative flex justify-center text-[11px]">
              <span className="px-3" style={{ background: "var(--bg-card)", color: "var(--text-muted)" }}>or sign up with email</span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="signup-name" className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>Full name</label>
              <input id="signup-name" name="name" type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)} autoComplete="name"
                className="w-full rounded-lg border px-4 py-2.5 text-sm"
                style={{ borderColor: "var(--border-default)", color: "var(--text-primary)" }} />
            </div>
            <div>
              <label htmlFor="signup-email" className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>Email</label>
              <input id="signup-email" name="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email"
                className="w-full rounded-lg border px-4 py-2.5 text-sm"
                style={{ borderColor: "var(--border-default)", color: "var(--text-primary)" }} />
            </div>
            <div>
              <label htmlFor="signup-password" className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>Password</label>
              <input id="signup-password" name="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} autoComplete="new-password"
                className="w-full rounded-lg border px-4 py-2.5 text-sm"
                style={{ borderColor: "var(--border-default)", color: "var(--text-primary)" }} />
            </div>
            <div>
              <label htmlFor="signup-confirm-password" className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>Confirm password</label>
              <input id="signup-confirm-password" name="confirmPassword" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required autoComplete="new-password"
                className="w-full rounded-lg border px-4 py-2.5 text-sm"
                style={{ borderColor: "var(--border-default)", color: "var(--text-primary)" }} />
            </div>
            {!firebaseConfigured && (
              <div className="rounded-lg px-4 py-3 text-sm" style={{ background: "#FEF3C7", color: "#92400E", border: "1px solid #FDE68A" }}>
                <strong>Firebase is not configured.</strong> Set NEXT_PUBLIC_FIREBASE_* environment variables on Vercel to enable authentication.
              </div>
            )}
            {error && (
              <div className="rounded-lg px-4 py-3 text-sm" style={{ background: "var(--color-error-light)", color: "var(--color-error)", border: `1px solid var(--color-error-border)` }}>
                {error}
              </div>
            )}
            <button type="submit" disabled={loading}
              className="w-full rounded-lg px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50 transition"
              style={{ background: "var(--accent-primary)" }}>
              {loading ? "Creating account…" : "Create account"}
            </button>
          </form>
        </div>

        <p className="text-center text-sm" style={{ color: "var(--text-secondary)" }}>
          Already have an account? <Link href="/login" className="font-medium" style={{ color: "var(--accent-primary)" }}>Sign in</Link>
        </p>
      </div>
    </main>
  );
}
