"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AuthVisual } from "@/components/apple-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError(error.message);
    } else {
      router.refresh();
      router.push("/dashboard");
    }
    setLoading(false);
  }

  return (
    <main className="grid min-h-screen items-center gap-10 bg-[var(--bg-main)] px-5 py-8 lg:grid-cols-[0.9fr_1.1fr] lg:px-16">
      <section className="mx-auto w-full max-w-md rounded-[32px] border border-white/70 bg-white/75 p-7 shadow-[var(--shadow-soft)] backdrop-blur-xl">
        <Link href="/" className="mb-10 flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-2xl bg-[var(--text-primary)] text-xs font-semibold text-white">BCA</div>
          <div>
            <p className="text-sm font-semibold tracking-[-0.02em]">e-Statement</p>
            <p className="text-xs text-[var(--text-muted)]">Welcome back</p>
          </div>
        </Link>

        <div className="mb-7">
          <h1 className="text-3xl font-semibold tracking-[-0.05em]">Sign in</h1>
          <p className="mt-2 text-sm text-[var(--text-secondary)]">Continue to your private spending workspace.</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email" className="text-[var(--text-secondary)]">Email</Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="h-12 rounded-2xl bg-white/70 px-4" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password" className="text-[var(--text-secondary)]">Password</Label>
            <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required className="h-12 rounded-2xl bg-white/70 px-4" />
          </div>
          {error && <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-[var(--expense-red)]">{error}</p>}
          <Button type="submit" className="h-12 w-full rounded-full bg-[var(--apple-blue)] text-sm font-semibold text-white hover:bg-[var(--apple-blue-strong)]" disabled={loading}>
            {loading ? "Signing in…" : "Sign in"}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-[var(--text-muted)]">
          No account? <Link href="/register" className="font-semibold text-[var(--apple-blue)] hover:underline">Create one</Link>
        </p>
      </section>
      <AuthVisual />
    </main>
  );
}
