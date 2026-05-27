"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { motion } from "framer-motion";

function ResetPasswordInner() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  const tokenLooksValid = token.length >= 20;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error ?? "Could not reset password.");
        return;
      }
      setDone(true);
      // Send them to login after a short pause so they read the success message.
      setTimeout(() => router.push("/login"), 1500);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{
          backgroundImage:
            "url(https://source.unsplash.com/random/1920x1080/?artificial-intelligence,cyberpunk,technology)",
        }}
      >
        <div className="absolute inset-0 bg-black/70" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative w-full max-w-md"
      >
        <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-8 shadow-2xl">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold bg-gradient-to-r from-neon-purple via-electric-blue to-hot-pink bg-clip-text text-transparent mb-2">
              Set a New Password
            </h1>
            <p className="text-gray-400">
              Pick something at least 8 characters long.
            </p>
          </div>

          {!tokenLooksValid ? (
            <div className="space-y-6">
              <div className="text-red-300 text-sm bg-red-500/10 border border-red-500/20 rounded-lg p-4">
                This reset link is missing or malformed. Request a fresh one
                from the forgot-password page.
              </div>
              <div className="text-center text-sm">
                <Link
                  href="/forgot-password"
                  className="text-neon-purple hover:text-electric-blue transition-colors"
                >
                  Request a new link
                </Link>
              </div>
            </div>
          ) : done ? (
            <div className="space-y-6">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-green-300 text-sm bg-green-500/10 border border-green-500/20 rounded-lg p-4"
              >
                Password updated. Redirecting you to sign in…
              </motion.div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="password" className="text-gray-200">
                  New password
                </Label>
                <PasswordInput
                  id="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoFocus
                  className="bg-white/5 border-white/10 text-white placeholder:text-gray-500 focus:border-neon-purple focus:ring-neon-purple"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirm" className="text-gray-200">
                  Confirm new password
                </Label>
                <PasswordInput
                  id="confirm"
                  placeholder="••••••••"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                  className="bg-white/5 border-white/10 text-white placeholder:text-gray-500 focus:border-neon-purple focus:ring-neon-purple"
                />
              </div>

              {error && (
                <motion.div
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg p-3"
                >
                  {error}
                </motion.div>
              )}

              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-neon-purple to-electric-blue hover:opacity-90 transition-opacity"
              >
                {loading ? "Updating…" : "Update password"}
              </Button>

              <div className="text-center text-sm">
                <Link
                  href="/login"
                  className="text-neon-purple hover:text-electric-blue transition-colors"
                >
                  Back to sign in
                </Link>
              </div>
            </form>
          )}
        </div>
      </motion.div>
    </div>
  );
}

// useSearchParams must be inside Suspense in app-router pages.
export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordInner />
    </Suspense>
  );
}
