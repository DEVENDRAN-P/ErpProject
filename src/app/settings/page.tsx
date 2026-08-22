"use client";

import { useState, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import { Camera, Upload, CheckCircle, Sun, Moon, Monitor } from "lucide-react";
import ProtectedRoute from "@/components/ProtectedRoute";

function SettingsContent() {
  const { user, updateProfilePhoto, resetPassword } = useAuth();
  const { theme, setTheme } = useTheme();
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoSuccess, setPhotoSuccess] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoUploading(true); setPhotoSuccess(false);
    try {
      await updateProfilePhoto(file);
      setPhotoSuccess(true);
      setTimeout(() => setPhotoSuccess(false), 3000);
    } catch (err) {
      console.error("Photo upload failed:", err);
    } finally {
      setPhotoUploading(false);
    }
  };

  const handlePasswordReset = async () => {
    if (!user?.email) return;
    setResetLoading(true);
    try {
      await resetPassword(user.email);
      setResetSent(true);
    } catch (err) {
      console.error("Reset failed:", err);
    } finally {
      setResetLoading(false);
    }
  };

  const initials = user?.displayName
    ? user.displayName.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)
    : user?.email?.charAt(0).toUpperCase() || "U";

  return (
    <div className="p-6 lg:p-8 max-w-[900px] mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>Settings</h1>
        <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>Manage your account and workspace preferences.</p>
      </div>

      {/* Appearance */}
      <div className="rounded-xl border p-6" style={{ borderColor: "var(--border-default)", background: "var(--bg-card)" }}>
        <h2 className="text-base font-semibold mb-4" style={{ color: "var(--text-primary)" }}>Appearance</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-3" style={{ color: "var(--text-secondary)" }}>Theme</label>
            <div className="flex gap-3">
              {([
                { value: "light" as const, icon: <Sun size={18} />, label: "Light", desc: "Clean and bright" },
                { value: "system" as const, icon: <Monitor size={18} />, label: "System", desc: "Match your OS" },
                { value: "dark" as const, icon: <Moon size={18} />, label: "Dark", desc: "Easy on the eyes" },
              ]).map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setTheme(opt.value)}
                  className="flex flex-col items-center gap-2 rounded-xl border-2 px-6 py-4 transition-all"
                  style={{
                    borderColor: theme === opt.value ? "var(--accent-primary)" : "var(--border-default)",
                    background: theme === opt.value ? "var(--accent-primary-light)" : "var(--bg-card)",
                    color: theme === opt.value ? "var(--accent-primary)" : "var(--text-secondary)",
                  }}
                >
                  {opt.icon}
                  <span className="text-sm font-medium">{opt.label}</span>
                  <span className="text-xs" style={{ color: "var(--text-muted)" }}>{opt.desc}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Profile */}
      <div className="rounded-xl border p-6" style={{ borderColor: "var(--border-default)", background: "var(--bg-card)" }}>
        <h2 className="text-base font-semibold mb-4" style={{ color: "var(--text-primary)" }}>Profile</h2>
        <div className="flex items-start gap-6">
          {/* Avatar with photo upload */}
          <div className="relative group">
            <div className="h-20 w-20 rounded-full overflow-hidden border-2 border-white shadow-md flex items-center justify-center" style={{ background: "var(--accent-primary-button)" }}>
              {user?.photoURL ? (
                <img src={user.photoURL} alt="Profile" className="h-full w-full object-cover" />
              ) : (
                <span className="text-2xl font-bold" style={{ color: "var(--text-inverse)" }}>{initials}</span>
              )}
            </div>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={photoUploading}
              className="absolute inset-0 flex items-center justify-center rounded-full opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-50"
              style={{ background: "var(--bg-overlay)" }}
            >
              {photoUploading ? (
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : (
                <Camera size={20} style={{ color: "var(--text-inverse)" }} />
              )}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handlePhotoUpload}
              className="hidden"
            />
            {photoSuccess && (
              <div className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full flex items-center justify-center" style={{ background: "var(--color-success)" }}>
                <CheckCircle size={12} style={{ color: "var(--text-inverse)" }} />
              </div>
            )}
          </div>

          <div className="flex-1 space-y-4">
            <div>
              <label htmlFor="settings-display-name" className="block text-sm font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>Display Name</label>
              <input id="settings-display-name" name="settings-display-name" type="text" defaultValue={user?.displayName || ""} placeholder="Your name"
                className="input" />
            </div>
            <div>
              <label htmlFor="settings-email" className="block text-sm font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>Email</label>
              <input id="settings-email" name="settings-email" type="email" value={user?.email || ""} disabled
                className="input" style={{ background: "var(--bg-disabled)", color: "var(--text-disabled)" }} />
              <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>Email is managed by Firebase Authentication.</p>
            </div>
            <div>
              <label htmlFor="settings-uid" className="block text-sm font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>User ID</label>
              <input id="settings-uid" name="settings-uid" type="text" value={user?.uid || ""} disabled
                className="input font-mono" style={{ background: "var(--bg-disabled)", color: "var(--text-disabled)" }} />
            </div>
            <div>
              <label htmlFor="settings-provider" className="block text-sm font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>Auth Provider</label>
              <input id="settings-provider" name="settings-provider" type="text" value={user?.providerData?.[0]?.providerId === "google.com" ? "Google" : "Email/Password"} disabled
                className="input" style={{ background: "var(--bg-disabled)", color: "var(--text-disabled)" }} />
            </div>
            <div className="pt-2">
              <button className="btn-primary px-5 py-2.5">
                Save Changes
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Photo Storage */}
      <div className="rounded-xl border p-6" style={{ borderColor: "var(--border-default)", background: "var(--bg-card)" }}>
        <h2 className="text-base font-semibold mb-4" style={{ color: "var(--text-primary)" }}>Cloud Storage</h2>
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg shrink-0" style={{ background: "var(--color-info-light)", color: "var(--accent-primary)" }}>
              <Upload size={18} />
            </div>
            <div>
              <div className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>Profile Photo</div>
              <div className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>Stored in Firebase Cloud Storage under <code className="px-1 rounded text-[11px]" style={{ background: "var(--neutral-100)" }}>profile-photos/{user?.uid || "..."}/avatar.*</code></div>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg shrink-0" style={{ background: "var(--color-info-light)", color: "var(--accent-primary)" }}>
              <Upload size={18} />
            </div>
            <div>
              <div className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>Uploaded Documents</div>
              <div className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>Product datasheets and files are stored in Firebase Cloud Storage under <code className="px-1 rounded text-[11px]" style={{ background: "var(--neutral-100)" }}>uploads/{user?.uid || "..."}/</code></div>
            </div>
          </div>
        </div>
      </div>

      {/* Account */}
      <div className="rounded-xl border p-6" style={{ borderColor: "var(--border-default)", background: "var(--bg-card)" }}>
        <h2 className="text-base font-semibold mb-4" style={{ color: "var(--text-primary)" }}>Account</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>Change Password</label>
            <p className="text-xs mb-3" style={{ color: "var(--text-muted)" }}>Password changes are managed through Firebase Authentication. We&apos;ll send a reset link to your email.</p>
            {resetSent ? (
              <div className="rounded-lg px-4 py-3 text-sm" style={{ background: "var(--color-success-light)", color: "var(--color-success-text)", border: "1px solid var(--color-success-border)" }}>
                ✓ Password reset email sent to <strong>{user?.email}</strong>. Check your inbox.
              </div>
            ) : (
              <button onClick={handlePasswordReset} disabled={resetLoading}
                className="btn-secondary disabled:opacity-50">
                {resetLoading ? "Sending…" : "Send Password Reset Email"}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Workspace */}
      <div className="rounded-xl border p-6" style={{ borderColor: "var(--border-default)", background: "var(--bg-card)" }}>
        <h2 className="text-base font-semibold mb-4" style={{ color: "var(--text-primary)" }}>Workspace</h2>
        <div className="space-y-4">
          <div>
            <label htmlFor="settings-category" className="block text-sm font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>Default Category</label>
            <select id="settings-category" name="settings-category" className="select">
              <option>Electric Motors & Drives</option>
              <option>Pumps</option>
              <option>Compressors</option>
              <option>Valves & Fittings</option>
              <option>Uncategorized</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>AI Processing</label>
            <div className="flex items-center gap-3">
              <input id="settings-ai" name="settings-ai" type="checkbox" defaultChecked className="h-4 w-4 rounded" style={{ borderColor: "var(--border-strong)" }} />
              <span className="text-sm" style={{ color: "var(--text-secondary)" }}>Enable automatic AI extraction on upload</span>
            </div>
          </div>
        </div>
      </div>

      {/* Data & Export */}
      <div className="rounded-xl border p-6" style={{ borderColor: "var(--border-default)", background: "var(--bg-card)" }}>
        <h2 className="text-base font-semibold mb-4" style={{ color: "var(--text-primary)" }}>Data & Export</h2>
        <div className="space-y-3">
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>Export all your product data or manage your workspace data.</p>
          <div className="flex gap-3">
            <button className="btn-secondary">
              Export All Products (JSON)
            </button>
            <button className="btn-secondary">
              Export All Products (CSV)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <ProtectedRoute>
      <SettingsContent />
    </ProtectedRoute>
  );
}
