"use client";

import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { useState } from "react";
import { AuthVisual, ThemeToggle } from "@/components/apple-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase";

export default function RegisterPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const supabase = createClient();

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) {
      setError(error.message);
    } else {
      setSuccess(true);
    }
    setLoading(false);
  }

  return (
    <main className="grid min-h-screen items-center gap-10 bg-[var(--term-bg)] px-5 py-8 lg:grid-cols-[0.9fr_1.1fr] lg:px-16">
      <section className="term-panel mx-auto w-full max-w-md p-7">
        <div className="mb-4 flex justify-end"><ThemeToggle /></div>
        <Link href="/" className="mb-10 block border-b border-[var(--term-border)] pb-5">
          <p className="font-mono text-sm font-bold tracking-[0.16em] text-[var(--term-accent)]">LEMBAR<span className="text-[var(--term-fg)]">/TERM</span></p>
          <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--term-muted)]">operator provisioning</p>
        </Link>

        {success ? (
          <div className="text-center">
            <div className="mx-auto grid h-14 w-14 place-items-center border border-[var(--term-pos)] text-[var(--term-pos)]">
              <CheckCircle2 size={26} />
            </div>
            <h1 className="mt-5 font-mono text-3xl font-semibold uppercase tracking-[-0.05em] text-[var(--term-fg)]">Account created!</h1>
            <p className="mt-3 text-sm leading-6 text-[var(--term-secondary)]">
              Check your email to confirm your account, then <Link href="/login" className="font-semibold text-[var(--term-accent)] hover:underline">sign in</Link>.
            </p>
          </div>
        ) : (
          <>
            <div className="mb-7">
              <p className="term-label">auth.create</p>
              <h1 className="mt-2 font-mono text-3xl font-semibold uppercase tracking-[-0.05em] text-[var(--term-fg)]">Create operator</h1>
              <p className="mt-2 text-sm text-[var(--term-secondary)]">Start organizing BCA statements into dense terminal views.</p>
            </div>

            <form onSubmit={handleRegister} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="term-label">Email</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="h-11 rounded-none border-[var(--term-border)] bg-[var(--term-bg)] px-3 font-mono text-sm text-[var(--term-fg)]" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" className="term-label">Password</Label>
                <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={6} required className="h-11 rounded-none border-[var(--term-border)] bg-[var(--term-bg)] px-3 font-mono text-sm text-[var(--term-fg)]" />
              </div>
              {error && <p className="border border-[var(--term-neg)] bg-[var(--term-panel-2)] px-4 py-3 font-mono text-xs text-[var(--term-neg)]">{error}</p>}
              <Button type="submit" className="h-11 w-full rounded-none bg-[var(--term-accent)] font-mono text-xs font-bold uppercase tracking-[0.12em] text-[var(--term-bg)] hover:bg-[var(--term-accent-2)]" disabled={loading}>
                {loading ? "Creating account…" : "Create account"}
              </Button>
            </form>

            <p className="mt-6 text-center font-mono text-xs text-[var(--term-muted)]">
              Already have an account? <Link href="/login" className="font-semibold text-[var(--term-accent)] hover:underline">Sign in</Link>
            </p>
          </>
        )}
      </section>
      <AuthVisual />
    </main>
  );
}
