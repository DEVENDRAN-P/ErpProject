"use client";

import { useState, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import { Camera, Upload, CheckCircle } from "lucide-react";

export default function SettingsPage() {
  const { user, updateProfilePhoto, resetPassword } = useAuth();
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
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-sm text-gray-500 mt-1">Manage your account and workspace preferences.</p>
      </div>

      {/* Profile */}
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <h2 className="text-base font-semibold text-gray-900 mb-4">Profile</h2>
        <div className="flex items-start gap-6">
          {/* Avatar with photo upload */}
          <div className="relative group">
            <div className="h-20 w-20 rounded-full overflow-hidden bg-[#2563EB] border-2 border-white shadow-md flex items-center justify-center">
              {user?.photoURL ? (
                <img src={user.photoURL} alt="Profile" className="h-full w-full object-cover" />
              ) : (
                <span className="text-2xl font-bold text-white">{initials}</span>
              )}
            </div>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={photoUploading}
              className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-50"
            >
              {photoUploading ? (
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : (
                <Camera size={20} className="text-white" />
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
              <div className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full bg-emerald-500 flex items-center justify-center">
                <CheckCircle size={12} className="text-white" />
              </div>
            )}
          </div>

          <div className="flex-1 space-y-4">
            <div>
              <label htmlFor="settings-display-name" className="block text-sm font-medium text-gray-700 mb-1.5">Display Name</label>
              <input id="settings-display-name" name="settings-display-name" type="text" defaultValue={user?.displayName || ""} placeholder="Your name"
                className="w-full rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 placeholder-gray-400 outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-blue-50 transition" />
            </div>
            <div>
              <label htmlFor="settings-email" className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
              <input id="settings-email" name="settings-email" type="email" value={user?.email || ""} disabled
                className="w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-500" />
              <p className="text-xs text-gray-400 mt-1">Email is managed by Firebase Authentication.</p>
            </div>
            <div>
              <label htmlFor="settings-uid" className="block text-sm font-medium text-gray-700 mb-1.5">User ID</label>
              <input id="settings-uid" name="settings-uid" type="text" value={user?.uid || ""} disabled
                className="w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-500 font-mono" />
            </div>
            <div>
              <label htmlFor="settings-provider" className="block text-sm font-medium text-gray-700 mb-1.5">Auth Provider</label>
              <input id="settings-provider" name="settings-provider" type="text" value={user?.providerData?.[0]?.providerId === "google.com" ? "Google" : "Email/Password"} disabled
                className="w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-500" />
            </div>
            <div className="pt-2">
              <button className="rounded-lg bg-[#2563EB] px-5 py-2.5 text-sm font-medium text-white hover:bg-[#1D4ED8] transition">
                Save Changes
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Photo Storage */}
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <h2 className="text-base font-semibold text-gray-900 mb-4">Cloud Storage</h2>
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-[#2563EB] shrink-0">
              <Upload size={18} />
            </div>
            <div>
              <div className="text-sm font-medium text-gray-900">Profile Photo</div>
              <div className="text-xs text-gray-500 mt-0.5">Stored in Firebase Cloud Storage under <code className="bg-gray-100 px-1 rounded text-[11px]">profile-photos/{user?.uid || "..."}/avatar.*</code></div>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-[#2563EB] shrink-0">
              <Upload size={18} />
            </div>
            <div>
              <div className="text-sm font-medium text-gray-900">Uploaded Documents</div>
              <div className="text-xs text-gray-500 mt-0.5">Product datasheets and files are stored in Firebase Cloud Storage under <code className="bg-gray-100 px-1 rounded text-[11px]">uploads/{user?.uid || "..."}/</code></div>
            </div>
          </div>
        </div>
      </div>

      {/* Account */}
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <h2 className="text-base font-semibold text-gray-900 mb-4">Account</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Change Password</label>
            <p className="text-xs text-gray-500 mb-3">Password changes are managed through Firebase Authentication. We&apos;ll send a reset link to your email.</p>
            {resetSent ? (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                ✓ Password reset email sent to <strong>{user?.email}</strong>. Check your inbox.
              </div>
            ) : (
              <button onClick={handlePasswordReset} disabled={resetLoading}
                className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition disabled:opacity-50">
                {resetLoading ? "Sending…" : "Send Password Reset Email"}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Workspace */}
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <h2 className="text-base font-semibold text-gray-900 mb-4">Workspace</h2>
        <div className="space-y-4">
          <div>
            <label htmlFor="settings-category" className="block text-sm font-medium text-gray-700 mb-1.5">Default Category</label>
            <select id="settings-category" name="settings-category" className="w-full rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-blue-50 transition">
              <option>Electric Motors & Drives</option>
              <option>Pumps</option>
              <option>Compressors</option>
              <option>Valves & Fittings</option>
              <option>Uncategorized</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">AI Processing</label>
            <div className="flex items-center gap-3">
              <input id="settings-ai" name="settings-ai" type="checkbox" defaultChecked className="h-4 w-4 rounded border-gray-300 text-[#2563EB] focus:ring-blue-50" />
              <span className="text-sm text-gray-700">Enable automatic AI extraction on upload</span>
            </div>
          </div>
        </div>
      </div>

      {/* Data & Export */}
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <h2 className="text-base font-semibold text-gray-900 mb-4">Data & Export</h2>
        <div className="space-y-3">
          <p className="text-sm text-gray-500">Export all your product data or manage your workspace data.</p>
          <div className="flex gap-3">
            <button className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition">
              Export All Products (JSON)
            </button>
            <button className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition">
              Export All Products (CSV)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
