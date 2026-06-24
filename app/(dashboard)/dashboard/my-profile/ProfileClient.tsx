"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { User, Mail, ShieldAlert, Key } from "lucide-react";

interface UserProfileDetails {
  name: string;
  email: string;
  role: string;
}

export default function ProfileClient({ user }: { user: UserProfileDetails }) {
  const router = useRouter();
  const { update } = useSession();
  const [name, setName] = useState(user.name);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    setIsError(false);

    if (!name.trim()) {
      setIsError(true);
      setMessage("Name is required.");
      return;
    }

    if (password && password.length < 6) {
      setIsError(true);
      setMessage("Password must be at least 6 characters long.");
      return;
    }

    if (password !== confirmPassword) {
      setIsError(true);
      setMessage("Passwords do not match.");
      return;
    }

    setSaving(true);

    try {
      const response = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), password: password || undefined }),
      });

      if (!response.ok) {
        const json = await response.json();
        throw new Error(json.error || "Failed to update profile.");
      }

      // Update session credentials so the header and sidebar display updated username
      await update();

      setMessage("Profile updated successfully!");
      setPassword("");
      setConfirmPassword("");
      router.refresh();
    } catch (err) {
      setIsError(true);
      setMessage(err instanceof Error ? err.message : "Unable to update profile.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-foreground">My Profile</h1>
        <p className="text-sm text-muted-foreground">
          Update your account display name and password credentials.
        </p>
      </div>

      {message && (
        <div
          className={`rounded-lg border p-4 text-sm font-medium ${
            isError
              ? "border-danger bg-danger/10 text-danger"
              : "border-border bg-muted/50 text-muted-foreground"
          }`}
        >
          {message}
        </div>
      )}

      <form onSubmit={handleSave} className="rounded-lg border border-border bg-card p-6 shadow-sm space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">Account Profile</h2>

        {/* Email - Read-only */}
        <div className="space-y-2">
          <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Email Address</Label>
          <div className="relative">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <Mail className="h-4 w-4 text-muted-foreground" />
            </div>
            <Input
              value={user.email}
              disabled
              className="pl-10 bg-muted/40 cursor-not-allowed border-muted"
            />
          </div>
          <p className="text-xs text-muted-foreground">Contact email cannot be changed.</p>
        </div>

        {/* Role - Read-only */}
        <div className="space-y-2">
          <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">System Role</Label>
          <div className="relative">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <ShieldAlert className="h-4 w-4 text-muted-foreground" />
            </div>
            <Input
              value={user.role.toUpperCase()}
              disabled
              className="pl-10 bg-muted/40 cursor-not-allowed border-muted font-mono tracking-wider"
            />
          </div>
        </div>

        {/* Name - Editable */}
        <div className="space-y-2">
          <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Display Name</Label>
          <div className="relative">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <User className="h-4 w-4 text-muted-foreground" />
            </div>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="pl-10"
              placeholder="Your Name"
            />
          </div>
        </div>

        <div className="pt-4 border-t border-border space-y-4">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Security Settings</h3>
          <p className="text-xs text-muted-foreground">Leave empty if you do not want to change your password.</p>

          {/* New Password */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">New Password</Label>
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                <Key className="h-4 w-4 text-muted-foreground" />
              </div>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pl-10"
                placeholder="••••••"
              />
            </div>
          </div>

          {/* Confirm Password */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Confirm New Password</Label>
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                <Key className="h-4 w-4 text-muted-foreground" />
              </div>
              <Input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="pl-10"
                placeholder="••••••"
              />
            </div>
          </div>
        </div>

        {/* Action Button */}
        <div className="flex justify-end pt-4">
          <Button type="submit" disabled={saving} className="min-w-[120px]">
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </form>
    </div>
  );
}
