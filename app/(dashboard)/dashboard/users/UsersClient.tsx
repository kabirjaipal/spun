"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Shield, ShieldCheck, UserMinus, UserCheck } from "lucide-react";

interface UserItem {
  id: string;
  name: string | null;
  email: string | null;
  isActive: boolean;
  role: string;
}

export default function UsersClient({
  initialUsers,
}: {
  initialUsers: UserItem[];
}) {
  const [users, setUsers] = useState<UserItem[]>(initialUsers);
  const [isCreating, setIsCreating] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("company");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleCreateUser(e: React.FormEvent) {
    e.preventDefault();
    if (!name || !email || !password) {
      setMessage("All fields are required.");
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      const response = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, role }),
      });

      if (!response.ok) {
        const json = await response.json();
        throw new Error(json.error || "Failed to create user.");
      }

      const newUser = await response.json();
      setUsers([...users, { ...newUser, isActive: true }]);
      setMessage("User created successfully!");
      setIsCreating(false);

      // Reset
      setName("");
      setEmail("");
      setPassword("");
      setRole("company");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Unable to save user.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleUserStatus(id: string, currentStatus: boolean) {
    try {
      const response = await fetch(`/api/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !currentStatus }),
      });

      if (!response.ok) {
        const json = await response.json();
        throw new Error(json.error || "Failed to update user status.");
      }

      setUsers(users.map((u) => (u.id === id ? { ...u, isActive: !currentStatus } : u)));
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to toggle user status.");
    }
  }

  async function deleteUser(id: string) {
    if (!confirm("Are you sure you want to delete this user?")) return;

    try {
      const response = await fetch(`/api/users/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const json = await response.json();
        throw new Error(json.error || "Failed to delete user.");
      }

      setUsers(users.filter((u) => u.id !== id));
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete user.");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground uppercase">Users List</h1>
        </div>
        <Button onClick={() => setIsCreating(true)} className="flex items-center gap-2">
          <Plus className="h-4 w-4" /> Add New User
        </Button>
      </div>

      {message && (
        <div className="rounded-lg border border-border bg-muted/50 p-4 text-sm text-muted-foreground">
          {message}
        </div>
      )}

      {isCreating && (
        <form onSubmit={handleCreateUser} className="rounded-lg border border-border bg-card p-5 shadow-sm space-y-4 max-w-xl">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground">Invite / Create User</h2>
          
          <div className="space-y-2">
            <Label>Full Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full Name" required />
          </div>

          <div className="space-y-2">
            <Label>Email Address</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="user@company.com" required />
          </div>

          <div className="space-y-2">
            <Label>Password</Label>
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required />
          </div>

          <div className="space-y-2">
            <Label>System Role</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="company">Company Staff (Standard Access)</SelectItem>
                <SelectItem value="owner">System Owner (Full Platform Access)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-2 justify-end">
            <Button type="button" variant="outline" onClick={() => setIsCreating(false)}>Cancel</Button>
            <Button type="submit" disabled={saving}>
              {saving ? (
                <>
                  <Spinner className="mr-2" />
                  Creating
                </>
              ) : (
                "Save User"
              )}
            </Button>
          </div>
        </form>
      )}

      <div className="rounded-lg border border-border bg-card overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left text-xs font-bold uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3 text-center">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-sm text-muted-foreground">
                  No system users found.
                </td>
              </tr>
            ) : (
              users.map((user) => (
                <tr key={user.id} className="border-t border-border/50 hover:bg-muted/10 transition-colors">
                  <td className="px-4 py-3 font-semibold text-foreground">{user.name || "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground font-sans">{user.email || "—"}</td>
                  <td className="px-4 py-3 text-xs uppercase tracking-wide text-foreground">
                    <span className="flex items-center gap-1">
                      {user.role === "owner" ? (
                        <>
                          <ShieldCheck className="h-4 w-4 text-primary" />
                          <span>Owner</span>
                        </>
                      ) : (
                        <>
                          <Shield className="h-4 w-4 text-muted-foreground" />
                          <span>Company</span>
                        </>
                      )}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold tracking-wider ${
                      user.isActive 
                        ? "bg-success/15 text-success border border-success/10" 
                        : "bg-danger/15 text-danger border border-danger/10"
                    }`}>
                      {user.isActive ? "ACTIVE" : "INACTIVE"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right space-x-2">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => toggleUserStatus(user.id, user.isActive)}
                      className={user.isActive ? "text-warning hover:bg-warning/10" : "text-success hover:bg-success/10"}
                      title={user.isActive ? "Deactivate User" : "Activate User"}
                    >
                      {user.isActive ? <UserMinus className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => deleteUser(user.id)}
                      className="text-danger hover:bg-danger/10"
                      title="Delete User"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
