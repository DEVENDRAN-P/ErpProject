"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";

export default function ForgotPasswordPage() {
  const { resetPassword } = useAuth();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setError(null); setSuccess(false); setLoading(true);
    try { await resetPassword(email); setSuccess(true); }
    catch (err: any) { setError(err.message); } finally { setLoading(false); }
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-[#F8FAFC] px-4">
      <div className="w-full max-w-md space-y-8">
        <div className="flex flex-col items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#2563EB] text-white font-bold text-lg">PP</div>
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900">Reset your password</h1>
            <p className="text-sm text-gray-500 mt-1">We&apos;ll send you a reset link</p>
          </div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
          {success ? (
            <div className="space-y-4 text-center">
              <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-700">✓ Password reset email sent! Check your inbox.</div>
              <Link href="/login" className="inline-block text-sm text-[#2563EB] hover:text-[#1D4ED8] transition">← Back to sign in</Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label htmlFor="reset-email" className="block text-sm font-medium text-gray-700 mb-1.5">Email address</label>
                <input id="reset-email" name="reset-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" placeholder="you@company.com"
                  className="w-full rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 placeholder-gray-400 outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-blue-50 transition" />
              </div>
              {error && <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600">{error}</div>}
              <button type="submit" disabled={loading}
                className="w-full rounded-lg bg-[#2563EB] px-4 py-3 text-sm font-semibold text-white hover:bg-[#1D4ED8] transition disabled:opacity-50">
                {loading ? "Sending…" : "Send reset link"}
              </button>
            </form>
          )}
        </div>
        <p className="text-center text-sm text-gray-500">
          Remember your password? <Link href="/login" className="text-[#2563EB] hover:text-[#1D4ED8] transition font-medium">Sign in</Link>
        </p>
      </div>
    </main>
  );
}
