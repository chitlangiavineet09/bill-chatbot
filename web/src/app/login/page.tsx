"use client";
import { useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function LoginPage() {
  const params = useSearchParams();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const next = params.get("next") || "/";

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      if (isSignUp) {
        // Create user via NextAuth credentials provider
        const res = await fetch("/api/auth/signup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data?.error || "Signup failed");
        }
        // After successful signup, sign in with NextAuth
        const result = await signIn("credentials", {
          email,
          password,
          callbackUrl: next,
          redirect: false
        });
        if (result?.error) {
          throw new Error("Sign in failed after signup");
        }
      } else {
        // For signin, use NextAuth
        const result = await signIn("credentials", {
          email,
          password,
          callbackUrl: next,
          redirect: false
        });
        if (result?.error) {
          throw new Error("Invalid credentials");
        }
      }
      router.replace(next);
    } catch (e: any) {
      setError(e.message || "Authentication failed");
    } finally {
      setLoading(false);
    }
  }

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    setError(null);
    try {
      const result = await signIn("google", { 
        callbackUrl: next,
        redirect: false 
      });
      
      if (result?.error) {
        setError("Google sign-in failed. Please try again.");
      } else if (result?.ok) {
        router.replace(next);
      }
    } catch (error) {
      setError("Google sign-in failed. Please try again.");
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <div className="min-h-dvh flex items-center justify-center p-6">
      <form onSubmit={onSubmit} className="w-full max-w-sm space-y-4">
        <h1 className="text-xl font-semibold">{isSignUp ? "Sign up" : "Sign in"}</h1>
        {error && <div className="text-red-600 text-sm">{error}</div>}
        <div className="space-y-1">
          <label className="text-sm">Email</label>
          <Input type="email" value={email} onChange={e => setEmail(e.target.value)} required />
        </div>
        <div className="space-y-1">
          <label className="text-sm">Password</label>
          <Input type="password" value={password} onChange={e => setPassword(e.target.value)} required />
        </div>
        <Button disabled={loading} type="submit" className="w-full">
          {loading ? (isSignUp ? "Creating account..." : "Signing in...") : (isSignUp ? "Sign up" : "Sign in")}
        </Button>
        
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-300" />
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-white text-gray-500">Or continue with</span>
          </div>
        </div>

        <Button
          type="button"
          onClick={handleGoogleSignIn}
          disabled={googleLoading || loading}
          variant="outline"
          className="w-full"
        >
          {googleLoading ? (
            "Signing in with Google..."
          ) : (
            <>
              <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="currentColor"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="currentColor"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="currentColor"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              Continue with Google
            </>
          )}
        </Button>

        <button
          type="button"
          onClick={() => setIsSignUp(!isSignUp)}
          className="w-full text-sm text-blue-600 hover:underline"
        >
          {isSignUp ? "Already have an account? Sign in" : "Don't have an account? Sign up"}
        </button>
      </form>
    </div>
  );
}


