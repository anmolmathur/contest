"use client";

import { useEffect, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { motion } from "framer-motion";
import { GoogleSignInButton } from "@/components/auth/GoogleSignInButton";

const AUTH_ERRORS: Record<string, string> = {
  GoogleEmailUnverified: "Your Google account email isn't verified. Please verify it with Google or use email sign-in.",
  OAuthAccountNotLinked: "This email is already linked to another sign-in method.",
  AccessDenied: "Sign-in was cancelled or denied.",
  Configuration: "Sign-in is temporarily unavailable. Please try again or use email and password.",
};

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState("");
  const [needsRegistration, setNeedsRegistration] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const err = params.get("error");
    if (err) setError(AUTH_ERRORS[err] ?? "Sign-in failed. Please try again.");
    if (params.get("registered")) setNotice("Account created — sign in to continue.");
    if (params.get("reset")) setNotice("Password updated — sign in with your new password.");
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setNeedsRegistration(false);
    setLoading(true);

    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (result?.code === "no_account") {
        setError("No account found for this email. Please register first.");
        setNeedsRegistration(true);
      } else if (result?.code === "no_password") {
        setError("This account has no password yet. Use \"Forgot password\" to set one, or sign in with Google.");
      } else if (result?.error) {
        setError("Invalid email or password");
      } else {
        // Redirect to callbackUrl if user was trying to access a protected page
        const params = new URLSearchParams(window.location.search);
        const callbackUrl = params.get("callbackUrl");
        if (callbackUrl) {
          router.push(callbackUrl);
          router.refresh();
          return;
        }

        // Otherwise let the server pick the right contest (custom domain,
        // single enrolment, or single active contest).
        router.push("/post-login");
        router.refresh();
        return;
      }
    } catch (error) {
      setError("An error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      {/* Animated background */}
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{
          backgroundImage:
            "url(https://source.unsplash.com/random/1920x1080/?artificial-intelligence,cyberpunk,technology)",
        }}
      >
        <div className="absolute inset-0 bg-black/70" />
      </div>

      {/* Login Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative w-full max-w-md"
      >
        <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-8 shadow-2xl">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold bg-gradient-to-r from-neon-purple via-electric-blue to-hot-pink bg-clip-text text-transparent mb-2">
              Welcome Back
            </h1>
            <p className="text-gray-400">Sign in to continue to the challenge</p>
          </div>

          {notice && (
            <div className="mb-5 rounded-lg border border-green-500/20 bg-green-500/10 p-3 text-sm text-green-300">
              {notice}
            </div>
          )}

          <GoogleSignInButton />

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-gray-200">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="your.email@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="bg-white/5 border-white/10 text-white placeholder:text-gray-500 focus:border-neon-purple focus:ring-neon-purple"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-gray-200">
                  Password
                </Label>
                <Link
                  href="/forgot-password"
                  className="text-xs text-neon-purple hover:text-electric-blue transition-colors"
                >
                  Forgot password?
                </Link>
              </div>
              <PasswordInput
                id="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
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
                {needsRegistration && (
                  <>
                    {" "}
                    <Link href="/register" className="underline font-semibold">
                      Register
                    </Link>
                  </>
                )}
              </motion.div>
            )}

            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-neon-purple to-electric-blue hover:opacity-90 transition-opacity"
            >
              {loading ? "Signing in..." : "Sign In"}
            </Button>
          </form>

          <div className="mt-6 text-center text-sm">
            <span className="text-gray-400">Don't have an account? </span>
            <Link
              href={`/register${typeof window !== "undefined" ? window.location.search : ""}`}
              className="text-neon-purple hover:text-electric-blue transition-colors"
            >
              Register here
            </Link>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

